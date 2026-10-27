from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from products.domain.product import Product
from products.domain.variant import ProductVariant
from products.infrastructure.models import ArtistModel, CategoryModel, ProductImageModel, ProductModel, ProductVariantModel


class CatalogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def visible_query():
        return (select(ProductModel, ArtistModel, CategoryModel)
                .join(ArtistModel, ProductModel.artist_id == ArtistModel.id)
                .join(CategoryModel, ProductModel.category_id == CategoryModel.id)
                .where(ProductModel.status != "hidden"))

    async def to_products(self, rows, *, detail=False) -> list[Product]:
        if not rows:
            return []
        ids = [row[0].id for row in rows]
        variants = {id_: [] for id_ in ids}
        for row in await self.session.scalars(
            select(ProductVariantModel).where(ProductVariantModel.product_id.in_(ids))
            .order_by(ProductVariantModel.sort_order, ProductVariantModel.id)
        ):
            variants[row.product_id].append(ProductVariant(
                id=row.id, product_id=row.product_id, stock=row.stock,
                option_name=row.option_name, extra_price=row.extra_price,
                max_per_user=row.max_per_user, sort_order=row.sort_order,
            ))
        images = {id_: [] for id_ in ids}
        if detail:
            for row in await self.session.scalars(
                select(ProductImageModel).where(ProductImageModel.product_id.in_(ids))
                .order_by(ProductImageModel.sort_order, ProductImageModel.id)
            ):
                images[row.product_id].append((row.kind, row.image_path))
        return [Product(
            id=p.id, name=p.name, price=p.price, status=p.status,
            thumbnail_path=p.thumbnail_path, created_at=p.created_at,
            is_limited=p.is_limited, is_preorder=p.is_preorder, release_date=p.release_date,
            artist_slug=a.slug, artist_name=a.name, artist_name_ko=a.name_ko,
            category_slug=c.slug, category_name=c.name, description=p.description,
            variants=variants[p.id], images=images[p.id],
        ) for p, a, c in rows]

    async def list_products(self, *, page=1, size=20, q=None, artist=None, category=None,
                            sort="latest", exclude_id=None):
        query = self.visible_query()
        if q is not None:
            keyword = q.strip()
            if not keyword:
                return [], 0
            # '%'·'_'도 검색어 문자로 처리. SQL 인젝션 없이 바인딩한다.
            keyword = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{keyword}%"
            query = query.where(or_(ProductModel.name.ilike(pattern, escape="\\"),
                                    ArtistModel.name.ilike(pattern, escape="\\"),
                                    ArtistModel.name_ko.ilike(pattern, escape="\\")))
        if artist:
            query = query.where(ArtistModel.slug == artist)
        if category:
            query = query.where(CategoryModel.slug == category)
        if exclude_id is not None:
            query = query.where(ProductModel.id != exclude_id)
        total = await self.session.scalar(select(func.count()).select_from(query.subquery()))
        order = {
            "latest": (ProductModel.created_at.desc(), ProductModel.id.desc()),
            "price_asc": (ProductModel.price.asc(), ProductModel.id.asc()),
            "price_desc": (ProductModel.price.desc(), ProductModel.id.asc()),
        }[sort]
        rows = (await self.session.execute(query.order_by(*order).offset((page - 1) * size).limit(size))).all()
        return await self.to_products(rows), total

    async def get_product(self, product_id: int) -> Product | None:
        rows = (await self.session.execute(self.visible_query().where(ProductModel.id == product_id))).all()
        products = await self.to_products(rows, detail=True)
        return products[0] if products else None

    async def categories(self):
        return list(await self.session.scalars(
            select(CategoryModel).where(CategoryModel.is_active.is_(True))
            .order_by(CategoryModel.sort_order, CategoryModel.id)
        ))
