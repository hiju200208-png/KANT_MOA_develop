-- 구매 제한이 없던(무제한) 옵션을 1인 4개로 제한 (팀 결정: 무제한 구매 방지)
-- 이미 제한이 있는 옵션(멤버십 1, 응원봉 2, 키링 3 등)은 그대로. 새로 추가하는 옵션도 기본 4개

update public.product_variants set max_per_user = 4 where max_per_user is null;

alter table public.product_variants alter column max_per_user set default 4;
