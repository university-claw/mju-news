---
name: getting-mju-news
version: 2.1.0
description: "명지대학교 공지(일반/장학/행사/진로)와 학식 식단을 조회하는 skill. '공지', '학교 새 소식', '장학금', '오늘 학식', '주간 식단' 등을 물을 때 사용. 공개 정보지만 mjuclaw 정책상 온보딩 완료 유저만 호출 가능 — 호출 전 mju auth status로 인증 확인 필수. 미인증이면 mju-onboarding으로 위임."
metadata:
  openclaw:
    category: "service"
    domain: "education"
    requires:
      bins: ["mju-news", "mju"]
---

# Getting MJU News

명지대학교 **공지 + 학식** 정보를 조회한다. 이 skill은 `mju-news` CLI를 통해 `mju-public-data-worker`가 수집·OCR·정규화해서 Postgres에 써둔 데이터를 **읽기만** 한다. 스크래핑은 이 skill이 하지 않는다.

## 사전 조건: 온보딩 필수

데이터 자체는 공개 정보지만, **mjuclaw 정책상 이 skill은 온보딩 완료 유저만 사용 가능**하다. 호출 전 항상 인증 상태를 먼저 확인:

```bash
mju auth status --app-dir /data/users/{DISCORD_USER_ID} --format json
```

`authenticated: false` 또는 에러면 `mju-onboarding` skill로 위임하고, 이 skill은 호출하지 않는다.

## 언제 사용

**(인증 확인 후)** 다음 상황에서 호출:
- 유저가 "공지", "새 공지", "장학금 소식", "학사 일정", "취업 공고"를 물을 때 → `notices recent` / `notices search`
- 특정 공지 상세가 필요하면 → `notices get <id>`
- 유저가 "오늘 학식", "점심 뭐야", "내일 식단"을 물을 때 → `cafeterias today`
- 주간 식단이 필요하면 → `cafeterias week --start <월요일>`

다음은 다른 skill:
- 개인 성적/출석/과제/시간표 → `mju-shared` (mju CLI)
- 도서관/스터디룸 예약 → `mju-shared`

## 공지 소스

| id | 이름 |
|---|---|
| `general` | 일반공지 |
| `scholarship` | 장학/학자금공지 |
| `event` | 행사공지 |
| `career` | 진로/취업/창업공지 |

## 학식 소스

| id | 이름 | 비고 |
|---|---|---|
| `student-hall` | 학생회관 | 평일 + 주말 |
| `myeongjin` | 명진당 | 평일 |
| `bokji` | 복지동 | 평일 |
| `bangmok` | 방목기념관 | 평일 |

## 주요 명령

```bash
# 최신 공지 20건
mju-news notices recent --format json

# 카테고리 필터
mju-news notices recent --category scholarship --limit 10 --format json

# 키워드 검색 (제목/본문/카테고리 부분 일치)
mju-news notices search --q "장학금" --since 2026-04-01 --format json

# 공지 상세 (본문 + 첨부 추출 텍스트 + 이미지 OCR)
mju-news notices get general:12345 --format json

# 오늘 학식 (KST 기준)
mju-news cafeterias today --format json
mju-news cafeterias today --meal lunch --where student-hall --format json
mju-news cafeterias today --date 2026-04-18 --format json

# 주간 학식
mju-news cafeterias week --start 2026-04-14 --format json
```

## 응답 스키마 요약

**공지 요약 (`notices recent` / `notices search`)**
```json
{
  "total": 2,
  "items": [
    {
      "id": "general:12345",
      "source": "general",
      "sourceName": "일반공지",
      "title": "…",
      "categoryLabel": null,
      "url": "https://www.mju.ac.kr/…",
      "publishedAt": "2026-04-15T00:00:00.000Z",
      "firstSeenAt": "2026-04-15T06:00:00.000Z",
      "hasAttachments": true,
      "hasImages": false
    }
  ]
}
```

**공지 상세 (`notices get`)**
- `bodyText` — 본문 텍스트
- `attachments[].extraction.text` — PDF/DOCX/HWPX 추출 텍스트
- `images[].ocr.text` — 본문 이미지 OCR 결과

**학식 (`cafeterias today` / `week`)**
```json
{
  "total": 1,
  "items": [
    {
      "sourceId": "student-hall",
      "sourceName": "학생회관",
      "serviceDate": "2026-04-17",
      "mealType": "lunch",
      "isClosed": false,
      "menuText": "…",
      "menuItems": []
    }
  ]
}
```

## 유저 응답 포맷팅 가이드 (Discord)

- **간결하게** — 제목 + 날짜 + 링크 (공지), 식당/끼니/메뉴 (학식)
- **우선순위** — `publishedAt` / `serviceDate` 최신순
- **카테고리 이모지**
  - 📢 일반공지 · 💰 장학 · 🎉 행사 · 💼 진로
  - 🍚 학식
- **상세 요청 시** — `notices get <id>`로 본문/첨부 텍스트까지 가져와서 요약
- 마크다운 링크/코드블록은 Discord가 지원하므로 자유롭게 써도 됨

## 제약 사항

- **온보딩 완료 유저 전용** — 미인증 유저 호출 금지 (위 "사전 조건" 참고). 이 skill은 데이터 자체는 공개여도 mjuclaw 접근 정책에 따라 인증 게이트를 따른다.
- **공개 데이터만** — SSO 필요한 개인 데이터는 이 skill 범위 밖, `mju-shared` 사용
- **실시간 아님** — worker scheduler가 15분 간격으로 돌기 때문에 방금 올라온 공지는 최대 15분 지연
- **DB 장애** — `doctor` 명령으로 진단. `database.connected=false`면 worker·Postgres 상태를 확인
- **실시간 push 금지** — 메신저 플랫폼(Discord) DM 응답 트랜잭션 안에서만 호출
