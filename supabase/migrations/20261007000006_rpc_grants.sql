-- DB_DESIGN.md 6-8 함수 실행 권한

revoke execute on function public.merge_cart(jsonb)              from public, anon;
revoke execute on function public.create_order(text, text, text) from public, anon;
revoke execute on function public.pay_order(uuid)                from public, anon;
revoke execute on function public.cancel_order(uuid)             from public, anon;

grant execute on function public.merge_cart(jsonb)              to authenticated;
grant execute on function public.create_order(text, text, text) to authenticated;
grant execute on function public.pay_order(uuid)                to authenticated;
grant execute on function public.cancel_order(uuid)             to authenticated;
