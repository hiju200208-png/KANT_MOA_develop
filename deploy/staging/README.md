# 학원 서버 FastAPI 실행

**10/26 서버 적용·DB 연결·외부 Swagger 검증을 완료했습니다.** 현재 상태와 팀원/에이전트
인계 사항은 [docs/STAGING.md](../../docs/STAGING.md)를 먼저 확인합니다.
아래 비밀 환경 파일 생성 명령은 새 환경 최초 준비용이며, 현재 서버에는 이미 파일이 있습니다.

이 Compose 설정은 FastAPI만 실행합니다. Next.js, 새 인증/상품/주문 API는
포함하지 않습니다. 초기 확인 대상은 `/health`와 `/docs`입니다.
서버 ngrok는 별도 `kant-moa-ngrok.service`로 자동 실행 등록했으며,
상태·관리 명령은 [STAGING.md의 ngrok 항목](../../docs/STAGING.md#7-ngrok-실행-상태와-외부-검증)을 참고합니다.

서버에서 확인된 조건:

- 소스: `/home/kant/kant-moa/app`
- 기존 PostgreSQL 컨테이너: `dbresting-db-1`, 네트워크 `dbresting_default`
- 전용 DB/사용자: `kant_moa` (테이블 18개는 사용자 실행 결과로 확인)
- API 호스트 포트: `127.0.0.1:8022` (확인 시점 비어 있음)
- ngrok 설정: `/home/kant/kant-moa/ngrok.yml` (비밀 파일, Git에 넣지 않음)

`Dockerfile.backend`와 `compose.backend.yml`을 서버의 `~/kant-moa/`로 복사합니다.
이 Compose의 상대 경로는 그 위치를 기준으로 하며, 저장소의 개발용 `compose.yaml`과
별개입니다. 기존 컨테이너·네트워크·DB 볼륨은 생성·수정하지 않습니다.

## 비밀 환경 파일 만들기

서버 터미널에서 다음을 실행하고 **kant_moa DB 계정 비밀번호**를 직접 입력합니다.
SSH 비밀번호나 ngrok 토큰이 아닙니다. 파일이 이미 있으면 덮어쓰지 않고 중단합니다.

```bash
python3 -c 'import getpass, os; from pathlib import Path; from urllib.parse import quote; p=Path.home()/"kant-moa/backend.env"; password=getpass.getpass("kant_moa DB password: "); assert password, "Empty password"; url="postgresql+asyncpg://kant_moa:"+quote(password, safe="")+"@dbresting-db-1:5432/kant_moa"; fd=os.open(p, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600); f=os.fdopen(fd,"w"); f.write("DATABASE_URL="+url+"\n"); f.close(); print("Saved backend.env")'
```

`backend.env`는 소스 밖에 저장합니다. 파일 내용, `docker inspect` 전체 출력,
환경변수가 펼쳐진 Compose 설정은 채팅이나 Git에 올리지 않습니다.

## 실행·확인

```bash
cd ~/kant-moa
docker compose -f compose.backend.yml up -d --build api
docker compose -f compose.backend.yml ps
curl --fail --silent --show-error http://127.0.0.1:8022/health
```

`{"status":"ok","database":"ok"}`가 반환되면 서버 내부 DB 연결 확인 완료입니다.
ngrok은 이 8022 포트에 별도로 연결합니다. 기존 서비스의 8000/8021/8081에 연결하지 않습니다.

중지는 `docker compose -f compose.backend.yml stop api`입니다.
소스 변경 후에는 같은 `up -d --build api`로 다시 빌드합니다.
업로드 데이터는 전용 named volume에 저장하므로 일반 컨테이너 재생성 시 유지됩니다.
`down -v`는 사용하지 않습니다. 이 설정은 DB 스키마 변경이나 시드를 실행하지 않습니다.
