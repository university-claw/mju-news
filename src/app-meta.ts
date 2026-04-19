/**
 * 앱 메타데이터 상수. package.json과 동기화.
 *
 * v2.0.0 — 스크래퍼에서 `mju-public-data-worker` Reader로 피벗.
 * 스크래핑 책임은 worker가 가져갔고, 이 CLI는 Postgres read only.
 */
export const APP_NAME = "mju-news";
export const APP_VERSION = "2.0.0";
export const APP_DESCRIPTION =
  "명지대학교 공개 공지/학식 정보를 Postgres(`public_data` 스키마)에서 읽어 JSON으로 제공하는 Reader CLI 및 Agent Skill.";
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
