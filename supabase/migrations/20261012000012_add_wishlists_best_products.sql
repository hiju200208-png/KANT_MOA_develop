-- 리디자인 요청 (chungman): 찜하기, 인기 순위

-- 1) 찜: 본인 것만 조회·추가·삭제 (수정할 칸이 없어 update 정책 없음)
create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index on public.wishlists (product_id);

alter table public.wishlists enable row level security;

create policy "wishlists_select_own" on public.wishlists
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "wishlists_insert_own" on public.wishlists
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "wishlists_delete_own" on public.wishlists
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 2) 인기 순위: 최근 days일 동안 결제 완료(paid)된 수량 합계 순. 판매가 없거나 같으면 최신순으로 채움
-- orders/order_items는 본인 것만 읽히므로 security definer로 집계하고, 개인 정보 없이 상품 id와 순위만 돌려줌
create or replace function public.get_best_products(
  days int default 7,
  limit_count int default 8,
  artist_slug text default null
)
returns table (product_id bigint, rank int)
language sql
stable
security definer
set search_path = public
as $$
  with sold as (
    select pv.product_id, sum(oi.quantity) as quantity
    from order_items oi
    join orders o on o.id = oi.order_id
    join product_variants pv on pv.id = oi.variant_id
    where o.status = 'paid'
      and o.paid_at >= now() - make_interval(days => greatest(get_best_products.days, 1))
    group by pv.product_id
  )
  select p.id,
         (row_number() over (order by coalesce(s.quantity, 0) desc, p.created_at desc, p.id desc))::int
  from products p
  join artists a on a.id = p.artist_id
  left join sold s on s.product_id = p.id
  where p.status <> 'hidden'
    and (get_best_products.artist_slug is null or a.slug = get_best_products.artist_slug)
  order by 2
  limit least(greatest(get_best_products.limit_count, 1), 50);
$$;

revoke execute on function public.get_best_products(int, int, text) from public;
grant execute on function public.get_best_products(int, int, text) to anon, authenticated;
