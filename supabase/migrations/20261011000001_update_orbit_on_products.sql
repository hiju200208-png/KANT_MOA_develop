-- ORBIT:ON 실제 이미지 반영 (팀원 제공)
-- 1) 로고 후드티 → 유니폼 져지로 대체 (옵션 S·M·L·XL 그대로, 주문 이력 스냅샷은 영향 없음)
-- 2) 신규 상품 5종: 마스코트 인형, 멤버십 카드, 볼캡, 행성 스티커, 행성 팔찌
-- 3) 상세 이미지: 응원봉·져지·신규 5종 추가, 1st 미니앨범 detail-2 제거 (1장만 제공)

update public.products
set name = 'ORBIT:ON 유니폼 져지',
    description = '홀로그램 포인트의 오버핏 유니폼 져지.',
    thumbnail_path = 'orbit-on/jersey/main.webp'
where name = 'ORBIT:ON 로고 후드티';

insert into public.products (artist_id, category_id, name, description, price, status, thumbnail_path)
select a.id, c.id, v.name, v.description, v.price, 'on_sale', v.thumb
from (values
  ('accessory',  'ORBIT:ON 마스코트 인형 키링', '쏠리·블루·모찌·찌릿·포포 마스코트 인형 키링. 마스코트당 1인 2개 한정.', 22000, 'orbit-on/mascot-doll/main.webp'),
  ('membership', 'ORBIT:ON 공식 멤버십 카드',   '공식 팬클럽 새틀라이트 멤버십 카드. 1인 1개.',                      30000, 'orbit-on/membership-card/main.webp'),
  ('apparel',    'ORBIT:ON 홀로그램 볼캡',      '홀로그램 원단에 행성 로고 자수 볼캡.',                              35000, 'orbit-on/ball-cap/main.webp'),
  ('living',     'ORBIT:ON 행성 스티커 세트',   '홀로그램 파우치에 담긴 행성 캐릭터 스티커 세트.',                    6000, 'orbit-on/planet-sticker/main.webp'),
  ('accessory',  'ORBIT:ON 행성 팔찌',          '다섯 멤버 행성 컬러 비즈 실버 팔찌.',                               25000, 'orbit-on/planet-bracelet/main.webp')
) as v(category, name, description, price, thumb)
join public.artists a on a.slug = 'orbit-on'
join public.categories c on c.slug = v.category;

insert into public.product_variants (product_id, option_name, extra_price, stock, max_per_user, sort_order)
select p.id, v.option_name, 0, v.stock, v.max_per_user, v.sort_order
from (values
  ('ORBIT:ON 마스코트 인형 키링', '쏠리', 60,  2,         1),
  ('ORBIT:ON 마스코트 인형 키링', '블루', 60,  2,         2),
  ('ORBIT:ON 마스코트 인형 키링', '모찌', 60,  2,         3),
  ('ORBIT:ON 마스코트 인형 키링', '찌릿', 60,  2,         4),
  ('ORBIT:ON 마스코트 인형 키링', '포포', 60,  2,         5),
  ('ORBIT:ON 공식 멤버십 카드',   '기본', 500, 1,         1),
  ('ORBIT:ON 홀로그램 볼캡',      '기본', 80,  null::int, 1),
  ('ORBIT:ON 행성 스티커 세트',   '기본', 200, null,      1),
  ('ORBIT:ON 행성 팔찌',          '기본', 100, null,      1)
) as v(product, option_name, stock, max_per_user, sort_order)
join public.products p on p.name = v.product;

insert into public.product_images (product_id, image_path, sort_order)
select p.id, v.image_path, 1
from (values
  ('ORBIT:ON 공식 응원봉',        'orbit-on/light-stick/detail-1.webp'),
  ('ORBIT:ON 유니폼 져지',        'orbit-on/jersey/detail-1.webp'),
  ('ORBIT:ON 마스코트 인형 키링', 'orbit-on/mascot-doll/detail-1.webp'),
  ('ORBIT:ON 공식 멤버십 카드',   'orbit-on/membership-card/detail-1.webp'),
  ('ORBIT:ON 홀로그램 볼캡',      'orbit-on/ball-cap/detail-1.webp'),
  ('ORBIT:ON 행성 스티커 세트',   'orbit-on/planet-sticker/detail-1.webp'),
  ('ORBIT:ON 행성 팔찌',          'orbit-on/planet-bracelet/detail-1.webp')
) as v(product, image_path)
join public.products p on p.name = v.product;

delete from public.product_images where image_path = 'orbit-on/1st-mini-launch/detail-2.webp';
