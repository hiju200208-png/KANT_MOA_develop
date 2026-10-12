-- 아티스트 페이지 상단 배너 (선택). 등록된 배너가 있으면 그것을 보여주고, 없으면 기존처럼 hero + 최신 상품으로 구성
-- 이미지: artists 버킷 <artist-slug>/banners/<이름>.webp (16:9, 글씨 없는 배경 이미지. 제목·부제는 화면이 위에 그림)

create table public.artist_banners (
  id bigint generated always as identity primary key,
  artist_id bigint not null references public.artists(id) on delete cascade,
  image_path text not null,
  title text not null,
  subtitle text,
  link_path text not null,      -- 클릭 시 이동할 사이트 내부 경로 ('/products/17' 등)
  sort_order int not null default 0
);

create index on public.artist_banners (artist_id);

alter table public.artist_banners enable row level security;

create policy "artist_banners_select_all" on public.artist_banners
  for select to anon, authenticated
  using (true);

-- SODAFM 배너 3종
insert into public.artist_banners (artist_id, image_path, title, subtitle, link_path, sort_order)
select a.id, v.image_path, v.title, v.subtitle, v.link_path, v.sort_order
from public.artists a,
(values
  ('sodafm/banners/members.webp',    'SODA FM',                               '소다에프엠 멤버 소개 보기 ›',          '/artists/sodafm/about', 1),
  ('sodafm/banners/album.webp',      'SODA FM 1st Mini Album ''청량한 너에게''', 'KANT MOA에서 예약 판매 중!',
     '/products/' || (select id from public.products where thumbnail_path = 'sodafm/mini-album/main.webp'), 2),
  ('sodafm/banners/lightstick.webp', 'SODA FM ''STAR BUBBLES''',              '공식 응원봉, 지금 바로 KANT MOA에서!',
     '/products/' || (select id from public.products where thumbnail_path = 'sodafm/light-stick/main.webp'), 3)
) as v(image_path, title, subtitle, link_path, sort_order)
where a.slug = 'sodafm';
