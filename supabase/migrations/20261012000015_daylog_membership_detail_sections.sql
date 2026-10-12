-- DAYLOG 멤버십 카드 상세 이미지 교체 (팀원 제공): 기존 1장 → 섹션 8장 (모두 폭 1200, 순서대로 세로 연결)

delete from public.product_images
where product_id = (select id from public.products where thumbnail_path = 'daylog/membership-card/main.webp');

insert into public.product_images (product_id, image_path, sort_order)
select p.id, 'daylog/membership-card/detail-sections/' || v.file, v.sort_order
from public.products p,
(values
  ('01-product-intro.webp', 1),
  ('02-sales-notice.webp', 2),
  ('03-signup-guide.webp', 3),
  ('04-membership-benefits.webp', 4),
  ('05-renewal-guide.webp', 5),
  ('06-cancel-refund.webp', 6),
  ('07-additional-info.webp', 7),
  ('08-faq-footer.webp', 8)
) as v(file, sort_order)
where p.thumbnail_path = 'daylog/membership-card/main.webp';
