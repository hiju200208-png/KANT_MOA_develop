-- DB_DESIGN.md 6-3 RLS 정책

alter table public.profiles         enable row level security;
alter table public.artists          enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.product_variants enable row level security;
alter table public.cart_items       enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;

-- profiles: 본인만 조회/수정, 수정 가능한 컬럼은 nickname, phone으로 제한
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (nickname, phone) on public.profiles to authenticated;

-- 카탈로그: 누구나 조회만 가능. 쓰기 정책 없음 → 대시보드/seed SQL로만 관리
create policy "artists_select_all" on public.artists
  for select to anon, authenticated
  using (true);

create policy "categories_select_active" on public.categories
  for select to anon, authenticated
  using (is_active);

create policy "products_select_visible" on public.products
  for select to anon, authenticated
  using (status <> 'hidden');

create policy "product_images_select" on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.status <> 'hidden'
  ));

create policy "product_variants_select" on public.product_variants
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.status <> 'hidden'
  ));

-- 장바구니: 본인 것만 CRUD (구매 제한의 최종 검증은 pay_order에서)
create policy "cart_items_own" on public.cart_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 주문: 본인 것 조회만 허용. INSERT/UPDATE 정책 없음 → RPC로만 변경 가능
create policy "orders_select_own" on public.orders
  for select to authenticated
  using (user_id = auth.uid());

create policy "order_items_select_own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  ));
