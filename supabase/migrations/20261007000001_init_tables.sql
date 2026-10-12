-- DB_DESIGN.md 6-1 테이블 + 인덱스

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  phone text,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  image_path text not null,  -- products 버킷 내 경로
  sort_order int not null default 0
);

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  option_name text not null default '기본',
  extra_price int not null default 0 check (extra_price >= 0),
  stock int not null default 0 check (stock >= 0),
  max_per_user int check (max_per_user is null or max_per_user > 0),
  sort_order int not null default 0,
  unique (product_id, option_name)
);

create table public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  variant_id bigint not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  total_price int not null check (total_price >= 0),
  recipient_name text not null,
  recipient_phone text not null,
  address text not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
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

create index on public.products (artist_id);
create index on public.products (category_id);
create index on public.product_variants (product_id);
create index on public.orders (user_id, status);
create index on public.order_items (variant_id);
