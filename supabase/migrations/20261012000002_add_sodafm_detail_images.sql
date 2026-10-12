-- SODAFM 상세 이미지 연결 (슬로건 타올은 이미 있음). 이미지는 Storage products/sodafm/<상품>/detail-1.webp

insert into public.product_images (product_id, image_path, sort_order)
select p.id, p_path.image_path, 1
from (values
  ('sodafm/acrylic-keyring/main.webp',  'sodafm/acrylic-keyring/detail-1.webp'),
  ('sodafm/ball-cap/main.webp',         'sodafm/ball-cap/detail-1.webp'),
  ('sodafm/light-stick/main.webp',      'sodafm/light-stick/detail-1.webp'),
  ('sodafm/member-doll/main.webp',      'sodafm/member-doll/detail-1.webp'),
  ('sodafm/membership-card/main.webp',  'sodafm/membership-card/detail-1.webp'),
  ('sodafm/mini-album/main.webp',       'sodafm/mini-album/detail-1.webp'),
  ('sodafm/mug/main.webp',              'sodafm/mug/detail-1.webp'),
  ('sodafm/outer-collection/main.webp', 'sodafm/outer-collection/detail-1.webp'),
  ('sodafm/tumbler/main.webp',          'sodafm/tumbler/detail-1.webp')
) as p_path(thumbnail_path, image_path)
join public.products p on p.thumbnail_path = p_path.thumbnail_path
where not exists (
  select 1 from public.product_images i where i.product_id = p.id and i.image_path = p_path.image_path
);
