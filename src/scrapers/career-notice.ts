import { MjukrBoardScraper } from "./board-scraper.js";
import type { ScraperConfig } from "./base.js";

/**
 * 진로/취업/창업공지 (career/employment/startup notices).
 *
 * 명지대 공식 사이트의 "대학생활 > 공지사항 > 진로/취업/창업공지" 게시판.
 * 채용, 인턴십, 창업 지원 공지.
 *
 * menu ID 260.
 */
export const CAREER_NOTICE_CONFIG: ScraperConfig = {
  id: "career",
  name: "진로/취업/창업공지",
  baseUrl: "https://www.mju.ac.kr/mjukr/260/subview.do",
  enabled: true,
};

export class CareerNoticeScraper extends MjukrBoardScraper {
  constructor() {
    super(CAREER_NOTICE_CONFIG);
  }
}
