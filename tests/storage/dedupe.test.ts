import { describe, it, expect } from "vitest";
import {
  buildNoticeId,
  extractStableKey,
  hashFallback,
} from "../../src/storage/dedupe.js";

describe("extractStableKey", () => {
  it("extracts articleNo from path pattern", () => {
    expect(
      extractStableKey(
        "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do",
      ),
    ).toBe("230921");
  });

  it("extracts from artclForm path too", () => {
    expect(
      extractStableKey(
        "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclForm.do",
      ),
    ).toBe("230921");
  });

  it("extracts articleNo query parameter", () => {
    expect(
      extractStableKey("https://example.com/board.do?articleNo=12345"),
    ).toBe("12345");
  });

  it("extracts nttId query parameter", () => {
    expect(
      extractStableKey("https://example.com/view?nttId=67890&foo=bar"),
    ).toBe("67890");
  });

  it("returns null for URLs with no stable key", () => {
    expect(extractStableKey("https://www.mju.ac.kr/mjukr/255/subview.do")).toBe(
      null,
    );
  });

  it("returns null for invalid URLs", () => {
    expect(extractStableKey("not-a-url")).toBe(null);
  });
});

describe("hashFallback", () => {
  it("produces 12-char hex", () => {
    const h = hashFallback("title", "2026-04-08T00:00:00.000Z");
    expect(h).toHaveLength(12);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is stable for same input", () => {
    const a = hashFallback("제목", "2026-04-08T00:00:00.000Z");
    const b = hashFallback("제목", "2026-04-08T00:00:00.000Z");
    expect(a).toBe(b);
  });

  it("differs on title change (even whitespace outside trim)", () => {
    const a = hashFallback("제목 A", "2026-04-08T00:00:00.000Z");
    const b = hashFallback("제목 B", "2026-04-08T00:00:00.000Z");
    expect(a).not.toBe(b);
  });
});

describe("buildNoticeId", () => {
  it("uses source prefix with stable key", () => {
    const id = buildNoticeId(
      "general",
      "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do",
      "title",
      "2026-04-08T00:00:00.000Z",
    );
    expect(id).toBe("general:230921");
  });

  it("falls back to hash when URL has no key", () => {
    const id = buildNoticeId(
      "general",
      "https://www.mju.ac.kr/mjukr/255/subview.do",
      "제목",
      "2026-04-08T00:00:00.000Z",
    );
    expect(id).toMatch(/^general:[0-9a-f]{12}$/);
  });
});
