-- DB_DESIGN.md 6-5 create_order, 6-6 pay_order, 6-7 cancel_order

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

  insert into orders (user_id, total_price, recipient_name, recipient_phone, address)
  values (v_uid, v_total, p_recipient_name, p_recipient_phone, p_address)
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

create or replace function public.pay_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_item   record;
  v_bought int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 같은 사용자의 동시 결제를 직렬화 (구매 제한 우회 방지)
  perform 1 from profiles where id = v_uid for update;

  -- 본인의 pending 주문인지 확인 + 잠금 (결제 버튼 연타 방지)
  perform 1 from orders
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

  -- 결제된 옵션만 장바구니에서 제거
  delete from cart_items
  where user_id = v_uid
    and variant_id in (
      select variant_id from order_items where order_id = p_order_id
    );
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select status into v_status
  from orders
  where id = p_order_id and user_id = v_uid
  for update;

  if v_status is null then
    raise exception 'INVALID_ORDER';
  end if;

  if v_status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED';
  end if;

  -- paid였던 주문만 재고 복구
  if v_status = 'paid' then
    update product_variants pv
    set stock = pv.stock + oi.quantity
    from order_items oi
    where oi.order_id = p_order_id
      and pv.id = oi.variant_id;
  end if;

  update orders
  set status = 'cancelled', cancelled_at = now()
  where id = p_order_id;
end;
$$;
