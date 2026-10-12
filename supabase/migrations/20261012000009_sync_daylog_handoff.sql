-- DAYLOG 팀원 전달본 반영 (DAYLOG_DB_상품등록_전달.xlsx · DAYLOG_상세이미지_등록순서.json)
-- 1) 로고·히어로 이미지 교체
-- 2) 29개 상품 이름·가격·카테고리를 전달본 기준으로 갱신 (상품은 썸네일 폴더명 = 전달본 slug로 찾음)
-- 3) 옵션 정리: 멤버 인형은 멤버명 → 마스코트명, 2nd Single·스티커는 전달본에 없는 옵션 삭제 (주문 이력 없음 확인)
-- 4) 상세 이미지: 기존 행 삭제 후 JSON 순서대로 재등록 (인트로 → 사양 → 포토카드 특전)
-- 대표 이미지(main.webp)는 같은 경로에 투명 누끼로 교체돼 경로 변경 없음
-- 단일 옵션(캡 FREE, 텀블러 아이보리, 스크런치 파우더 블루)과 양말 FREE 사이즈는 선택할 게 없어 기존처럼 '기본'·색상만 둠
-- 마스코트 이름은 상품 이미지 표기(지야·주야)를 따름 (전달본 '지아·주아'는 멤버 지아와 겹쳐 오타로 판단)

-- 1) 아티스트 이미지
update public.artists
set logo_path = 'daylog/logo-thumbnail.webp', hero_image_path = 'daylog/hero-banner.webp'
where slug = 'daylog';

-- 2) 상품 이름·가격·카테고리
update public.products p
set name = v.name, price = v.price, category_id = c.id
from (values
  ('2nd-single-diary',  'DAYLOG 2nd Single Diary',      24900, 'album'),
  ('2nd-ep-afterglow',  'DAYLOG 2nd EP Afterglow',      32900, 'album'),
  ('light-stick',       'DAYLOG 공식 응원봉',            59000, 'cheering'),
  ('official-slogan',   'DAYLOG 공식 슬로건',            29000, 'cheering'),
  ('image-picket',      'DAYLOG 이미지 피켓',            25000, 'cheering'),
  ('member-doll',       'DAYLOG 개별 인형',              39000, 'doll'),
  ('character-pen',     'DAYLOG 캐릭터 볼펜',            12000, 'doll'),
  ('acrylic-keyring',   'DAYLOG 아크릴 키링',            18000, 'doll'),
  ('character-sticker', 'DAYLOG 캐릭터 스티커',          12000, 'doll'),
  ('can-badge',         'DAYLOG 캔배지',                 15000, 'doll'),
  ('plush-keyring',     'DAYLOG 인형 키링',              28000, 'doll'),
  ('photocard-holder',  'DAYLOG 포토카드 홀더',          25000, 'doll'),
  ('daily-necklace',    'DAYLOG 데일리 목걸이',          45000, 'accessory'),
  ('daily-ring',        'DAYLOG 데일리 반지',            39000, 'accessory'),
  ('scrunchie',         'DAYLOG 스크런치',               18000, 'accessory'),
  ('daily-hair-clip',   'DAYLOG 데일리 집게핀',          22000, 'accessory'),
  ('daily-sling-bag',   'DAYLOG 데일리 슬링백',          49000, 'apparel'),
  ('daily-windbreaker', 'DAYLOG 데일리 바람막이',       119000, 'apparel'),
  ('daily-sneakers',    'DAYLOG 데일리 스니커즈',       109000, 'apparel'),
  ('daily-socks',       'DAYLOG 데일리 양말',            19000, 'apparel'),
  ('daily-cap',         'DAYLOG 데일리 캡',              39000, 'apparel'),
  ('daily-hoodie',      'DAYLOG 데일리 후드티',          89000, 'apparel'),
  ('daily-lunch-box',   'DAYLOG 데일리 도시락',          39000, 'living'),
  ('daily-cutlery-set', 'DAYLOG 데일리 수저 세트',       25000, 'living'),
  ('daily-umbrella',    'DAYLOG 데일리 양산',            49000, 'living'),
  ('daily-glass-cup',   'DAYLOG 데일리 유리컵',          22000, 'living'),
  ('daily-tumbler',     'DAYLOG 데일리 텀블러',          39000, 'living'),
  ('diary-pen-set',     'DAYLOG 다이어리 & 볼펜 세트',   39000, 'living'),
  ('membership-card',   'DAYLOG 멤버십 카드',            35000, 'membership')
) as v(slug, name, price, category)
join public.categories c on c.slug = v.category
where p.thumbnail_path = 'daylog/' || v.slug || '/main.webp';

-- 3) 옵션
update public.product_variants v
set option_name = x.new_name
from public.products p,
(values ('지아', '지야'), ('희수', '희봉'), ('혜주', '주야'), ('서연', '연이')) as x(old_name, new_name)
where v.product_id = p.id and p.thumbnail_path = 'daylog/member-doll/main.webp' and v.option_name = x.old_name;

update public.product_variants v
set option_name = '기본', sort_order = 1
from public.products p
where v.product_id = p.id and p.thumbnail_path = 'daylog/2nd-single-diary/main.webp' and v.option_name = '플랫폼';

delete from public.product_variants v
using public.products p
where v.product_id = p.id
  and ((p.thumbnail_path = 'daylog/2nd-single-diary/main.webp' and v.option_name = '포토북')
    or (p.thumbnail_path = 'daylog/character-sticker/main.webp' and v.option_name = '4종 세트'));

-- 4) 상세 이미지
delete from public.product_images
where product_id in (select p.id from public.products p join public.artists a on a.id = p.artist_id where a.slug = 'daylog');

insert into public.product_images (product_id, image_path, sort_order)
select p.id, 'daylog/' || v.slug || '/' || f.file, f.sort_order
from public.products p
join (values
  ('2nd-single-diary', 'basic2'), ('2nd-ep-afterglow', 'basic2'), ('light-stick', 'basic2'),
  ('official-slogan', 'basic2'), ('image-picket', 'basic2'), ('membership-card', 'intro'),
  ('member-doll', 'doll'), ('scrunchie', 'scrunchie'),
  ('character-pen', 'spec'), ('acrylic-keyring', 'spec'), ('character-sticker', 'spec'), ('can-badge', 'spec'),
  ('plush-keyring', 'spec'), ('photocard-holder', 'spec'), ('daily-necklace', 'spec'), ('daily-ring', 'spec'),
  ('daily-hair-clip', 'spec'), ('daily-sling-bag', 'spec'), ('daily-windbreaker', 'spec'), ('daily-sneakers', 'spec'),
  ('daily-socks', 'spec'), ('daily-cap', 'spec'), ('daily-hoodie', 'spec'), ('daily-lunch-box', 'spec'),
  ('daily-cutlery-set', 'spec'), ('daily-umbrella', 'spec'), ('daily-glass-cup', 'spec'), ('daily-tumbler', 'spec'),
  ('diary-pen-set', 'spec')
) as v(slug, layout) on p.thumbnail_path = 'daylog/' || v.slug || '/main.webp'
join (values
  ('spec', 'detail-1.webp', 1), ('spec', 'detail-spec.webp', 2), ('spec', 'detail-2.webp', 3),
  ('basic2', 'detail-1.webp', 1), ('basic2', 'detail-2.webp', 2),
  ('intro', 'detail-1.webp', 1),
  ('doll', 'member-slides/01-jia.webp', 1), ('doll', 'member-slides/02-heesu.webp', 2),
  ('doll', 'member-slides/03-hyeju.webp', 3), ('doll', 'member-slides/04-seoyeon.webp', 4), ('doll', 'detail-2.webp', 5),
  ('scrunchie', 'detail-1.webp', 1), ('scrunchie', 'detail-sections/02-color.webp', 2),
  ('scrunchie', 'detail-sections/03-detail.webp', 3), ('scrunchie', 'detail-sections/04-styling.webp', 4),
  ('scrunchie', 'detail-sections/05-package.webp', 5), ('scrunchie', 'detail-2.webp', 6)
) as f(layout, file, sort_order) on f.layout = v.layout;
