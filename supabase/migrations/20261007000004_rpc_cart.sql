-- DB_DESIGN.md 6-4 merge_cart (비회원 장바구니 병합)

create or replace function public.merge_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item record;
  v_cap  int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  for v_item in
    select (e ->> 'variant_id')::bigint      as variant_id,
           sum((e ->> 'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    continue when v_item.quantity <= 0;

    -- 담을 수 있는 최대 수량 = min(재고, 옵션당 구매 제한)
    select least(pv.stock, coalesce(pv.max_per_user, pv.stock))
      into v_cap
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_item.variant_id
      and p.status = 'on_sale';

    continue when v_cap is null or v_cap <= 0;

    insert into cart_items (user_id, variant_id, quantity)
    values (v_uid, v_item.variant_id, least(v_item.quantity, v_cap))
    on conflict (user_id, variant_id)
    do update set quantity = least(cart_items.quantity + excluded.quantity, v_cap);
  end loop;
end;
$$;
