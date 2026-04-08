import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBoardListHtml } from "../../src/scrapers/board-scraper.js";
import { ScraperError } from "../../src/errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, "fixtures", name);

const CONFIG = {
  id: "general",
  baseUrl: "https://www.mju.ac.kr/mjukr/255/subview.do",
};
const SCRAPED_AT = "2026-04-08T12:30:00.000Z";

describe("parseBoardListHtml — happy path", () => {
  it("extracts 4 notices from fixture", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    expect(notices).toHaveLength(4);
  });

  it("builds canonical detail URL from onclick", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    expect(notices[0]!.url).toBe(
      "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do",
    );
    expect(notices[0]!.id).toBe("general:230921");
  });

  it("handles href-based link (third row)", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    const third = notices[2]!;
    expect(third.url).toBe(
      "https://www.mju.ac.kr/bbs/mjukr/141/230919/artclView.do",
    );
    expect(third.id).toBe("general:230919");
  });

  it("normalizes whitespace in titles", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    expect(notices[0]!.title).toBe("2026학년도 1학기 수강정정 안내");
    expect(notices[2]!.title).toBe("2026학년도 학위수여식 안내");
  });

  it("parses YYYY.MM.DD date as KST", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    // 2026.04.07 KST 00:00 → 2026-04-06T15:00:00Z
    expect(notices[0]!.postedAt).toBe("2026-04-06T15:00:00.000Z");
  });

  it("parses date with time", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    // 2026.04.01 09:30 KST → 2026-04-01T00:30:00Z
    expect(notices[3]!.postedAt).toBe("2026-04-01T00:30:00.000Z");
  });

  it("captures author", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    expect(notices[0]!.author).toBe("학사지원팀");
    expect(notices[1]!.author).toBe("교무처");
  });

  it("uses given scrapedAt for all items", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);

    for (const n of notices) expect(n.scrapedAt).toBe(SCRAPED_AT);
  });

  it("respects limit", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 2);
    expect(notices).toHaveLength(2);
  });

  it("tags all notices with source id", async () => {
    const html = await fs.readFile(fixture("board-list.html"), "utf-8");
    const notices = parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30);
    for (const n of notices) expect(n.source).toBe("general");
  });
});

describe("parseBoardListHtml — sad paths", () => {
  it("throws ScraperError when no table present", async () => {
    const html = await fs.readFile(fixture("no-table.html"), "utf-8");
    expect(() => parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30)).toThrow(
      ScraperError,
    );
  });

  it("throws ScraperError on empty board (no usable rows)", async () => {
    const html = await fs.readFile(fixture("empty-board.html"), "utf-8");
    expect(() => parseBoardListHtml(html, CONFIG, SCRAPED_AT, 30)).toThrow(
      ScraperError,
    );
  });
});
