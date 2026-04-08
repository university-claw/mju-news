import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NoticeStore } from "../../src/storage/store.js";
import type { Notice } from "../../src/types.js";

let tmpDir: string;
let store: NoticeStore;

const makeNotice = (overrides: Partial<Notice> = {}): Notice => ({
  id: "general:1",
  source: "general",
  title: "테스트 공지",
  url: "https://www.mju.ac.kr/bbs/mjukr/141/1/artclView.do",
  postedAt: "2026-04-01T00:00:00.000Z",
  scrapedAt: "2026-04-08T00:00:00.000Z",
  ...overrides,
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mju-news-test-"));
  store = new NoticeStore(tmpDir);
  await store.load();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("NoticeStore.merge", () => {
  it("adds new notices and returns them", () => {
    const added = store.merge([makeNotice()]);
    expect(added).toHaveLength(1);
    expect(store.size()).toBe(1);
  });

  it("ignores duplicates on second merge", () => {
    const n = makeNotice();
    store.merge([n]);
    const added = store.merge([n]);
    expect(added).toHaveLength(0);
    expect(store.size()).toBe(1);
  });

  it("does not overwrite existing scrapedAt", () => {
    const first = makeNotice({ scrapedAt: "2026-04-08T00:00:00.000Z" });
    store.merge([first]);
    const second = makeNotice({ scrapedAt: "2026-04-09T00:00:00.000Z" });
    store.merge([second]);
    const items = store.list();
    expect(items).toHaveLength(1);
    expect(items[0]!.scrapedAt).toBe("2026-04-08T00:00:00.000Z");
  });
});

describe("NoticeStore.list", () => {
  beforeEach(() => {
    store.merge([
      makeNotice({
        id: "general:1",
        postedAt: "2026-04-01T00:00:00.000Z",
        scrapedAt: "2026-04-07T00:00:00.000Z",
      }),
      makeNotice({
        id: "general:2",
        postedAt: "2026-04-03T00:00:00.000Z",
        scrapedAt: "2026-04-08T00:00:00.000Z",
      }),
      makeNotice({
        id: "scholarship:1",
        source: "scholarship",
        postedAt: "2026-04-02T00:00:00.000Z",
        scrapedAt: "2026-04-08T00:00:00.000Z",
      }),
    ]);
  });

  it("sorts by postedAt descending", () => {
    const items = store.list();
    expect(items.map((n) => n.id)).toEqual([
      "general:2",
      "scholarship:1",
      "general:1",
    ]);
  });

  it("filters by source", () => {
    const items = store.list({ source: "scholarship" });
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe("scholarship");
  });

  it("filters by scrapedAt > since", () => {
    const items = store.list({ since: "2026-04-07T12:00:00.000Z" });
    expect(items.map((n) => n.id)).toEqual(["general:2", "scholarship:1"]);
  });

  it("applies limit", () => {
    expect(store.list({ limit: 2 })).toHaveLength(2);
  });
});

describe("NoticeStore.save/load", () => {
  it("roundtrips through disk", async () => {
    store.merge([makeNotice({ id: "general:42" })]);
    await store.save();

    const reopened = new NoticeStore(tmpDir);
    await reopened.load();
    expect(reopened.size()).toBe(1);
    expect(reopened.list()[0]!.id).toBe("general:42");
  });

  it("recovers from corrupted file by backing up", async () => {
    await fs.writeFile(path.join(tmpDir, "notices.json"), "{not valid json");
    const fresh = new NoticeStore(tmpDir);
    await fresh.load();
    expect(fresh.size()).toBe(0);
    const entries = await fs.readdir(tmpDir);
    expect(entries.some((f) => f.includes("corrupted"))).toBe(true);
  });
});
