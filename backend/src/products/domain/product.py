from dataclasses import dataclass, field
from datetime import date, datetime

from products.domain.variant import ProductVariant


class ProductNotFound(LookupError):
    pass


@dataclass(frozen=True)
class Product:
    id: int
    name: str
    price: int
    status: str
    thumbnail_path: str | None
    created_at: datetime
    is_limited: bool
    is_preorder: bool
    release_date: date | None
    artist_slug: str
    artist_name: str
    artist_name_ko: str
    category_slug: str
    category_name: str
    description: str | None
    variants: list[ProductVariant] = field(default_factory=list)
    images: list[tuple[str, str]] = field(default_factory=list)

    @property
    def is_sold_out(self) -> bool:
        return self.status == "sold_out" or not any(v.stock > 0 for v in self.variants)

    @property
    def has_options(self) -> bool:
        return not (len(self.variants) == 1 and self.variants[0].option_name == "기본")
