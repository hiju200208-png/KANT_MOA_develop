-- 아티스트 멤버 소개 (아티스트 페이지 배너 클릭 시 멤버 소개)
-- 굿즈의 멤버 옵션은 기존처럼 product_variants.option_name으로 처리 (이 테이블과 FK 없음)

create table public.artist_members (
  id bigint generated always as identity primary key,
  artist_id bigint not null references public.artists(id) on delete cascade,
  name text not null,            -- '선우' (상품 옵션명과 동일)
  name_en text not null,         -- 'SUNWOO' (이미지 파일명: 소문자)
  position text,
  color text,                    -- 멤버 컬러 '#FF8A3D'
  mascot text,
  birthday date,
  mbti text,
  description text,              -- 한 줄 소개
  tags text[] not null default '{}',
  image_path text,               -- artists 버킷 내 경로: <artist-slug>/members/<name_en 소문자>.webp
  sort_order int not null default 0,
  unique (artist_id, name)
);

create index on public.artist_members (artist_id);

alter table public.artist_members enable row level security;

create policy "artist_members_select_all" on public.artist_members
  for select to anon, authenticated
  using (true);

-- 데이터
-- ponytail: db reset 시에는 seed(artists)보다 먼저 실행되어 멤버가 비게 됨. 로컬 reset을 쓰게 되면 seed.sql로 이동
insert into public.artist_members
  (artist_id, name, name_en, position, color, mascot, birthday, mbti, description, tags, image_path, sort_order)
select a.id, v.name, v.name_en, v.position, v.color, v.mascot, v.birthday::date, v.mbti, v.description, v.tags,
       a.slug || '/members/' || lower(v.name_en) || '.webp', v.sort_order
from (values
  ('orbit-on', '선우', 'SUNWOO',  '리더, 메인보컬',     '#FF8A3D', '햇살 여우 ''쏠리''',   '2002-07-14', 'ENFJ', '태양처럼 팀을 비추는 리더. 따뜻한 음색이 특징이에요.',             array['솔라', '리더', '따뜻한음색'], 1),
  ('orbit-on', '이안', 'IAN',     '메인댄서',           '#3D7BFF', '물결 고래 ''블루''',   '2003-01-09', 'ISTP', '파도처럼 유연한 춤선을 가진 퍼포먼스 담당이에요.',                  array['아쿠아', '퍼포먼스', '춤선'], 2),
  ('orbit-on', '하루', 'HARU',    '리드보컬, 비주얼',   '#C9CED6', '달토끼 ''모찌''',      '2003-09-22', 'INFP', '달빛 같은 몽환적 보컬을 지녔고, 그룹의 비주얼 센터예요.',           array['루나', '몽환보컬', '비주얼'], 3),
  ('orbit-on', '제이', 'JAY',     '메인래퍼',           '#FFD93D', '번개 고양이 ''찌릿''', '2004-04-30', 'ESTP', '번개처럼 빠른 랩으로 무대 분위기를 끌어올려요.',                    array['볼트', '속사포랩', '무대장인'], 4),
  ('orbit-on', '리온', 'RION',    '서브보컬, 막내',     '#5FD3A8', '새싹 곰 ''포포''',     '2006-11-03', 'ENFP', '새싹처럼 밝은 에너지를 가진 막내. 팀의 분위기 메이커예요.',         array['플로라', '막내', '분위기메이커'], 5),
  ('daylog',   '지아', 'JIA',     '리더, 메인보컬',     '#91A8F0', '일기장 고양이 ''노트''', '2005-04-12', 'INFJ', '차분하지만 무대 위에서는 강한 존재감, 따뜻한 목소리로 팀의 이야기를 이끈다.', array['리더십', '감성보컬', '따뜻한에너지'], 1),
  ('daylog',   '희수', 'HEESU',   '메인댄서, 서브보컬', '#7FB2E8', '운동화 강아지 ''스니키''', '2006-08-03', 'ESFP', '무대를 장악하는 리듬감과 시원한 에너지, 언제나 새로운 움직임으로 팀에 활력을 더한다.', array['퍼포먼스', '에너지', '스포티'], 2),
  ('daylog',   '혜주', 'HYEJU',   '메인래퍼, 프로듀싱', '#998EE9', '헤드폰 여우 ''비트''',   '2005-11-27', 'ENTP', '감각적인 랩과 세련된 무드의 중심, 자신만의 시선으로 우리의 이야기를 확장한다.', array['랩', '프로듀싱', '시티걸'], 3),
  ('daylog',   '서연', 'SEOYEON', '비주얼, 서브보컬',   '#D384A5', '리본 토끼 ''루루''',     '2006-02-14', 'ISFP', '맑은 분위기와 부드러운 감성으로 팀의 밸런스를 잡는 존재, 모두의 하루에 따뜻함을 더한다.', array['러블리', '청순', '힐링에너지'], 4),
  ('sodafm',   '하람', 'HARAM',   '리더, 메인보컬',     '#5693F3', '탄산 펭귄 ''버블''',     '2004-06-21', 'ENFP', '하람이에요! 상쾌한 에너지로 언제나 너에게 힘이 될게요!',            array['리더', '메인보컬', '청량'], 1),
  ('sodafm',   '윤슬', 'YUNSEUL', '메인래퍼, 비주얼',   '#2F5FD0', '물빛 돌고래 ''윤이''',   '2005-08-09', 'INTJ', '윤슬입니다. 지금도, 앞으로도 너와 함께.',                           array['메인래퍼', '비주얼', '냉미남'], 2),
  ('sodafm',   '나래', 'NARAE',   '서브보컬, 댄서',     '#7ACBB6', '바다 갈매기 ''나리''',   '2005-12-01', 'ESFJ', '나래야! 우리 더 멋진 추억 같이 만들자!',                            array['서브보컬', '댄서', '활발'], 3),
  ('sodafm',   '루하', 'RUHA',    '서브보컬, 댄서, 막내', '#F2CD65', '레몬 햄스터 ''레니''', '2007-03-30', 'ESFP', '루하예요! 늘 너의 옆에 있을게 :)',                                 array['막내', '댄서', '러블리'], 4)
) as v(artist, name, name_en, position, color, mascot, birthday, mbti, description, tags, sort_order)
join public.artists a on a.slug = v.artist;

-- 그룹 테마 색상 (ORBIT:ON은 기존 #B8A4FF 유지)
update public.artists set theme_color = '#91A8F0' where slug = 'daylog';
update public.artists set theme_color = '#5693F3' where slug = 'sodafm';

-- ORBIT:ON 공식 프로필 기준 앨범명 (이미지 경로는 그대로)
update public.products set name = 'ORBIT:ON 1st Mini Album [LIFTOFF]'
where name = 'ORBIT:ON 1st Mini Album [LAUNCH]';
