-- SODAFM 새 로고 (같은 경로에 덮어쓰면 이미지 캐시 때문에 최대 4시간 예전 로고가 보여 새 파일명 사용)
update public.artists set logo_path = 'sodafm/logo-v2.webp' where slug = 'sodafm';
