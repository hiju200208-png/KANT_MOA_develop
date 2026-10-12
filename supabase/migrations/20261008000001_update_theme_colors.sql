-- 그룹 테마 색상 확정 (각 그룹 담당 프론트 결정): DAYLOG 베이비핑크, SODAFM 스카이블루

update public.artists set theme_color = '#F4C2C2' where slug = 'daylog';
update public.artists set theme_color = '#87CEEB' where slug = 'sodafm';
