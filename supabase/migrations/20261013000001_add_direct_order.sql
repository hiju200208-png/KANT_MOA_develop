-- 바로 구매: 장바구니를 거치지 않고 옵션 하나만 주문한다.
-- orders.is_direct = true 인 주문은 결제해도 장바구니를 건드리지 않는다.

alter table public.orders
  add column is_direct boolean not null default false;

-- create_direct_order: create_order(20261012000013)와 같은 검증·가격·배송비 규칙을 옵션 하나에 적용
create or replace function public.create_direct_order(
  p_variant_id      bigint,
  p_quantity        int,
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
  v_name     text;
  v_option   text;
  v_price    int;
  v_stock    int;
  v_max      int;
  v_status   text;
  v_bought   int;
  v_total    int;
  v_fee      int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'INVALID_ORDER';
  end if;

  select p.name, pv.option_name, p.price + pv.extra_price, pv.stock, pv.max_per_user, p.status
    into v_name, v_option, v_price, v_stock, v_max, v_status
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  -- 판매 중이 아니거나 재고가 부족함 (사전 안내용 체크)
  if v_name is null or v_status <> 'on_sale' or v_stock < p_quantity then
    raise exception 'UNAVAILABLE_ITEM';
  end if;

  -- 구매 제한 초과 (사전 안내용 체크, 최종 검증은 pay_order)
  if v_max is not null then
    select coalesce(sum(oi.quantity), 0)
      into v_bought
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.user_id = v_uid
      and o.status = 'paid'
      and oi.variant_id = p_variant_id;

    if v_bought + p_quantity > v_max then
      raise exception 'PURCHASE_LIMIT_EXCEEDED';
    end if;
  end if;

  v_total := v_price * p_quantity;

  -- 배송비 (설정이 없으면 0)
  select case when v_total >= s.free_shipping_threshold then 0 else s.shipping_fee end
    into v_fee
  from shop_settings s;
  v_fee := coalesce(v_fee, 0);

  insert into orders (user_id, total_price, shipping_fee, recipient_name, recipient_phone, address, is_direct)
  values (v_uid, v_total + v_fee, v_fee, p_recipient_name, p_recipient_phone, p_address, true)
  returning id into v_order_id;

  insert into order_items (order_id, variant_id, product_name, option_name, unit_price, quantity)
  values (v_order_id, p_variant_id, v_name, v_option, v_price, p_quantity);

  return v_order_id;
end;
$$;

-- pay_order: 20261007000005와 같고, 바로 구매 주문이면 장바구니를 비우지 않는 것만 다름
create or replace function public.pay_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_item      record;
  v_bought    int;
  v_is_direct boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 같은 사용자의 동시 결제를 직렬화 (구매 제한 우회 방지)
  perform 1 from profiles where id = v_uid for update;

  -- 본인의 pending 주문인지 확인 + 잠금 (결제 버튼 연타 방지)
  select is_direct into v_is_direct from orders
  where id = p_order_id and user_id = v_uid and status = 'pending'
  for update;

  if not found then
    raise exception 'INVALID_ORDER';
  end if;

  -- variant_id 순서로 처리해 여러 결제 간 잠금 순서를 고정 (데드락 방지)
  for v_item in
    select oi.variant_id, oi.quantity, pv.max_per_user
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    where oi.order_id = p_order_id
    order by oi.variant_id
  loop
    -- 옵션당 구매 제한
    if v_item.max_per_user is not null then
      select coalesce(sum(oi.quantity), 0)
        into v_bought
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.user_id = v_uid
        and o.status = 'paid'
        and oi.variant_id = v_item.variant_id;

      if v_bought + v_item.quantity > v_item.max_per_user then
        raise exception 'PURCHASE_LIMIT_EXCEEDED'
          using detail = v_item.variant_id::text;
      end if;
    end if;

    -- 조건부 재고 차감 (동시 결제에도 음수 재고 방지)
    update product_variants
    set stock = stock - v_item.quantity
    where id = v_item.variant_id
      and stock >= v_item.quantity;

    if not found then
      raise exception 'OUT_OF_STOCK'
        using detail = v_item.variant_id::text;
    end if;
  end loop;

  update orders
  set status = 'paid', paid_at = now()
  where id = p_order_id;

  -- 장바구니 주문이면 결제된 옵션만 장바구니에서 제거 (바로 구매는 장바구니 유지)
  if not v_is_direct then
    delete from cart_items
    where user_id = v_uid
      and variant_id in (
        select variant_id from order_items where order_id = p_order_id
      );
  end if;
end;
$$;

revoke execute on function public.create_direct_order(bigint, int, text, text, text) from public, anon;
grant  execute on function public.create_direct_order(bigint, int, text, text, text) to authenticated;
