-- 배송지 (마이페이지 주소 관리, 주문서 기본 배송지 자동 입력)
-- 주문은 기존처럼 주소 문자열을 스냅샷으로 저장하므로 orders와 FK 없음

create table public.addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,                 -- '집', '회사' 등
  recipient_name text not null,
  recipient_phone text not null,
  postal_code text not null,
  address1 text not null,     -- 기본주소
  address2 text,              -- 상세주소
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.addresses (user_id);
-- 사용자당 기본 배송지는 1개
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;

create policy "addresses_own" on public.addresses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- is_default는 직접 수정 불가 → set_default_address RPC로만 변경 (기본 배송지가 0개가 되는 것 방지)
revoke update on public.addresses from authenticated;
grant update (label, recipient_name, recipient_phone, postal_code, address1, address2)
  on public.addresses to authenticated;

-- 첫 주소는 자동으로 기본 배송지
create or replace function public.addresses_default_first()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from addresses where user_id = new.user_id) then
    new.is_default := true;
  end if;
  return new;
end;
$$;

create trigger addresses_default_first
before insert on public.addresses
for each row execute function public.addresses_default_first();

-- 기본 배송지를 지우면 남은 것 중 최신 주소를 기본으로
create or replace function public.addresses_reassign_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update addresses set is_default = true
    where id = (
      select id from addresses
      where user_id = old.user_id
      order by created_at desc, id desc
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger addresses_reassign_default
after delete on public.addresses
for each row execute function public.addresses_reassign_default();

-- 기본 배송지 변경: 기존 해제 + 새로 지정을 한 트랜잭션으로
-- (유니크 인덱스가 행 단위로 즉시 검사되므로 해제를 먼저 한 뒤 지정)
create or replace function public.set_default_address(p_address_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update addresses set is_default = false
  where user_id = v_uid and is_default and id <> p_address_id;

  update addresses set is_default = true
  where id = p_address_id and user_id = v_uid;

  if not found then
    raise exception 'INVALID_ADDRESS';  -- 본인 주소가 아님 → 위 해제도 롤백
  end if;
end;
$$;

revoke execute on function public.set_default_address(bigint) from public, anon;
grant execute on function public.set_default_address(bigint) to authenticated;
