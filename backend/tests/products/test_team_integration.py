"""P2/P3/P4 actual-token API integration. Only fixture-owned Docker PostgreSQL."""
import asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from orders.infrastructure.order_repository import OrderRepository
from test_wishlist import wishlist_client

RECIPIENT = {'recipient_name':'Local Review', 'recipient_phone':'010-1234-5678', 'address':'Local review address building 101'}


@asynccontextmanager
async def team_client(url, *, stock=10, purchase_limit=4):
    async with wishlist_client(url) as (client,factory,users,products):
        try:
            async with factory() as s:
                variants = list(await s.scalars(text('SELECT id FROM product_variants WHERE product_id=:p ORDER BY id'), {'p':products[0]}))
                await s.execute(text('UPDATE product_variants SET stock=:stock,max_per_user=:limit WHERE product_id=:p'), {'stock':stock,'limit':purchase_limit,'p':products[0]})
                # Existing P1 token must consult DB role, not a fabricated admin JWT.
                await s.execute(text("UPDATE users SET role='ADMIN' WHERE id=:u"), {'u':users[1]['id']})
                await s.commit()
            yield client,factory,users,products,variants
        finally:
            # Fixture users cannot be deleted while orders still reference them.
            async with factory() as s:
                for user in users:
                    await s.execute(text('DELETE FROM orders WHERE user_id=:u'), {'u':user['id']})
                await s.commit()


async def scalar(factory,sql,**params):
    async with factory() as s: return await s.scalar(text(sql),params)


async def create_order(client,user,variant,quantity=1):
    r = await client.post('/orders/direct',headers=user['headers'],json={**RECIPIENT,'variant_id':variant,'quantity':quantity})
    assert r.status_code == 201, r.text
    return r.json()['id']


def stock_path(product,variant):
    return f'/admin/products/{product}/variants/{variant}/stock-adjustments'


def test_same_option_payment_and_admin_adjustment_keep_both_changes(postgres_url):
    async def scenario():
        async with team_client(postgres_url) as (c,f,users,p,v):
            buyer,admin = users
            order = await create_order(c,buyer,v[0],2)
            pay,adjust = await asyncio.wait_for(asyncio.gather(
                c.post(f'/orders/{order}/pay',headers=buyer['headers']),
                c.post(stock_path(p[0],v[0]),headers=admin['headers'],json={'change':5}),
            ),10)
            assert (pay.status_code,adjust.status_code)==(200,200)
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0]) == 13  # 10 - 2 + 5
            await c.post(f'/orders/{order}/cancel',headers=buyer['headers'])
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0]) == 15
    asyncio.run(scenario())


def test_last_stock_race_admin_and_order_never_goes_negative(postgres_url):
    async def scenario():
        async with team_client(postgres_url,stock=1) as (c,f,users,p,v):
            buyer,admin = users
            order = await create_order(c,buyer,v[0])
            pay,adjust = await asyncio.wait_for(asyncio.gather(
                c.post(f'/orders/{order}/pay',headers=buyer['headers']),
                c.post(stock_path(p[0],v[0]),headers=admin['headers'],json={'change':-1}),
            ),10)
            assert sorted([pay.status_code,adjust.status_code])==[200,409]
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0]) == 0
            expected = 'paid' if pay.status_code==200 else 'pending'
            assert await scalar(f,'SELECT status FROM orders WHERE id=CAST(:id AS uuid)',id=order)==expected
    asyncio.run(scenario())


def test_payment_write_error_rolls_back_stock_order_cart_and_allows_retry(postgres_url):
    async def scenario():
        async with team_client(postgres_url) as (c,f,users,p,v):
            buyer = users[0]
            for variant in v:
                assert (await c.post('/cart/items',headers=buyer['headers'],json={'variant_id':variant,'quantity':1})).status_code==200
            r = await c.post('/orders',headers=buyer['headers'],json=RECIPIENT)
            assert r.status_code==201,r.text
            order = r.json()['id']
            original = OrderRepository.save_status
            async def fail_after_save(repo,obj):
                await original(repo,obj)
                await repo._session.execute(text("UPDATE orders SET status='invalid' WHERE id=:id"),{'id':obj.id})
            with patch.object(OrderRepository,'save_status',fail_after_save):
                with pytest.raises(IntegrityError):
                    await c.post(f'/orders/{order}/pay',headers=buyer['headers'])
            assert await scalar(f,'SELECT sum(stock) FROM product_variants WHERE product_id=:p',p=p[0])==20
            assert await scalar(f,'SELECT status FROM orders WHERE id=CAST(:id AS uuid)',id=order)=='pending'
            assert await scalar(f,'SELECT paid_at IS NULL FROM orders WHERE id=CAST(:id AS uuid)',id=order)
            assert await scalar(f,'SELECT count(*) FROM cart_items WHERE user_id=:u',u=buyer['id'])==2
            assert (await c.post(f'/orders/{order}/pay',headers=buyer['headers'])).status_code==200
            assert await scalar(f,'SELECT sum(stock) FROM product_variants WHERE product_id=:p',p=p[0])==18
    asyncio.run(scenario())


def test_admin_status_auth_purchase_limit_and_hidden_cancel_contract(postgres_url):
    async def scenario():
        async with team_client(postgres_url,purchase_limit=2) as (c,f,users,p,v):
            buyer,admin = users
            assert (await c.get('/admin/products',headers=buyer['headers'])).status_code==403
            assert (await c.get('/admin/products')).status_code==401
            order = await create_order(c,buyer,v[0],2)
            assert (await c.post(f'/orders/{order}/pay',headers=buyer['headers'])).status_code==200
            denied = await c.post('/orders/direct',headers=buyer['headers'],json={**RECIPIENT,'variant_id':v[0],'quantity':1})
            assert (denied.status_code,denied.json()['code'])==(409,'PURCHASE_LIMIT_EXCEEDED')
            assert (await c.patch(f'/admin/products/{p[0]}',headers=admin['headers'],json={'status':'hidden'})).status_code==200
            assert (await c.get(f'/products/{p[0]}')).status_code==404
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0])==8
            assert (await c.post(f'/orders/{order}/cancel',headers=buyer['headers'])).status_code==200
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0])==10
            assert await scalar(f,'SELECT status FROM products WHERE id=:p',p=p[0])=='hidden'
            assert (await c.post(f'/orders/{order}/cancel',headers=buyer['headers'])).status_code==409
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0])==10
            assert (await c.patch(f'/admin/products/{p[0]}',headers=admin['headers'],json={'status':'on_sale'})).status_code==200
            # Cancelled orders no longer consume the option purchase limit.
            await create_order(c,buyer,v[0],2)
            before = await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0])
            assert (await c.post(stock_path(p[0],v[0]),headers=admin['headers'],json={'change':-999})).status_code==409
            assert (await c.post(stock_path(p[1],v[0]),headers=admin['headers'],json={'change':1})).status_code==404
            assert (await c.patch(f'/admin/products/{p[0]}',headers=admin['headers'],json={'status':'invalid'})).status_code==422
            assert await scalar(f,'SELECT stock FROM product_variants WHERE id=:id',id=v[0])==before
    asyncio.run(scenario())
