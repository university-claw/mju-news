/**
 * 앱 메타데이터 상수.
 * package.json과 동기화해야 한다 — 빌드 시 자동 주입이 아님.
 */
export const APP_NAME = "mju-news";
export const APP_VERSION = "0.1.0";
export const APP_DESCRIPTION =
  "명지대학교 공개 학사/장학/일반 공지를 스크래핑해 JSON으로 제공하는 독립 CLI 및 Agent Skill.";
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION} (Myongji University public notice scraper)`;
