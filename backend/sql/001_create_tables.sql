-- KANT-MOA shared PostgreSQL: tables only, draft pending P1 auth agreement.
-- Run once against the intended empty database with psql -v ON_ERROR_STOP=1 -f <file>.
-- PostgreSQL 13+; uses the existing public schema. No database/role creation.
-- Source: supabase/migrations (all CREATE TABLE + later column/default changes).
-- profiles is replaced by users; google_sub/password_hash are nullable for now.
-- P1 must confirm Google-only vs password login before this draft is applied.
-- Existing tables cause failure; transaction rolls back without overwriting data.
-- No seeds, RPC, auth triggers, Supabase RLS/GRANT, or row-lock implementation.
-- PK/FK/UNIQUE/CHECK/defaults are baseline data integrity, not API business logic.

BEGIN;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique,
  email text not null unique,
  password_hash text,
  nickname text not null,
  phone text,
  role text not null default 'USER' check (role in ('USER', 'ADMIN')),
  created_at timestamptz not null default now()
);

create table public.token_blacklist (
  jti text primary key,
  expires_at timestamptz not null
);

create table public.artists (
  id bigint generated always as identity primary key,
  name text not null,
  name_ko text not null,
  slug text not null unique,
  logo_path text,          -- artists 버킷 내 경로
  hero_image_path text,    -- artists 버킷 내 경로 (아티스트 페이지 배경)
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
  thumbnail_path text,     -- products 버킷 내 경로
  created_at timestamptz not null default now(),
  is_limited boolean not null default false,
  is_preorder boolean not null default false,
  release_date date
);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  image_path text not null,  -- products 버킷 내 경로
  sort_order int not null default 0,
  kind text not null default 'detail' check (kind in ('gallery', 'detail'))
);

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  option_name text not null default '기본',
  extra_price int not null default 0 check (extra_price >= 0),
  stock int not null default 0 check (stock >= 0),
  max_per_user int default 4 check (max_per_user is null or max_per_user > 0),
  sort_order int not null default 0,
  unique (product_id, option_name)
);

create table public.artist_members (
  id bigint generated always as identity primary key,
  artist_id bigint not null references public.artists(id) on delete cascade,
  name text not null,            -- '선우' (상품 옵션명과 동일)
  name_en text not null,         -- 'SUNWOO' (이미지 파일명: 소문자)
  position text,
  color text,                    -- 멤버 컬러 '#FF8A3D'
  mascot text,
  birthday date,
  mbti text,
  description text,              -- 한 줄 소개
  tags text[] not null default '{}',
  image_path text,               -- artists 버킷 내 경로: <artist-slug>/members/<name_en 소문자>.webp
  sort_order int not null default 0,
  unique (artist_id, name)
);

create table public.artist_banners (
  id bigint generated always as identity primary key,
  artist_id bigint not null references public.artists(id) on delete cascade,
  image_path text not null,
  title text not null,
  subtitle text,
  link_path text not null,      -- 클릭 시 이동할 사이트 내부 경로 ('/products/17' 등)
  sort_order int not null default 0
);

create table public.home_banners (
  id bigint generated always as identity primary key,
  slot text not null check (slot in ('main', 'side')),
  eyebrow text,                  -- 작은 윗글 ('ORBIT:ON · 1ST MINI ALBUM')
  title text not null,
  subtitle text,
  badge text,                    -- 작은 카드 배지 ('1인 2개 한정', '예약 판매')
  image_path text not null,
  link_path text not null,       -- 사이트 내부 경로 ('/products/12')
  sort_order int not null default 0,
  starts_at timestamptz,         -- 비우면 바로 노출
  ends_at timestamptz,           -- 비우면 계속 노출
  is_active boolean not null default true
);

create table public.notices (
  id bigint generated always as identity primary key,
  artist_id bigint references public.artists(id) on delete cascade,
  title text not null,
  body text,
  product_id bigint references public.products(id) on delete set null, -- 상세 하단 "상품 보러가기"
  is_pinned boolean not null default false,
  show_in_topbar boolean not null default false,
  published_at timestamptz not null default now()
);

create table public.shop_settings (
  id boolean primary key default true check (id), -- 항상 true → 한 줄만 존재
  free_shipping_threshold int not null check (free_shipping_threshold >= 0), -- 상품 금액이 이 이상이면 무료배송
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
  user_id uuid not null references public.users(id) on delete cascade,
  variant_id bigint not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create table public.addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  label text,                 -- '집', '회사' 등
  recipient_name text not null,
  recipient_phone text not null,
  postal_code text not null,
  address1 text not null,     -- 기본주소
  address2 text,              -- 상세주소
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
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id bigint not null references public.product_variants(id),
  product_name text not null,
  option_name text not null,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  unique (order_id, variant_id)
);

create table public.wishlists (
  user_id uuid not null references public.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.artist_likes (
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id bigint not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

-- Preserve the existing at-most-one-default-address invariant.
create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

COMMIT;
