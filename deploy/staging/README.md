# 학원 서버 FastAPI 실행

**10/26 서버 적용·DB 연결·외부 Swagger 검증을 완료했습니다.** 현재 상태와 팀원/에이전트
인계 사항은 [docs/STAGING.md](../../docs/STAGING.md)를 먼저 확인합니다.
아래 비밀 환경 파일 생성 명령은 새 환경 최초 준비용이며, 현재 서버에는 이미 파일이 있습니다.

**10/27부터 이 Compose는 FastAPI(api)와 Next.js 화면(web)을 함께 실행합니다** (아래 "화면 함께 배포"). 예전 안내: FastAPI만 실행, Next.js, 새 인증/상품/주문 API는
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

## 화면(Next.js) 함께 배포 (10/27 추가)

팀원 누구나 자기 PC 브라우저에서 같은 사이트를 열 수 있게, ngrok 공개 주소 **하나**로 화면과 API를 함께 연다.

```
브라우저 → ngrok 공개 주소 → web(Next.js, 127.0.0.1:3022)
                               ├ 화면 페이지 (/products, /cart, /orders …)
                               └ /backend/* · /docs · /openapi.json · /health · /static/* → api(FastAPI, 컨테이너 내부 api:8000)
```

- 화면이 부르는 API 주소는 `공개주소/backend` (같은 주소라 CORS 설정이 필요 없다).
- 기존 Swagger·상태 확인 주소(`/docs`, `/health`)와 이미지(`/static/...`)는 그대로 쓸 수 있다.
- api는 `--root-path /backend`로 실행해 Swagger의 "Try it out"이 `/backend/...`로 요청한다.
  서버 내부에서 `127.0.0.1:8022/docs`를 직접 열면 Try it out은 동작하지 않는다 (공개 주소의 `/docs`를 쓴다).

### 서버에서 실행 (한 번)

```bash
cd ~/kant-moa/app && git fetch origin && git checkout main && git pull --ff-only
cp deploy/staging/compose.backend.yml deploy/staging/Dockerfile.backend deploy/staging/Dockerfile.frontend deploy/staging/Dockerfile.frontend.dockerignore ~/kant-moa/
cd ~/kant-moa
test -f web.env || echo 'NEXT_PUBLIC_API_URL=https://letdown-kilometer-nutcase.ngrok-free.dev/backend' > web.env
docker compose --env-file web.env -f compose.backend.yml up -d --build
docker compose -f compose.backend.yml ps
curl -s -o /dev/null -w "web %{http_code}
" http://127.0.0.1:3022/products
curl -s http://127.0.0.1:3022/backend/health
```

`web.env`의 공개 주소는 비밀값이 아니지만 서버에만 둔다. 화면 빌드에 들어가므로 주소가 바뀌면 `up -d --build`를 다시 한다.

### ngrok을 화면(3022)으로 전환

`/etc/systemd/system/kant-moa-ngrok.service`의 `ExecStart`에서 `http://127.0.0.1:8022`를 `http://127.0.0.1:3022`로 바꾼다.

```bash
sudo systemctl daemon-reload && sudo systemctl restart kant-moa-ngrok.service
systemctl status kant-moa-ngrok.service --no-pager
```

확인 (팀원 PC 브라우저): `공개주소/` 화면, `공개주소/docs` Swagger, `공개주소/health` → `{"status":"ok","database":"ok"}`.

**되돌리기**: ExecStart를 다시 `8022`로 바꾸고 재시작하면 예전처럼 API만 공개된다. web 컨테이너는 `docker compose -f compose.backend.yml stop web`.

### 주의

- 공개 주소의 화면은 **공용 DB**를 쓴다. 시연 주문·결제는 실제 공용 데이터로 남으니 시연 계정으로 소량만 하고, 실패·동시성 테스트는 하지 않는다 ([배포 사이트 테스트 가이드](../../docs/DEPLOYED_TEST_GUIDE.md)).
- 첫 접속 때 ngrok 무료 안내 페이지가 한 번 나올 수 있다 ("Visit Site"). 화면의 API 요청에는 안내를 건너뛰는 헤더가 이미 들어 있다.
