---
name: p3-finish-branch
description: P3(여름) 구현과 검증이 끝나고 커밋·push·PR로 마무리할 때 사용한다. 개인 브랜치(yeoreum 등)에서 최신 main 반영, 전체 검사, orders 파일만 커밋, PR 템플릿 작성까지의 순서를 정한다.
---

# P3 브랜치 마무리 (커밋·PR)

> 출처: [obra/superpowers](https://github.com/obra/superpowers) `finishing-a-development-branch` (commit `2ce8aa1`, MIT). 2조 규칙(main 직접 push 금지, PR 병합, 공통 파일 협의)과 `docs/PR_GUIDE.md`에 맞게 바꿨다.
> 우선순위: `CLAUDE.md` > `docs/PR_GUIDE.md` > `code-rules` > `p3-orders` > 이 파일.

## 0. 전제
- `main`에 직접 push하지 않는다. 개인 브랜치 → PR → 병합.
- 커밋·push·PR·병합은 사용자가 요청했을 때만 한다. 병합은 되돌리기 어려우니 매번 확인받는다.
- 처음 clone이면 hook을 켠다: `git config core.hooksPath .githooks` (`docs/PR_GUIDE.md` 1장).

## 1. 최신 main 반영
```bash
git fetch origin
git merge origin/main   # 충돌 나면 내 orders/ 쪽만 해결, 남의 파일은 담당자와 상의
```
- 병합 후 `uv sync`로 새 의존성을 맞추고, 새 필수 설정(예: `JWT_SECRET`) 때문에 테스트가 깨지지 않는지 본다.

## 2. 검사 (실패하면 여기서 멈추고 보고)
```bash
cd backend
uv run python scripts/check.py      # CI backend job과 같은 검사 (일회용 PostgreSQL)
```
- 필요하면 화면 + DB 증거(전→후) 확인까지 한다 (`p3-verification`).
- 실패가 있으면 커밋·PR 메뉴로 넘어가지 않고 실패 내용을 그대로 보고한다.

## 3. 커밋 범위 확인
- `git status`로 바뀐 파일을 보고 **이번 작업 파일만** 스테이징한다(`git add <파일>`; `git add -A` 금지).
- 넣지 않는 것: `.env`, 비밀값, 다른 담당 폴더, 진행 중인 다른 작업, 로컬 전용 `.claude/`·`CLAUDE.md`(팀이 올리기로 정하지 않은 경우).
- 공통 파일(`main.py`·`database.py`·`core/`·`compose.yaml`·`.github/`)이 들어가면 P1(희주) 협의 근거를 PR에 적는다.
- 커밋 메시지: `feat(orders): …` / `fix(orders): …` / `test(orders): …` 형식, 한국어로 무엇을 왜.

## 4. 선택지를 사용자에게 보여준다
1. push하고 PR 만들기 (기본)
2. 커밋만 하고 그대로 두기 (나중에 PR)
3. 버리기 → 무엇이 지워지는지 목록을 보여주고 사용자가 "버려"라고 직접 입력해야 진행

## 5. PR 작성 (`.github/pull_request_template.md` 그대로)
- 자동 테스트 표: CI 마지막 줄 숫자(passed/skipped)와 skipped 이유
- 새 API 테스트: 정상·401·403·대표 실패 code, 주문·재고면 rollback·동시성 테스트
- 실제 토큰 검증 표: 시나리오 / 기대 응답 / 실제 응답 / **DB 증거 (전 → 후)**
- 공통 파일 협의, DB 변경(없음/migration), 비밀값 체크
- 리뷰어에게: 남은 일, 미확정 항목(`p3-orders` 6장)

## 6. PR 후
- CI 결과를 확인하고, 실패하면 `p3-debugging`으로 원인부터 찾는다.
- 리뷰 코멘트는 `p3-code-review` B장대로 처리한다.
- 병합 뒤 다음 작업은 다시 1번(최신 main 반영)부터.
