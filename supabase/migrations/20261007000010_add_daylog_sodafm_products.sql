-- DAYLOG·SODAFM 신규 상품 9종 (이미지: products 버킷, 팀원 제공)

insert into public.products (artist_id, category_id, name, description, price, status, thumbnail_path)
select a.id, c.id, v.name, v.description, v.price, 'on_sale', v.thumb
from (values
  ('daylog', 'apparel',   'DAYLOG 로고 집업 후드',           '심볼 자수 포인트의 그레이 집업 후드.',                       59000, 'daylog/hoodie/main.webp'),
  ('daylog', 'accessory', 'DAYLOG 하트 리본 키링',           '하트 아크릴과 리본, 진주 참 장식 키링. 1인 3개 한정.',       13000, 'daylog/keyring/main.webp'),
  ('daylog', 'cheering',  'DAYLOG 공식 응원봉',              '하트 라이트가 빛나는 공식 응원봉. 1인 2개 한정.',            45000, 'daylog/light-stick/main.webp'),
  ('sodafm', 'album',     'SODAFM 1st Mini Album [청량한 너에게]', '소다에프엠 첫 번째 미니앨범.',                          18000, 'sodafm/mini-album/main.webp'),
  ('sodafm', 'cheering',  'SODAFM 공식 응원봉',              '별 모양 라이트의 공식 응원봉. 1인 2개 한정.',                45000, 'sodafm/light-stick/main.webp'),
  ('sodafm', 'accessory', 'SODAFM 아크릴 키링',              '멤버별 아크릴 키링. 멤버당 1인 3개 한정.',                   12000, 'sodafm/acrylic-keyring/main.webp'),
  ('sodafm', 'doll',      'SODAFM 멤버 인형',                '멤버 인형. 멤버당 1인 2개 한정.',                            32000, 'sodafm/member-doll/main.webp'),
  ('sodafm', 'apparel',   'SODAFM 아우터 컬렉션',            '후드티·맨투맨·트랙 자켓·바시티 자켓 4종.',                   49000, 'sodafm/outer-collection/main.webp'),
  ('sodafm', 'living',    'SODAFM 컬러 텀블러',              '멤버 컬러 스테인리스 텀블러 473ml.',                         22000, 'sodafm/tumbler/main.webp')
) as v(artist, category, name, description, price, thumb)
join public.artists a on a.slug = v.artist
join public.categories c on c.slug = v.category;

insert into public.product_variants (product_id, option_name, extra_price, stock, max_per_user, sort_order)
select p.id, v.option_name, v.extra_price, v.stock, v.max_per_user, v.sort_order
from (values
  ('DAYLOG 로고 집업 후드',            'S',          0,     50,  null::int, 1),
  ('DAYLOG 로고 집업 후드',            'M',          0,     50,  null,      2),
  ('DAYLOG 로고 집업 후드',            'L',          0,     50,  null,      3),
  ('DAYLOG 로고 집업 후드',            'XL',         2000,  30,  null,      4),
  ('DAYLOG 하트 리본 키링',            '기본',       0,     150, 3,         1),
  ('DAYLOG 공식 응원봉',               '기본',       0,     300, 2,         1),
  ('SODAFM 1st Mini Album [청량한 너에게]', '기본',  0,     300, null,      1),
  ('SODAFM 공식 응원봉',               '기본',       0,     300, 2,         1),
  ('SODAFM 아크릴 키링',               '하람',       0,     100, 3,         1),
  ('SODAFM 아크릴 키링',               '윤슬',       0,     100, 3,         2),
  ('SODAFM 아크릴 키링',               '나래',       0,     100, 3,         3),
  ('SODAFM 아크릴 키링',               '루하',       0,     100, 3,         4),
  ('SODAFM 멤버 인형',                 '하람',       0,     40,  2,         1),
  ('SODAFM 멤버 인형',                 '윤슬',       0,     40,  2,         2),
  ('SODAFM 멤버 인형',                 '나래',       0,     40,  2,         3),
  ('SODAFM 멤버 인형',                 '루하',       0,     40,  2,         4),
  ('SODAFM 아우터 컬렉션',             '후드티',     0,     40,  null,      1),
  ('SODAFM 아우터 컬렉션',             '맨투맨',     0,     40,  null,      2),
  ('SODAFM 아우터 컬렉션',             '트랙 자켓',  10000, 30,  null,      3),
  ('SODAFM 아우터 컬렉션',             '바시티 자켓', 30000, 20, null,      4),
  ('SODAFM 컬러 텀블러',               '블루',       0,     60,  null,      1),
  ('SODAFM 컬러 텀블러',               '민트',       0,     60,  null,      2),
  ('SODAFM 컬러 텀블러',               '옐로',       0,     60,  null,      3),
  ('SODAFM 컬러 텀블러',               '화이트',     0,     60,  null,      4)
) as v(product, option_name, extra_price, stock, max_per_user, sort_order)
join public.products p on p.name = v.product;
