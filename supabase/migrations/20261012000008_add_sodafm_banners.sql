-- SODAFM 배너 2종 추가 (팀원 제공). 기존 3종(멤버·앨범·응원봉)은 같은 경로에 이미지만 교체
-- 팬사인회는 별도 페이지가 없어 1st 미니앨범 상품으로 연결

insert into public.artist_banners (artist_id, image_path, title, subtitle, link_path, sort_order)
select a.id, v.image_path, v.title, v.subtitle, v.link_path, v.sort_order
from public.artists a,
(values
  ('sodafm/banners/fansign.webp',    'SODA FM 영상통화 팬사인회',   '자세한 내용 보러가기',
     '/products/' || (select id from public.products where thumbnail_path = 'sodafm/mini-album/main.webp'), 4),
  ('sodafm/banners/membership.webp', 'SODA FM MEMBERSHIP & KIT',  '공식 팬클럽 멤버십, 지금 바로 혜택을 확인하세요!',
     '/products/' || (select id from public.products where thumbnail_path = 'sodafm/membership-card/main.webp'), 5)
) as v(image_path, title, subtitle, link_path, sort_order)
where a.slug = 'sodafm';
