# TWS 원본 외부 Storage 시험 (2026-10-28)

사용자가 새 Free 프로젝트를 만들고 지정한 Supabase Storage에 **TWS 원본 한 개만** 업로드했다.
기존 쇼핑몰 PostgreSQL·FastAPI·인증은 그대로 사용한다. Supabase DB/Auth로 되돌리는 변경이 아니다.

## 대상과 파일

- 프로젝트: `kant-moa-media`, 서울, 사용자 대시보드에서 FREE 확인.
- Storage 공개 버킷: `hero-videos`. 새 공개 업로드·삭제 권한 정책은 추가하지 않았다.
- 파일: `tws-original-4d8cdc268c.mp4` (2,336,948bytes).
- 공개 주소: https://zpottidevwoeasihhbxl.supabase.co/storage/v1/object/public/hero-videos/tws-original-4d8cdc268c.mp4
- SHA256: `4d8cdc268cb3a293eeeab751042fcb8bc3c6cd73016fabce9e08b27f3a4a8772`.
- 기존 `public/sources/tws.mp4`와 전체 바이트·SHA256 동일. 화질·소리·재생 길이를 다시 인코딩하지 않았다.
- CORTIS·LE SSERAFIM은 이번 시험에서 업로드·원본 복원하지 않고 현재 경량본 주소를 유지한다.

## 읽기 전용 다운로드 검증

`python scripts/check-tws-storage.py --url '위 공개 주소'`로 검증했다.

| 요청 | 상태 | 전체 전송 시간 | 평균 속도 | CDN 응답 |
| --- | --- | ---: | ---: | --- |
| Range 0–1023 | 206, 원본 앞 1,024bytes 일치 | 별도 측정 안 함 | — | — |
| 전체 파일 1회 | 200, 원본 SHA256 일치 | 0.552초 | 33.841Mbps | HIT |
| 전체 파일 2회 | 200, 원본 SHA256 일치 | 0.535초 | 34.972Mbps | HIT |

두 요청은 브라우저 캐시를 사용하지 않았지만 **CDN 캐시는 HIT**였다.
영상 재생 시작·전체 페이지 완료·사용자별 첫 접속 평균을 측정한 결과는 아니다.
앞선 ngrok 원본 전송 28.889초와는 시점·경로가 다르며 통제된 비교로 표현하지 않는다.

## 프론트 연결·로컬 검증

- `heroVideos.ts`의 TWS src만 위 공개 원본 URL로 연결했다. 나머지 영상·배너 레이아웃은 유지한다.
- 새 Supabase SDK·키·환경변수는 추가하지 않았다. 일반 공개 영상 URL로 직접 요청한다.
- 로컬 경량 자산 기록에 TWS `active_src`를 표시해, 보존된 경량본과 실제 사용 주소를 구분했다.
- 정적 파일명뿐 아니라 HTTPS 영상 주소도 배포 도구가 검사하도록 보완했다.
- lint·typecheck·프론트 37개 테스트와 Linux 운영 이미지 빌드 통과.
- 외부 URL의 Range 응답을 포함한 상품 지연 검사·web 교체/복구 모의 검사 통과.
- 브라우저에서 상품 영역이 대기하는 중에도 외부 원본 TWS 배너 재생 확인.

현재는 업로드·다운로드·로컬 연결 검증 단계다. 학원 서버 홈페이지의 실제 시험 배포 완료는
서버 실행 결과를 확인한 후 별도로 기록한다. 유료 요금제 전환은 하지 않았다.
