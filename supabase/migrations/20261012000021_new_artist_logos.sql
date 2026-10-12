-- 새 아티스트 8팀 로고·대표 사진 (artists 버킷 <slug>/logo.webp, <slug>/hero.webp)
update public.artists
set logo_path = slug || '/logo.webp', hero_image_path = slug || '/hero.webp'
where slug in ('cortis', 'zico', 'bts', 'seventeen', 'le-sserafim', 'txt', 'tws', 'boynextdoor');
