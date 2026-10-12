-- 배송비 실제 부과 (팀 결정): 상품 금액이 shop_settings.free_shipping_threshold 미만이면 shipping_fee 추가
-- orders.total_price = 상품 금액 + 배송비 (실제 결제 금액). 기존 주문은 배송비 0

alter table public.orders
  add column shipping_fee int not null default 0 check (shipping_fee >= 0);

-- create_order: 20261007000005와 같고, 배송비 계산만 추가
create or replace function public.create_order(
  p_recipient_name  text,
  p_recipient_phone text,
  p_address         text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_total    int;
  v_fee      int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from cart_items where user_id = v_uid) then
    raise exception 'CART_EMPTY';
  end if;

  -- 판매 중이 아니거나 재고가 부족한 항목 (사전 안내용 체크)
  if exists (
    select 1
    from cart_items c
    join product_variants pv on pv.id = c.variant_id
    join products p on p.id = pv.product_id
    where c.user_id = v_uid
      and (p.status <> 'on_sale' or pv.stock < c.quantity)
  ) then
    raise exception 'UNAVAILABLE_ITEM';
  end if;

  -- 구매 제한 초과 (사전 안내용 체크, 최종 검증은 pay_order)
  if exists (
    select 1
    from cart_items c
    join product_variants pv on pv.id = c.variant_id
    where c.user_id = v_uid
      and pv.max_per_user is not null
      and c.quantity + coalesce((
            select sum(oi.quantity)
            from order_items oi
            join orders o on o.id = oi.order_id
            where o.user_id = v_uid
              and o.status = 'paid'
              and oi.variant_id = c.variant_id
          ), 0) > pv.max_per_user
  ) then
    raise exception 'PURCHASE_LIMIT_EXCEEDED';
  end if;

  -- 가격은 클라이언트 값이 아닌 DB에서 계산
  select sum((p.price + pv.extra_price) * c.quantity)
    into v_total
  from cart_items c
  join product_variants pv on pv.id = c.variant_id
  join products p on p.id = pv.product_id
  where c.user_id = v_uid;

  -- 배송비 (설정이 없으면 0)
  select case when v_total >= s.free_shipping_threshold then 0 else s.shipping_fee end
    into v_fee
  from shop_settings s;
  v_fee := coalesce(v_fee, 0);

  insert into orders (user_id, total_price, shipping_fee, recipient_name, recipient_phone, address)
  values (v_uid, v_total + v_fee, v_fee, p_recipient_name, p_recipient_phone, p_address)
  returning id into v_order_id;

  insert into order_items (order_id, variant_id, product_name, option_name, unit_price, quantity)
  select v_order_id, pv.id, p.name, pv.option_name, p.price + pv.extra_price, c.quantity
  from cart_items c
  join product_variants pv on pv.id = c.variant_id
  join products p on p.id = pv.product_id
  where c.user_id = v_uid;

  return v_order_id;
end;
$$;
