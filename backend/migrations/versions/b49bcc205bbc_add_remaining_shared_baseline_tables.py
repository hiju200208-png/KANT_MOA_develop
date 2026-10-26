"""add remaining shared baseline tables

Revision ID: b49bcc205bbc
Revises: cd2b7db3c89b
Create Date: 2026-10-26 17:07:05.490544
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b49bcc205bbc"
down_revision: Union[str, Sequence[str], None] = "cd2b7db3c89b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """기존 인증 테이블을 유지하고 나머지 업무 테이블을 생성합니다."""
    migration_sql = """
create table public.artists (
  id bigint generated always as identity primary key,
  name text not null,
  name_ko text not null,
  slug text not null unique,
  logo_path text,
  hero_image_path text,
  theme_color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  tagline text
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.products (
  id bigint generated always as identity primary key,
  artist_id bigint not null references public.artists(id),
  category_id bigint not null references public.categories(id),
  name text not null,
  description text,
  price int not null check (price >= 0),
  status text not null default 'on_sale'
    check (status in ('on_sale', 'sold_out', 'hidden')),
  thumbnail_path text,
  created_at timestamptz not null default now(),
  is_limited boolean not null default false,
  is_preorder boolean not null default false,
  release_date date
);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null
    references public.products(id) on delete cascade,
  image_path text not null,
  sort_order int not null default 0,
  kind text not null default 'detail'
    check (kind in ('gallery', 'detail'))
);

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null
    references public.products(id) on delete cascade,
  option_name text not null default '기본',
  extra_price int not null default 0 check (extra_price >= 0),
  stock int not null default 0 check (stock >= 0),
  max_per_user int default 4
    check (max_per_user is null or max_per_user > 0),
  sort_order int not null default 0,
  unique (product_id, option_name)
);

create table public.artist_members (
  id bigint generated always as identity primary key,
  artist_id bigint not null
    references public.artists(id) on delete cascade,
  name text not null,
  name_en text not null,
  position text,
  color text,
  mascot text,
  birthday date,
  mbti text,
  description text,
  tags text[] not null default '{}',
  image_path text,
  sort_order int not null default 0,
  unique (artist_id, name)
);

create table public.artist_banners (
  id bigint generated always as identity primary key,
  artist_id bigint not null
    references public.artists(id) on delete cascade,
  image_path text not null,
  title text not null,
  subtitle text,
  link_path text not null,
  sort_order int not null default 0
);

create table public.home_banners (
  id bigint generated always as identity primary key,
  slot text not null check (slot in ('main', 'side')),
  eyebrow text,
  title text not null,
  subtitle text,
  badge text,
  image_path text not null,
  link_path text not null,
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create table public.notices (
  id bigint generated always as identity primary key,
  artist_id bigint
    references public.artists(id) on delete cascade,
  title text not null,
  body text,
  product_id bigint
    references public.products(id) on delete set null,
  is_pinned boolean not null default false,
  show_in_topbar boolean not null default false,
  published_at timestamptz not null default now()
);

create table public.shop_settings (
  id boolean primary key default true check (id),
  free_shipping_threshold int not null
    check (free_shipping_threshold >= 0),
  shipping_fee int not null check (shipping_fee >= 0),
  ship_days_text text not null,
  company_name text not null,
  ceo_name text not null,
  business_number text not null,
  ecommerce_number text not null,
  address text not null,
  cs_phone text not null,
  cs_hours text not null
);

create table public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null
    references public.users(id) on delete cascade,
  variant_id bigint not null
    references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create table public.addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null
    references public.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  recipient_phone text not null,
  postal_code text not null,
  address1 text not null,
  address2 text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  total_price int not null check (total_price >= 0),
  recipient_name text not null,
  recipient_phone text not null,
  address text not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  shipping_fee int not null default 0 check (shipping_fee >= 0),
  is_direct boolean not null default false
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null
    references public.orders(id) on delete cascade,
  variant_id bigint not null
    references public.product_variants(id),
  product_name text not null,
  option_name text not null,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  unique (order_id, variant_id)
);

create table public.wishlists (
  user_id uuid not null
    references public.users(id) on delete cascade,
  product_id bigint not null
    references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.artist_likes (
  user_id uuid not null
    references public.users(id) on delete cascade,
  artist_id bigint not null
    references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;
"""

    # 이 고정 SQL에는 문자열이나 함수 내부의 세미콜론이 없습니다.
    # asyncpg에서 여러 명령을 한 번에 실행하지 않도록 분리합니다.
    for statement in migration_sql.split(";"):
        if statement.strip():
            op.execute(sa.text(statement))


def downgrade() -> None:
    """이 revision에서 추가한 업무 테이블만 제거합니다."""
    for table_name in (
        "artist_likes",
        "wishlists",
        "order_items",
        "orders",
        "addresses",
        "cart_items",
        "shop_settings",
        "notices",
        "home_banners",
        "artist_banners",
        "artist_members",
        "product_variants",
        "product_images",
        "products",
        "categories",
        "artists",
    ):
        op.drop_table(table_name, schema="public")