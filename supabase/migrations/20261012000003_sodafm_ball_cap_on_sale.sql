-- SODAFM 볼캡: seed에서 품절 테스트용(재고 0, sold_out)이었으나 실제 이미지가 생겨 판매 시작 (팀 결정)
-- 재고는 다른 의류·볼캡과 동일하게 80

update public.products set status = 'on_sale' where thumbnail_path = 'sodafm/ball-cap/main.webp';

update public.product_variants set stock = 80
where product_id = (select id from public.products where thumbnail_path = 'sodafm/ball-cap/main.webp');
