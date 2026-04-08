import { MjukrBoardScraper } from "./board-scraper.js";
import type { ScraperConfig } from "./base.js";

/**
 * 일반공지 (general notices).
 *
 * 명지대 공식 사이트의 "대학생활 > 공지사항 > 일반공지" 게시판.
 * 사실상 학사/등록/수강/장학(일부)/학위수여 등 대학 본부의 공지가
 * 모두 여기에 올라온다 — mjuclaw가 가장 많이 의존하는 소스.
 *
 * menu ID 255, bbs ID 141 (runtime에 onclick에서 추출).
 * 게시물 수: ~1700+ (2026-04 기준).
 */
export const GENERAL_NOTICE_CONFIG: ScraperConfig = {
  id: "general",
  name: "일반공지",
  baseUrl: "https://www.mju.ac.kr/mjukr/255/subview.do",
  enabled: true,
};

export class GeneralNoticeScraper extends MjukrBoardScraper {
  constructor() {
    super(GENERAL_NOTICE_CONFIG);
  }
}
