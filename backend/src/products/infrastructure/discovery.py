from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from products.infrastructure.catalog import CatalogRepository
from products.infrastructure.models import ProductModel


class DiscoveryRepository:
    """기존 카탈로그 테이블 조회. SQL 값은 바인딩하고 commit은 호출자가 소유한다."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def rows(self, sql, **params):
        return [dict(row) for row in (await self.session.execute(text(sql), params)).mappings()]

    async def artists(self):
        return await self.rows('SELECT * FROM artists ORDER BY sort_order,id')

    async def artist(self, slug):
        rows = await self.rows('SELECT * FROM artists WHERE slug=:slug', slug=slug)
        return rows[0] if rows else None

    async def members(self, slug):
        return await self.rows('''SELECT m.* FROM artist_members m JOIN artists a ON a.id=m.artist_id
            WHERE a.slug=:slug ORDER BY m.sort_order,m.id''', slug=slug)

    async def banners(self, slug):
        return await self.rows('''SELECT b.* FROM artist_banners b JOIN artists a ON a.id=b.artist_id
            WHERE a.slug=:slug ORDER BY b.sort_order,b.id''', slug=slug)

    async def home_banners(self):
        return await self.rows('''SELECT * FROM home_banners WHERE is_active
            AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())
            ORDER BY sort_order,id''')

    async def notices(self, *, artist=None, limit=20, notice_id=None, topbar=False):
        # Only fixed SQL fragments are composed. All request values remain bound.
        where = ['n.published_at<=now()']
        params = {'limit':limit}
        if artist is not None:
            where.append('a.slug=:artist'); params['artist'] = artist
        if notice_id is not None:
            where.append('n.id=:id'); params['id'] = notice_id
        if topbar: where.append('n.show_in_topbar')
        order = 'n.published_at DESC,n.id DESC' if topbar else 'n.is_pinned DESC,n.published_at DESC,n.id DESC'
        return await self.rows('''SELECT n.id,n.title,n.body,n.is_pinned,n.show_in_topbar,n.published_at,
            a.slug AS artist_slug,CASE WHEN p.status IN ('on_sale','sold_out') THEN n.product_id END AS product_id
            FROM notices n LEFT JOIN artists a ON a.id=n.artist_id LEFT JOIN products p ON p.id=n.product_id
            WHERE ''' + ' AND '.join(where) + ' ORDER BY ' + order + ' LIMIT :limit', **params)

    async def settings(self):
        rows = await self.rows('SELECT * FROM shop_settings WHERE id=true')
        return rows[0] if rows else None

    async def best(self, days, limit, artist):
        ranks = await self.rows('''WITH sold AS (
            SELECT v.product_id,sum(i.quantity) AS quantity FROM order_items i
            JOIN orders o ON o.id=i.order_id JOIN product_variants v ON v.id=i.variant_id
            WHERE o.status='paid' AND o.paid_at>=now()-make_interval(days=>:days) AND o.paid_at<=now()
            GROUP BY v.product_id)
            SELECT p.id FROM products p JOIN artists a ON a.id=p.artist_id
            LEFT JOIN sold s ON s.product_id=p.id
            WHERE p.status IN ('on_sale','sold_out') AND (CAST(:artist AS text) IS NULL OR a.slug=:artist)
            ORDER BY coalesce(s.quantity,0) DESC,p.created_at DESC,p.id DESC LIMIT :limit''',
            days=days, limit=limit, artist=artist)
        ids = [r['id'] for r in ranks]
        if not ids: return []
        catalog = CatalogRepository(self.session)
        rows = (await self.session.execute(catalog.visible_query().where(ProductModel.id.in_(ids)))).all()
        products = {p.id:p for p in await catalog.to_products(rows)}
        return [products[id_] for id_ in ids if id_ in products]

    async def like_counts(self):
        return await self.rows('SELECT artist_id,count(*) AS count FROM artist_likes GROUP BY artist_id ORDER BY artist_id')

    async def liked(self, user_id, artist_id):
        return bool(await self.session.scalar(text('SELECT EXISTS(SELECT 1 FROM artist_likes WHERE user_id=:u AND artist_id=:a)'), {'u':user_id,'a':artist_id}))

    async def set_liked(self, user_id, artist_id, liked):
        if liked:
            # Protect existence until commit, without serializing concurrent adds.
            if await self.session.scalar(text('SELECT id FROM artists WHERE id=:a FOR SHARE'), {'a':artist_id}) is None:
                raise LookupError('아티스트를 찾을 수 없어요.')
            sql = '''INSERT INTO artist_likes(user_id,artist_id) VALUES (:u,:a)
                ON CONFLICT (user_id,artist_id) DO NOTHING'''
        else:
            sql = 'DELETE FROM artist_likes WHERE user_id=:u AND artist_id=:a'
        await self.session.execute(text(sql), {'u':user_id,'a':artist_id})
        return await self.session.scalar(text('SELECT count(*) FROM artist_likes WHERE artist_id=:a'), {'a':artist_id})
