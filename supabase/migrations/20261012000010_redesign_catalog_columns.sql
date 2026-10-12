-- 리디자인 요청 (chungman, docs/requests): 상품 배지·발매일, 아티스트 한 줄 소개, 상세 이미지 구분
-- 기존 칸은 건드리지 않고 추가만 함

-- 상품 배지: 한정·예약 판매, 발매일 (NEW 배지는 프론트에서 created_at으로 계산)
alter table public.products
  add column is_limited boolean not null default false,
  add column is_preorder boolean not null default false,
  add column release_date date;

-- 초기 값: 구매 제한 1~2개 상품은 한정, 예약 판매 공지가 있는 앨범은 예약 판매
update public.products p
set is_limited = true
where p.status <> 'hidden'
  and exists (select 1 from public.product_variants v where v.product_id = p.id and v.max_per_user <= 2);

update public.products
set is_preorder = true
where thumbnail_path in ('orbit-on/1st-mini-launch/main.webp', 'daylog/2nd-single-diary/main.webp', 'sodafm/mini-album/main.webp');

update public.products p
set release_date = v.release_date
from (values
  ('orbit-on/1st-mini-launch/main.webp', date '2026-10-16'),
  ('daylog/2nd-single-diary/main.webp',  date '2026-10-22'),
  ('daylog/2nd-ep-afterglow/main.webp',  date '2026-11-05'),
  ('sodafm/mini-album/main.webp',        date '2026-10-30')
) as v(thumbnail_path, release_date)
where p.thumbnail_path = v.thumbnail_path;

-- 아티스트 섹션 한 줄 소개
alter table public.artists add column tagline text;

update public.artists a
set tagline = v.tagline
from (values
  ('orbit-on', '다섯 개의 행성, 하나의 궤도'),
  ('daylog',   '평범한 하루도, 조금 더 특별하게'),
  ('sodafm',   '청량한 주파수로 너에게')
) as v(slug, tagline)
where a.slug = v.slug;

-- 상세 이미지 구분: gallery = 상세 상단 썸네일 갤러리, detail = 아래 긴 상세 이미지. 기존 행은 모두 detail
alter table public.product_images
  add column kind text not null default 'detail' check (kind in ('gallery', 'detail'));
