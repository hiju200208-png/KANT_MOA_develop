-- DB_DESIGN.md 6-9 Storage 버킷
-- public 버킷: URL로 누구나 읽기 가능. 쓰기 정책 없음 → 업로드는 대시보드에서만

insert into storage.buckets (id, name, public) values
  ('products', 'products', true),
  ('artists',  'artists',  true);
