-- 초기 데이터 (DB_DESIGN.md 6-10). 이미지 경로는 Storage 업로드 전이면 깨져 보일 수 있음
-- 테스트용 데이터 포함: 재고 1개 옵션(DAYLOG 멤버 인형 - 서연), 품절(SODAFM 볼캡), 숨김(ORBIT:ON 시즌그리팅)

-- theme_color: 각 그룹 담당 프론트가 정해서 전달 (미정이면 null)
insert into public.artists (name, name_ko, slug, logo_path, hero_image_path, theme_color, sort_order) values
  ('ORBIT:ON', '오르빗온',   'orbit-on', 'orbit-on/logo.webp', 'orbit-on/hero.webp', '#B8A4FF', 1),
  ('DAYLOG',   '데이로그',   'daylog',   'daylog/logo.webp',   'daylog/hero.webp',   null,      2),  -- TODO: 색상
  ('SODAFM',   '소다에프엠', 'sodafm',   'sodafm/logo.webp',   'sodafm/hero.webp',   null,      3);  -- TODO: 색상

insert into public.categories (name, slug, sort_order) values
  ('앨범',     'album',      1),
  ('응원용품', 'cheering',   2),
  ('인형',     'doll',       3),
  ('액세서리', 'accessory',  4),
  ('의류',     'apparel',    5),
  ('생활용품', 'living',     6),
  ('멤버십',   'membership', 7);

insert into public.products (artist_id, category_id, name, description, price, status, thumbnail_path)
select a.id, c.id, v.name, v.description, v.price, v.status, v.thumb
from (values
  ('orbit-on', 'album',      'ORBIT:ON 1st Mini Album [LAUNCH]', '오르빗온 첫 번째 미니앨범. 버전별 포토카드 랜덤 1종 포함.', 18000, 'on_sale', 'orbit-on/1st-mini-launch/main.webp'),
  ('orbit-on', 'cheering',   'ORBIT:ON 공식 응원봉',             '블루투스 연동 공식 응원봉. 1인 2개 한정.',                 45000, 'on_sale', 'orbit-on/light-stick/main.webp'),
  ('orbit-on', 'accessory',  'ORBIT:ON 아크릴 키링',             '멤버별 아크릴 키링. 멤버당 1인 3개 한정.',                 12000, 'on_sale', 'orbit-on/acrylic-keyring/main.webp'),
  ('orbit-on', 'apparel',    'ORBIT:ON 로고 후드티',             '오버핏 로고 후드티.',                                      59000, 'on_sale', 'orbit-on/logo-hoodie/main.webp'),
  ('orbit-on', 'living',     'ORBIT:ON 시즌그리팅 (비공개)',     '공개 전 상품 (RLS 테스트용).',                             38000, 'hidden',  'orbit-on/season-greeting/main.webp'),
  ('daylog',   'album',      'DAYLOG 2nd Single [diary]',        '데이로그 두 번째 싱글.',                                   15000, 'on_sale', 'daylog/2nd-single-diary/main.webp'),
  ('daylog',   'doll',       'DAYLOG 멤버 인형',                 '20cm 멤버 인형. 멤버당 1인 2개 한정.',                     32000, 'on_sale', 'daylog/member-doll/main.webp'),
  ('daylog',   'membership', 'DAYLOG 공식 멤버십 카드',          '공식 팬클럽 멤버십 카드. 1인 1개.',                        30000, 'on_sale', 'daylog/membership-card/main.webp'),
  ('daylog',   'living',     'DAYLOG 데일리 텀블러',             '스테인리스 텀블러 473ml.',                                 22000, 'on_sale', 'daylog/daily-tumbler/main.webp'),
  ('sodafm',   'cheering',   'SODAFM 슬로건 타올',               '멤버별 슬로건 타올. 멤버당 1인 3개 한정.',                 15000, 'on_sale', 'sodafm/slogan-towel/main.webp'),
  ('sodafm',   'apparel',    'SODAFM 볼캡',                      '자수 로고 볼캡.',                                          35000, 'sold_out', 'sodafm/ball-cap/main.webp'),
  ('sodafm',   'living',     'SODAFM 머그컵',                    '세라믹 머그컵 350ml.',                                     18000, 'on_sale', 'sodafm/mug/main.webp'),
  ('sodafm',   'membership', 'SODAFM 공식 멤버십 카드',          '공식 팬클럽 멤버십 카드. 1인 1개.',                        30000, 'on_sale', 'sodafm/membership-card/main.webp')
) as v(artist, category, name, description, price, status, thumb)
join public.artists a on a.slug = v.artist
join public.categories c on c.slug = v.category;

insert into public.product_variants (product_id, option_name, extra_price, stock, max_per_user, sort_order)
select p.id, v.option_name, v.extra_price, v.stock, v.max_per_user, v.sort_order
from (values
  ('ORBIT:ON 1st Mini Album [LAUNCH]', 'A버전',  0,    200, null::int, 1),
  ('ORBIT:ON 1st Mini Album [LAUNCH]', 'B버전',  0,    200, null,      2),
  ('ORBIT:ON 1st Mini Album [LAUNCH]', '디지팩', 0,    150, null,      3),
  ('ORBIT:ON 공식 응원봉',             '기본',   0,    300, 2,         1),
  ('ORBIT:ON 아크릴 키링',             '리온',   0,    100, 3,         1),
  ('ORBIT:ON 아크릴 키링',             '선우',   0,    100, 3,         2),
  ('ORBIT:ON 아크릴 키링',             '이안',   0,    100, 3,         3),
  ('ORBIT:ON 아크릴 키링',             '제이',   0,    100, 3,         4),
  ('ORBIT:ON 아크릴 키링',             '하루',   0,    100, 3,         5),
  ('ORBIT:ON 로고 후드티',             'S',      0,    50,  null,      1),
  ('ORBIT:ON 로고 후드티',             'M',      0,    50,  null,      2),
  ('ORBIT:ON 로고 후드티',             'L',      0,    50,  null,      3),
  ('ORBIT:ON 로고 후드티',             'XL',     2000, 30,  null,      4),
  ('ORBIT:ON 시즌그리팅 (비공개)',     '기본',   0,    100, null,      1),
  ('DAYLOG 2nd Single [diary]',        '포토북', 0,    200, null,      1),
  ('DAYLOG 2nd Single [diary]',        '플랫폼', 0,    200, null,      2),
  ('DAYLOG 멤버 인형',                 '지아',   0,    30,  2,         1),
  ('DAYLOG 멤버 인형',                 '희수',   0,    30,  2,         2),
  ('DAYLOG 멤버 인형',                 '혜주',   0,    30,  2,         3),
  ('DAYLOG 멤버 인형',                 '서연',   0,    1,   2,         4),
  ('DAYLOG 공식 멤버십 카드',          '기본',   0,    500, 1,         1),
  ('DAYLOG 데일리 텀블러',             '기본',   0,    80,  null,      1),
  ('SODAFM 슬로건 타올',               '하람',   0,    100, 3,         1),
  ('SODAFM 슬로건 타올',               '윤슬',   0,    100, 3,         2),
  ('SODAFM 슬로건 타올',               '나래',   0,    100, 3,         3),
  ('SODAFM 슬로건 타올',               '루하',   0,    100, 3,         4),
  ('SODAFM 볼캡',                      '기본',   0,    0,   null,      1),
  ('SODAFM 머그컵',                    '기본',   0,    60,  null,      1),
  ('SODAFM 공식 멤버십 카드',          '기본',   0,    500, 1,         1)
) as v(product, option_name, extra_price, stock, max_per_user, sort_order)
join public.products p on p.name = v.product;

insert into public.product_images (product_id, image_path, sort_order)
select p.id, v.image_path, v.sort_order
from (values
  ('ORBIT:ON 1st Mini Album [LAUNCH]', 'orbit-on/1st-mini-launch/detail-1.webp', 1),
  ('ORBIT:ON 1st Mini Album [LAUNCH]', 'orbit-on/1st-mini-launch/detail-2.webp', 2),
  ('ORBIT:ON 아크릴 키링',             'orbit-on/acrylic-keyring/detail-1.webp', 1),
  ('DAYLOG 멤버 인형',                 'daylog/member-doll/detail-1.webp',       1),
  ('SODAFM 슬로건 타올',               'sodafm/slogan-towel/detail-1.webp',      1)
) as v(product, image_path, sort_order)
join public.products p on p.name = v.product;
