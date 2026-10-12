-- 보안 어드바이저: 트리거 전용 SECURITY DEFINER 함수가 /rest/v1/rpc 로 노출되지 않게 실행 권한 회수
-- (트리거·이벤트 트리거는 호출자 EXECUTE 권한 없이도 동작함)
-- rls_auto_enable: Supabase 프로젝트 생성 시 만들어진 이벤트 트리거(ensure_rls) 함수

revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.addresses_default_first()    from public, anon, authenticated;
revoke execute on function public.addresses_reassign_default() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()            from public, anon, authenticated;
