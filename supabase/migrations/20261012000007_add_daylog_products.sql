-- DAYLOG 실제 이미지 반영 (팀원 제공). 가격은 이미지에 없어서 다른 그룹 굿즈 기준으로 임의 책정
-- 1) 로고 집업 후드 → 데일리 후드 집업 (옵션: 색상 3 × 사이즈 S·M. 기존 옵션 행은 주문 이력이 참조하므로 삭제하지 않고 이름만 변경)
-- 2) 하트 리본 키링 → 인형 키링 (마스코트 4종 옵션, 인형 카테고리)
-- 3) 신규 상품 22종 + 기존 상품 상세 이미지
-- 마스코트: 지야(지아·여우) 희봉(희수·강아지) 주야(혜주·고양이) 연이(서연·토끼)

-- 1) 후드
update public.products
set name = 'DAYLOG 데일리 후드 집업',
    description = '부드러운 기모 안감의 데일리 후드 집업. 리본 자수 로고 포인트.',
    thumbnail_path = 'daylog/daily-hoodie/main.webp'
where name = 'DAYLOG 로고 집업 후드';

update public.product_variants v
set option_name = x.new_name, extra_price = 0, sort_order = x.sort_order
from public.products p,
(values ('S', '핑크 / S', 1), ('M', '핑크 / M', 2), ('L', '오트밀 / S', 3), ('XL', '오트밀 / M', 4)) as x(old_name, new_name, sort_order)
where v.product_id = p.id and p.name = 'DAYLOG 데일리 후드 집업' and v.option_name = x.old_name;

-- 2) 키링
update public.products
set name = 'DAYLOG 인형 키링',
    description = '데이로그의 네 친구 지야·희봉·주야·연이 인형 키링. 별 모양 고리와 이니셜 참 포인트.',
    thumbnail_path = 'daylog/plush-keyring/main.webp',
    category_id = (select id from public.categories where slug = 'doll')
where name = 'DAYLOG 하트 리본 키링';

update public.product_variants v
set option_name = '지야', max_per_user = 2
from public.products p
where v.product_id = p.id and p.name = 'DAYLOG 인형 키링' and v.option_name = '기본';

-- 3) 신규 상품
insert into public.products (artist_id, category_id, name, description, price, status, thumbnail_path)
select a.id, c.id, v.name, v.description, v.price, 'on_sale', 'daylog/' || v.folder || '/main.webp'
from (values
  ('album',     'DAYLOG The 2nd EP [Afterglow]',  '노을빛 벚꽃 감성의 두 번째 EP. 박스 패키지와 에코백 구성.',              19000, '2nd-ep-afterglow'),
  ('accessory', 'DAYLOG 아크릴 키링',              '지야·희봉·주야·연이 아크릴 키링. 리본 & 이니셜 참, 약 70mm.',            12000, 'acrylic-keyring'),
  ('accessory', 'DAYLOG 캐릭터 캔뱃지',            '네 친구 캐릭터 캔뱃지. 지름 약 58mm.',                                     5000, 'can-badge'),
  ('living',    'DAYLOG 캐릭터 볼펜',              '캐릭터 피규어가 달린 0.5mm 블랙 볼펜.',                                     7000, 'character-pen'),
  ('living',    'DAYLOG 캐릭터 스티커',            '도톰한 에폭시 캐릭터 스티커 시트. 낱장 또는 4종 세트.',                     3500, 'character-sticker'),
  ('apparel',   'DAYLOG 데일리 캡',                '빈티지 워싱 원단에 자수 로고 볼캡. 사이즈 조절 가능.',                     35000, 'daily-cap'),
  ('living',    'DAYLOG 데일리 수저 세트',         '스테인리스 수저와 실리콘 수저받침, 전용 케이스 세트.',                     18000, 'daily-cutlery-set'),
  ('living',    'DAYLOG 데일리 유리컵',            '리본 로고와 레터링이 들어간 350ml 내열 유리컵.',                           15000, 'daily-glass-cup'),
  ('accessory', 'DAYLOG 데일리 헤어 집게핀',       '하트 각인 참과 진주 포인트의 리본 집게핀.',                                15000, 'daily-hair-clip'),
  ('living',    'DAYLOG 데일리 도시락',            '2단 구조 950ml 도시락. 수저 세트와 파우치 포함.',                          28000, 'daily-lunch-box'),
  ('accessory', 'DAYLOG 데일리 목걸이',            '시그니처 하트 리본 펜던트 목걸이. 길이 조절 체인 40+5cm.',                 39000, 'daily-necklace'),
  ('accessory', 'DAYLOG 데일리 반지',              '하트 & 스타 모티브 큐빅 반지. 내부 DAYLOG 각인.',                          29000, 'daily-ring'),
  ('accessory', 'DAYLOG 데일리 슬링백',            '생활 방수 나일론 슬링백. 데이로그 참 장식 포함.',                          39000, 'daily-sling-bag'),
  ('apparel',   'DAYLOG 데일리 스니커즈',          '새틴 포인트와 탈부착 참 장식의 가벼운 데일리 스니커즈.',                   69000, 'daily-sneakers'),
  ('apparel',   'DAYLOG 데일리 삭스',              '리본 자수 로고 골지 양말. 230~250mm.',                                      6000, 'daily-socks'),
  ('living',    'DAYLOG 데일리 우양산',            'UV 차단 99.9% 프릴 우양산. 약 210g 경량.',                                 32000, 'daily-umbrella'),
  ('apparel',   'DAYLOG 데일리 바람막이',          '생활 방수 나일론 바람막이. 소매 스냅으로 다양한 연출.',                     69000, 'daily-windbreaker'),
  ('living',    'DAYLOG 다이어리 & 볼펜 세트',     '180도 펼쳐지는 다이어리와 리본 참 볼펜, 스티커 세트.',                     25000, 'diary-pen-set'),
  ('cheering',  'DAYLOG 이미지 피켓',              '멤버 이미지 피켓. 구매 시 랜덤 포토카드 1장 증정.',                         15000, 'image-picket'),
  ('cheering',  'DAYLOG 공식 슬로건',              '멤버별 공식 슬로건.',                                                       15000, 'official-slogan'),
  ('accessory', 'DAYLOG 포토카드 홀더',            '네 친구 인형 포토카드 홀더. 일반 포토카드 사이즈 수납.',                   16000, 'photocard-holder'),
  ('accessory', 'DAYLOG 스크런치',                 '은은한 광택의 쉬폰 파우더 블루 스크런치.',                                  9000, 'scrunchie')
) as v(category, name, description, price, folder)
join public.artists a on a.slug = 'daylog'
join public.categories c on c.slug = v.category;

-- 옵션 (max_per_user 생략 시 기본 4)
insert into public.product_variants (product_id, option_name, extra_price, stock, max_per_user, sort_order)
select p.id, v.option_name, v.extra_price, v.stock, coalesce(v.max_per_user, 4), v.sort_order
from (
  -- 후드: 네이비 추가 (핑크·오트밀은 위에서 이름 변경)
  values ('DAYLOG 데일리 후드 집업', '네이비 / S', 0, 50, null::int, 5),
         ('DAYLOG 데일리 후드 집업', '네이비 / M', 0, 50, null, 6),
         ('DAYLOG The 2nd EP [Afterglow]', '기본', 0, 300, null, 1),
         ('DAYLOG 캐릭터 스티커', '4종 세트', 10500, 100, null, 5),
         ('DAYLOG 데일리 캡', '기본', 0, 80, null, 1),
         ('DAYLOG 데일리 유리컵', '기본', 0, 80, null, 1),
         ('DAYLOG 데일리 헤어 집게핀', '기본', 0, 100, null, 1),
         ('DAYLOG 데일리 목걸이', '기본', 0, 60, null, 1),
         ('DAYLOG 스크런치', '기본', 0, 100, null, 1)
  union all
  -- 마스코트 4종 옵션
  select x.product, m.name, 0, x.stock, x.max_per_user, m.sort_order
  from (values ('DAYLOG 인형 키링', 60, 2),
               ('DAYLOG 아크릴 키링', 100, 3),
               ('DAYLOG 캐릭터 캔뱃지', 150, null::int),
               ('DAYLOG 캐릭터 볼펜', 150, null),
               ('DAYLOG 캐릭터 스티커', 200, null),
               ('DAYLOG 포토카드 홀더', 80, 3)) as x(product, stock, max_per_user)
  cross join (values ('지야', 1), ('희봉', 2), ('주야', 3), ('연이', 4)) as m(name, sort_order)
  where not (x.product = 'DAYLOG 인형 키링' and m.name = '지야') -- 기존 '기본' 옵션을 지야로 변경함
  union all
  -- 멤버 4종 옵션
  select x.product, m.name, 0, 100, 3, m.sort_order
  from (values ('DAYLOG 이미지 피켓'), ('DAYLOG 공식 슬로건')) as x(product)
  cross join (values ('지아', 1), ('희수', 2), ('혜주', 3), ('서연', 4)) as m(name, sort_order)
  union all
  -- 색상 옵션
  select x.product, c.name, 0, x.stock, null, c.sort_order
  from (values ('DAYLOG 데일리 수저 세트', 60), ('DAYLOG 데일리 도시락', 50),
               ('DAYLOG 데일리 우양산', 50), ('DAYLOG 다이어리 & 볼펜 세트', 60)) as x(product, stock)
  cross join (values ('아이보리', 1), ('소프트 핑크', 2), ('파우더 블루', 3), ('라벤더 그레이', 4)) as c(name, sort_order)
  union all
  select 'DAYLOG 데일리 슬링백', c.name, 0, 40, null, c.sort_order
  from (values ('소프트 핑크', 1), ('파우더 블루', 2), ('차콜', 3)) as c(name, sort_order)
  union all
  select 'DAYLOG 데일리 삭스', c.name, 0, 100, null, c.sort_order
  from (values ('아이보리', 1), ('핑크', 2), ('소라', 3), ('멜란지 그레이', 4), ('블랙', 5)) as c(name, sort_order)
  union all
  select 'DAYLOG 데일리 반지', s.name, 0, 30, null, s.sort_order
  from (values ('5호', 1), ('7호', 2), ('9호', 3), ('11호', 4), ('13호', 5)) as s(name, sort_order)
  union all
  -- 색상 × 사이즈
  select 'DAYLOG 데일리 스니커즈', c.name || ' / ' || s.size, 0, 15, null, c.sort_order * 10 + s.sort_order
  from (values ('아이보리', 1), ('파우더 블루', 2), ('소프트 핑크', 3)) as c(name, sort_order)
  cross join (values ('230', 1), ('235', 2), ('240', 3), ('245', 4), ('250', 5)) as s(size, sort_order)
  union all
  select 'DAYLOG 데일리 바람막이', c.name || ' / ' || s.size, 0, 25, null, c.sort_order * 10 + s.sort_order
  from (values ('파우더 블루', 1), ('아이보리', 2), ('소프트 핑크', 3)) as c(name, sort_order)
  cross join (values ('S', 1), ('M', 2), ('L', 3)) as s(size, sort_order)
) as v(product, option_name, extra_price, stock, max_per_user, sort_order)
join public.products p on p.name = v.product;

-- 상세 이미지 (기존 행은 지우고 폴더 기준으로 다시 등록)
delete from public.product_images
where product_id in (select p.id from public.products p join public.artists a on a.id = p.artist_id where a.slug = 'daylog');

insert into public.product_images (product_id, image_path, sort_order)
select p.id, 'daylog/' || v.folder || '/' || f.file, f.sort_order
from (values
  ('DAYLOG 2nd Single [diary]', '2nd-single-diary'), ('DAYLOG 멤버 인형', 'member-doll'),
  ('DAYLOG 데일리 텀블러', 'daily-tumbler'), ('DAYLOG 공식 응원봉', 'light-stick'),
  ('DAYLOG 데일리 후드 집업', 'daily-hoodie'), ('DAYLOG 인형 키링', 'plush-keyring'),
  ('DAYLOG The 2nd EP [Afterglow]', '2nd-ep-afterglow'), ('DAYLOG 아크릴 키링', 'acrylic-keyring'),
  ('DAYLOG 캐릭터 캔뱃지', 'can-badge'), ('DAYLOG 캐릭터 볼펜', 'character-pen'),
  ('DAYLOG 캐릭터 스티커', 'character-sticker'), ('DAYLOG 데일리 캡', 'daily-cap'),
  ('DAYLOG 데일리 수저 세트', 'daily-cutlery-set'), ('DAYLOG 데일리 유리컵', 'daily-glass-cup'),
  ('DAYLOG 데일리 헤어 집게핀', 'daily-hair-clip'), ('DAYLOG 데일리 도시락', 'daily-lunch-box'),
  ('DAYLOG 데일리 목걸이', 'daily-necklace'), ('DAYLOG 데일리 반지', 'daily-ring'),
  ('DAYLOG 데일리 슬링백', 'daily-sling-bag'), ('DAYLOG 데일리 스니커즈', 'daily-sneakers'),
  ('DAYLOG 데일리 삭스', 'daily-socks'), ('DAYLOG 데일리 우양산', 'daily-umbrella'),
  ('DAYLOG 데일리 바람막이', 'daily-windbreaker'), ('DAYLOG 다이어리 & 볼펜 세트', 'diary-pen-set'),
  ('DAYLOG 이미지 피켓', 'image-picket'), ('DAYLOG 공식 슬로건', 'official-slogan'),
  ('DAYLOG 포토카드 홀더', 'photocard-holder'), ('DAYLOG 스크런치', 'scrunchie')
) as v(product, folder)
cross join (values ('detail-1.webp', 1), ('detail-2.webp', 2)) as f(file, sort_order)
join public.products p on p.name = v.product
union all
select p.id, 'daylog/membership-card/detail-1.webp', 1 from public.products p where p.name = 'DAYLOG 공식 멤버십 카드'
union all
select p.id, 'daylog/image-picket/random-photocard-benefit.webp', 3 from public.products p where p.name = 'DAYLOG 이미지 피켓'
union all
select p.id, 'daylog/official-slogan/variants/' || m.file, m.sort_order
from public.products p,
(values ('jia.webp', 3), ('heesu.webp', 4), ('hyeju.webp', 5), ('seoyeon.webp', 6)) as m(file, sort_order)
where p.name = 'DAYLOG 공식 슬로건';
