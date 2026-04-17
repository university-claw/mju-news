# mju-news

> 명지대학교 공개 정보(공지 + 학식) **Reader** CLI — `mju-public-data-worker`가 쓴 Postgres를 읽어 JSON으로 제공한다.

**v2.0.0부터 정체성이 바뀌었다.** 이 레포는 더 이상 HTML을 긁지 않는다. 스크래핑·OCR·정규화는 [`mju-public-data-worker`](../mju-public-data-worker)가 전담하고, `mju-news`는 worker가 쓴 `public_data` 스키마를 읽어 mjuclaw Discord agent에게 JSON으로 돌려주는 **브릿지 스킬**이다. 변경 이력은 [`CHANGELOG.md`](./CHANGELOG.md).

## 역할 분담

| 레포 | 역할 |
|---|---|
| `mju-public-data-worker` | 공지/학식 수집·OCR·정규화 → Postgres `public_data` write |
| **`mju-news` (this)** | Postgres **read only** → Discord agent가 `exec`으로 소비 |
| `mju-cli` | 개인 SSO 기반 LMS/MSI/UCheck/Library (영역 다름) |

## 요구 사항

- Node ≥ 22, TypeScript 5.9+
- Postgres (호스트에 설치). worker와 **같은 DB·스키마**를 바라봐야 함 (기본 `mjuclaw` / `public_data`)
- worker가 최소 1회 `migrate` + `collect`를 마쳐서 read model이 비어있지 않아야 의미 있는 응답이 나옴

## 설치/빌드

```bash
cp .env.example .env           # PG 접속 정보 채우기
npm install
npm run check                  # 타입 검사
npm run build                  # tsc → dist/
```

## 사용법

```bash
# 최신 공지
mju-news notices recent --format json
mju-news notices recent --category scholarship --limit 10

# 검색
mju-news notices search --q "장학금" --since 2026-04-01

# 상세 (본문 + 첨부 추출 + 이미지 OCR)
mju-news notices get general:12345

# 오늘 학식 (KST)
mju-news cafeterias today --format json
mju-news cafeterias today --meal lunch --where student-hall

# 주간
mju-news cafeterias week --start 2026-04-14

# 건강 체크
mju-news doctor

# 스킬 카탈로그
mju-news skills list
```

모든 명령의 기본 출력은 **JSON**. `--format table`로 사람용 테이블 렌더, `-v / --verbose`로 stderr 디버그.

## 환경변수

`.env.example` 참고.

| key | 기본값 |
|---|---|
| `PGHOST` | `127.0.0.1` |
| `PGPORT` | `5432` |
| `PGDATABASE` | (필수) |
| `PGUSER` | (필수) |
| `PGPASSWORD` | (필수) |
| `PGSCHEMA` | `public_data` |

## 테스트

```bash
npm test            # vitest run
npm run test:watch
```

## 제약

- **공개 데이터만** — 개인 SSO 데이터는 `mju-cli`
- **실시간 push 금지** — 모든 조회는 pull. 메신저 트랜잭션 안에서만 호출
- **worker 의존** — DB 쓰는 쪽은 worker. 빈 응답이면 worker scheduler를 먼저 확인

## 라이선스

MIT
