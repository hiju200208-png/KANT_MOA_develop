-- DAYLOG 멤버 프로필 생년월일 정정
update public.artist_members
set birthday = case name
  when '지아' then date '2006-02-08'
  when '희수' then date '2008-08-18'
  when '혜주' then date '2007-01-18'
  when '서연' then date '2009-05-22'
end
where artist_id = (select id from public.artists where slug = 'daylog')
  and name in ('지아', '희수', '혜주', '서연');

-- 상품 인형 캐릭터 설정과 프로필 마스코트를 통일
update public.artist_members
set mascot = case name
  when '지아' then '하늘빛 여우 ''지야'''
  when '희수' then '하트 강아지 ''희봉'''
  when '혜주' then '별빛 고양이 ''주야'''
  when '서연' then '리본 토끼 ''연이'''
end
where artist_id = (select id from public.artists where slug = 'daylog')
  and name in ('지아', '희수', '혜주', '서연');
