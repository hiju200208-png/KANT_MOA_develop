-- 아티스트 좋아요 (chungman 요청): 로그인 사용자가 아티스트에 좋아요. 좋아요 수는 비로그인도 볼 수 있음

create table public.artist_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id bigint not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index on public.artist_likes (artist_id);

alter table public.artist_likes enable row level security;

-- 본인 것만 조회·추가·삭제 (수정은 할 일이 없어 정책 없음)
create policy "artist_likes_select_own" on public.artist_likes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "artist_likes_insert_own" on public.artist_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "artist_likes_delete_own" on public.artist_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 아티스트별 좋아요 수. RLS 때문에 남의 좋아요는 직접 못 읽으므로 security definer로 집계하고,
-- 누가 눌렀는지는 빼고 (artist_id, like_count)만 돌려준다. 좋아요가 0인 아티스트는 결과에 없음
create or replace function public.get_artist_like_counts()
returns table (artist_id bigint, like_count int)
language sql
stable
security definer
set search_path = public
as $$
  select l.artist_id, count(*)::int
  from artist_likes l
  group by l.artist_id;
$$;

revoke execute on function public.get_artist_like_counts() from public;
grant execute on function public.get_artist_like_counts() to anon, authenticated;
