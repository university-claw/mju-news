import { describe, it, expect } from "vitest";
import {
  buildArticleDetailUrl,
  collapseWhitespace,
  extractArticleNoFromOnclick,
  parseKoreanDate,
} from "../../src/scrapers/helpers.js";

describe("parseKoreanDate", () => {
  it("parses YYYY.MM.DD as KST midnight", () => {
    const iso = parseKoreanDate("2026.04.08");
    // KST midnight == 2026-04-07T15:00:00Z
    expect(iso).toBe("2026-04-07T15:00:00.000Z");
  });

  it("parses YYYY-MM-DD HH:MM as KST", () => {
    const iso = parseKoreanDate("2026-04-08 09:00");
    // KST 09:00 == UTC 00:00
    expect(iso).toBe("2026-04-08T00:00:00.000Z");
  });

  it("parses YY.MM.DD as 20YY", () => {
    const iso = parseKoreanDate("26.04.08");
    expect(iso).toBe("2026-04-07T15:00:00.000Z");
  });

  it("throws on empty string", () => {
    expect(() => parseKoreanDate("")).toThrow();
  });

  it("throws on garbage", () => {
    expect(() => parseKoreanDate("not a date")).toThrow();
  });

  it("throws on invalid month", () => {
    expect(() => parseKoreanDate("2026.13.01")).toThrow();
  });
});

describe("extractArticleNoFromOnclick", () => {
  it("extracts from jf_viewArtcl pattern", () => {
    const v = extractArticleNoFromOnclick(
      "jf_viewArtcl('mjukr','141','230921','t')",
    );
    expect(v).toBe("230921");
  });

  it("returns null for unrelated onclick", () => {
    expect(extractArticleNoFromOnclick("alert('hi')")).toBe(null);
  });

  it("returns null for undefined input", () => {
    expect(extractArticleNoFromOnclick(undefined)).toBe(null);
  });
});

describe("buildArticleDetailUrl", () => {
  it("builds canonical mju detail url", () => {
    expect(
      buildArticleDetailUrl(
        "https://www.mju.ac.kr",
        "mjukr",
        "141",
        "230921",
      ),
    ).toBe("https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do");
  });
});

describe("collapseWhitespace", () => {
  it("collapses multiple spaces and newlines", () => {
    expect(collapseWhitespace("  a \n\t b   c ")).toBe("a b c");
  });
});
