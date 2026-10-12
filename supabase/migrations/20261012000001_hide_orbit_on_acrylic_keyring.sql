-- ORBIT:ON 아크릴 키링 → 마스코트 인형 키링으로 대체 (팀 결정)
-- 주문 이력 보존을 위해 삭제하지 않고 숨김. 장바구니에 담겨 있던 항목은 화면에서 자동 제외됨

update public.products set status = 'hidden' where name = 'ORBIT:ON 아크릴 키링';
