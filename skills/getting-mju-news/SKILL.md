---
name: getting-mju-news
version: 1.0.0
description: "명지대학교 공개 공지(일반/장학/행사/취업)를 조회하는 skill. 유저가 '학교 공지', '새 공지', '장학금 소식', '학사 일정' 등을 물을 때 사용. 로그인 불필요한 공개 게시판만 다룸. 개인 성적/수강/출석 등은 mju-lms 같은 다른 skill 사용."
metadata:
  openclaw:
    category: "service"
    domain: "education"
    requires:
      bins: ["mju-news"]
---

# Getting MJU News

명지대학교 공개 공지사항을 조회한다. 이 skill은 `mju-news` CLI를 통해
로컬에 저장된 공지를 읽거나, mjuclaw-server의 원격 API를 호출한다.

## 언제 사용

다음 상황에서 호출:
- 유저가 "학교 공지 알려줘", "새 공지 있어?", "장학금 소식" 을 물을 때
- 유저가 "최근 학사 일정", "학교에 뭐 새로 올라왔어?" 를 물을 때
- 에이전트가 유저와 대화 시작 시 새 공지가 있는지 확인하려 할 때

다음 상황에서는 다른 skill 사용:
- 개인 성적/출석/과제/시간표 → `mju-lms`, `mju-msi`, `mju-ucheck`
- 강의실/도서관 시설 검색 → `mju-library`
- 수강신청 본인 데이터 → `mju-lms`

## 사용 가능한 소스

| id            | 이름                 | 용도                                    |
|---------------|----------------------|-----------------------------------------|
| `general`     | 일반공지             | 학사/등록/수강/학위수여 등 대학본부 공지 |
| `scholarship` | 장학/학자금공지      | 국가장학금, 교내장학금, 학자금 대출     |
| `event`       | 행사공지             | 행사, 이벤트, 공모전                    |
| `career`      | 진로/취업/창업공지   | 채용, 인턴십, 창업 지원                 |

모든 소스는 `https://www.mju.ac.kr/mjukr/<menuId>/subview.do` 형태의
공개 게시판이며, 로그인 없이 접근 가능하다.

## 사용 방법

### 로컬 CLI

```bash
# 최신 공지 50건 (모든 소스)
mju-news list --format json --limit 50

# 일반공지만
mju-news list --source general --format json

# 1시간 이내 새로 수집된 공지 (mjuclaw-server가 주로 사용)
mju-news new --since "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" --format json

# 특정 source의 새 공지
mju-news new --since 2026-04-08T00:00:00Z --source scholarship --format json

# 스크랩 (cron이 30분마다 호출)
mju-news scrape --format json
```

### 원격 API (NemoClaw 샌드박스 환경)

샌드박스에는 로컬 CLI가 설치되지 않았을 수 있다. `mjuclaw-server`의
공개 API를 ngrok 고정 도메인으로 호출한다.

```bash
# 최근 공지 20건
curl "https://histographic-numerally-miguel.ngrok-free.dev/api/news?limit=20"

# since 파라미터로 증분 조회
curl "https://histographic-numerally-miguel.ngrok-free.dev/api/news?since=2026-04-08T00:00:00Z"

# 특정 source 필터
curl "https://histographic-numerally-miguel.ngrok-free.dev/api/news?source=scholarship&limit=10"
```

## 응답 스키마

```json
{
  "total": 3,
  "items": [
    {
      "id": "general:230921",
      "source": "general",
      "title": "2026학년도 1학기 수강정정 안내",
      "url": "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do",
      "postedAt": "2026-04-07T00:00:00.000Z",
      "scrapedAt": "2026-04-08T12:30:00.000Z",
      "author": "학사지원팀"
    }
  ]
}
```

필드 의미:
- `id`: `<source>:<articleNo>` — 재스크랩해도 동일
- `postedAt`: 학교 사이트에 표시된 게시일 (KST → UTC 변환됨)
- `scrapedAt`: 우리가 수집한 시각 — `new --since` 필터 기준
- `url`: 원본 상세 페이지 링크

## 유저 응답 포맷팅 가이드

카카오톡 응답으로 보여줄 때:

- **간결하게** — 제목 + 날짜 + 링크 (본문 요약은 생략)
- **우선순위** — `postedAt` 최신순, source 혼합 가능
- **카테고리 이모지**
  - 📢 일반공지 (`general`)
  - 💰 장학/학자금공지 (`scholarship`)
  - 🎉 행사공지 (`event`)
  - 💼 진로/취업/창업공지 (`career`)
- **링크 포함** — 유저가 원문을 볼 수 있도록 `url` 항상 포함
- **카카오톡 말풍선 제약** — simpleText 900자 이내, basicCard description 80자 이내
- **마크다운 금지** — 카카오는 마크다운을 렌더링하지 않음

예시 출력:
```
📢 일반공지 2건
• [2026.04.07] 2026학년도 1학기 수강정정 안내
  https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do
• [2026.04.05] 중간고사 일정 공지
  https://www.mju.ac.kr/bbs/mjukr/141/230920/artclView.do

💰 장학/학자금공지 1건
• [2026.04.06] 국가장학금 2차 신청 안내
  https://www.mju.ac.kr/bbs/mjukr/142/45678/artclView.do
```

## 제약 사항

- **공개 데이터만** — SSO 필요한 개인 데이터는 이 skill 범위 밖
- **실시간 아님** — cron이 30분마다 스크랩. 방금 올라온 공지는 최대 30분 지연
- **스크래핑 실패** — 학교 사이트가 다운되거나 마크업이 바뀌면 `doctor` 커맨드로 진단. 응답에 `error` 필드가 있으면 해당 source만 실패.
- **외부 호출 없음** — 이 skill은 mjuclaw 자체 서버(ngrok 도메인)만 호출. 제3자 사이트로 데이터를 보내지 않음.
- **rate limit** — 학교 사이트에 과도한 요청 금지. cron 간격(30분)을 줄이지 말 것.
