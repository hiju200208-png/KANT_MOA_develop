-- ORBIT:ON 마스코트 인형 키링: 액세서리 → 인형 카테고리 (팀 결정)

update public.products
set category_id = (select id from public.categories where slug = 'doll')
where name = 'ORBIT:ON 마스코트 인형 키링';
