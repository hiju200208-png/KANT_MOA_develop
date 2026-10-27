"""Residual catalog APIs: real P1 auth and fixture-owned Docker DB only."""
import asyncio
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from products.application.discovery_service import DiscoveryService
from products.infrastructure.discovery import DiscoveryRepository
from test_catalog_api import catalog_client
from test_wishlist import wishlist_client


def test_original_catalog_ids_members_banners_settings(postgres_url, original_images):
    async def scenario():
        async with catalog_client(postgres_url, original=True) as (client, session, _, _):
            artists = (await client.get('/artists')).json()
            assert len(artists) == 11
            assert all(set(a) == {'id','name','name_ko','slug','logo_path','hero_image_path','theme_color','tagline'} for a in artists)
            total_members = total_banners = 0
            for a in artists:
                assert (await client.get('/artists/'+a['slug'])).json() == a
                members = (await client.get('/artists/'+a['slug']+'/members')).json()
                banners = (await client.get('/artists/'+a['slug']+'/banners')).json()
                total_members += len(members); total_banners += len(banners)
                assert all(m['image_path'] is None or m['image_path'].startswith('/static/artists/') for m in members)
            assert (total_members,total_banners) == (13,5)
            settings = await client.get('/shop-settings')
            assert settings.status_code == 200
            assert (settings.json()['free_shipping_threshold'],settings.json()['shipping_fee']) == (50000,3000)
            assert 'id' not in settings.json()
            # Must agree with P3's existing calculation policy.
            policy = (await client.get('/orders/shipping-policy')).json()
            assert policy['free_shipping_threshold'] == settings.json()['free_shipping_threshold']
            assert policy['shipping_fee'] == settings.json()['shipping_fee']
            assert len((await client.get('/products/best?limit=50')).json()) == 50
            assert (await session.scalar(text('SELECT count(*) FROM products'))) == 389
    asyncio.run(scenario())


def test_banner_notice_visibility_and_missing_settings(postgres_url):
    async def scenario():
        async with catalog_client(postgres_url) as (client, s, ids, _):
            a = await s.scalar(text("SELECT id FROM artists WHERE slug='alpha'"))
            for title, active, start, end in [('visible',True,-1,1),('off',False,-1,1),('future',True,1,2),('expired',True,-2,-1)]:
                await s.execute(text("INSERT INTO home_banners(slot,title,image_path,link_path,is_active,starts_at,ends_at) VALUES ('main',:title,'/static/artists/test.webp','/products/1',:active,now()+make_interval(days=>:start),now()+make_interval(days=>:end))"),locals())
            assert [b['title'] for b in (await client.get('/home-banners')).json()] == ['visible']
            notice_ids = {}
            for title, days, pinned, product in [('new',-1,False,ids[0]),('pinned',-2,True,ids[4]),('future',1,True,ids[0])]:
                notice_ids[title] = await s.scalar(text('''INSERT INTO notices(artist_id,title,body,product_id,is_pinned,show_in_topbar,published_at)
                    VALUES (:a,:title,'line1\nline2',:product,:pinned,true,now()+make_interval(days=>:days)) RETURNING id'''),locals())
            notices = (await client.get('/notices?artist=alpha')).json()
            assert [n['title'] for n in notices] == ['pinned','new']
            assert notices[0]['product_id'] is None  # hidden related product
            assert (await client.get('/notices/topbar')).json()['title'] == 'new'
            assert (await client.get(f"/notices/{notice_ids['new']}?artist=beta")).status_code == 404
            assert (await client.get(f"/notices/{notice_ids['future']}")).status_code == 404
            assert (await client.get('/notices?artist=missing')).json() == []
            assert (await client.get('/shop-settings')).status_code == 503
            for path in ['/artists/missing','/artists/missing/members','/artists/missing/banners']:
                assert (await client.get(path)).status_code == 404
    asyncio.run(scenario())


def test_best_paid_quantity_aggregation_excludes_pending_cancelled_old_future_hidden(postgres_url):
    async def scenario():
        async with catalog_client(postgres_url) as (client,s,ids,_):
            uid = uuid4()
            await s.execute(text("INSERT INTO users(id,email,nickname,password_hash) VALUES (:uid,'best-review@example.com','Best','fixture')"), {'uid':uid})
            variants = (await s.execute(text('SELECT id,product_id FROM product_variants ORDER BY id'))).all()
            first = [v.id for v in variants if v.product_id == ids[0]]
            second = next(v.id for v in variants if v.product_id == ids[1])
            hidden = next(v.id for v in variants if v.product_id == ids[4])
            for status,days,items in [('paid',-1,[(first[0],2),(first[1],3)]),('paid',-1,[(second,8)]),
                ('pending',-1,[(first[0],99)]),('cancelled',-1,[(first[0],99)]),
                ('paid',-9,[(first[0],99)]),('paid',1,[(first[0],99)]),('paid',-1,[(hidden,999)])]:
                oid = await s.scalar(text("INSERT INTO orders(user_id,status,total_price,recipient_name,recipient_phone,address,paid_at) VALUES (:uid,:status,100,'Test','010','Test',now()+make_interval(days=>:days)) RETURNING id"),locals())
                for vid,qty in items:
                    await s.execute(text("INSERT INTO order_items(order_id,variant_id,product_name,option_name,unit_price,quantity) VALUES (:oid,:vid,'snapshot','A',1,:qty)"),locals())
            best = (await client.get('/products/best?days=7&limit=50')).json()
            assert [p['id'] for p in best[:2]] == [ids[1],ids[0]]
            assert ids[4] not in [p['id'] for p in best]
            assert [p['rank'] for p in best] == list(range(1,len(best)+1))
            assert len(best) == 5
            assert all(p['artist']['slug']=='alpha' for p in (await client.get('/products/best?artist=alpha')).json())
            assert (await client.get('/products/best?artist=missing')).json() == []
    asyncio.run(scenario())


@pytest.mark.parametrize('path', ['/products/best?days=0','/products/best?limit=51','/notices?limit=0','/notices/0'])
def test_discovery_validation(postgres_url,path):
    async def scenario():
        async with catalog_client(postgres_url) as (c,_,__,___):
            r = await c.get(path)
            assert r.status_code == 422 and set(r.json()) == {'code','message'}
    asyncio.run(scenario())


def test_artist_like_real_auth_idempotence_ownership_logout(postgres_url):
    async def scenario():
        async with wishlist_client(postgres_url) as (c,factory,users,ids):
            async with factory() as s:
                row = (await s.execute(text('SELECT a.id,a.slug FROM artists a JOIN products p ON p.artist_id=a.id WHERE p.id=:id'),{'id':ids[0]})).one()
            path = f'/artists/{row.slug}/like'
            for method in ['GET','PUT','DELETE']:
                assert (await c.request(method,path)).status_code == 401
            a,b = users
            for _ in range(2):
                r = await c.put(path,headers=a['headers'],json={'user_id':str(b['id'])})
                assert r.status_code == 200 and r.json()['count'] == 1
                assert r.headers['cache-control'] == 'private, no-store'
            assert (await c.get(path,headers=b['headers'])).json()['is_liked'] is False
            assert (await c.delete(path,headers=b['headers'])).json()['count'] == 1
            assert (await c.get('/artists/like-counts')).json()[str(row.id)] == 1
            for _ in range(2): assert (await c.delete(path,headers=a['headers'])).json()['count'] == 0
            assert (await c.put('/artists/missing/like',headers=a['headers'])).status_code == 404
            assert (await c.post('/auth/logout',headers=a['headers'])).status_code == 204
            assert (await c.put(path,headers=a['headers'])).status_code == 401
    asyncio.run(scenario())


def test_artist_like_concurrency_and_actual_failure_rollback(postgres_url):
    async def scenario():
        async with wishlist_client(postgres_url) as (c,factory,users,ids):
            async with factory() as s:
                slug = await s.scalar(text('SELECT a.slug FROM artists a JOIN products p ON p.artist_id=a.id WHERE p.id=:id'),{'id':ids[0]})
            path = f'/artists/{slug}/like'; user = users[0]
            results = await asyncio.gather(*(c.put(path,headers=user['headers']) for _ in range(8)))
            assert all(r.status_code==200 for r in results)
            async with factory() as s:
                assert await s.scalar(text('SELECT count(*) FROM artist_likes WHERE user_id=:u'),{'u':user['id']}) == 1
            results = await asyncio.gather(*(c.delete(path,headers=user['headers']) for _ in range(8)))
            assert all(r.status_code==200 for r in results)
            original = DiscoveryRepository.set_liked
            async def fail_after_save(repo,*args):
                await original(repo,*args)
                await repo.session.execute(text("UPDATE users SET role='invalid' WHERE id=:u"),{'u':user['id']})
            async with factory() as s:
                with patch.object(DiscoveryRepository,'set_liked',fail_after_save):
                    with pytest.raises(IntegrityError): await DiscoveryService(s).set_liked(user['id'],slug,True)
                assert await s.scalar(text('SELECT count(*) FROM artist_likes WHERE user_id=:u'),{'u':user['id']}) == 0
                await s.rollback()
                assert (await DiscoveryService(s).set_liked(user['id'],slug,True))['is_liked']
    asyncio.run(scenario())
