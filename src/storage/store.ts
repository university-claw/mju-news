import fs from "node:fs/promises";
import path from "node:path";
import { StoreError } from "../errors.js";
import type { Notice, NoticeSource } from "../types.js";

/** notices.json 파일의 disk schema. */
interface StoreFile {
  version: number;
  updatedAt: string;
  notices: Notice[];
}

const STORE_VERSION = 1;
const FILE_NAME = "notices.json";

/**
 * 파일 기반 Notice 저장소.
 *
 * 1.0에서는 SQLite 대신 JSON 한 파일. 명세 §10 참고.
 * cron(단일 프로세스)에서만 쓰이므로 파일 락은 생략.
 * 부분 쓰기로 인한 손상 방지를 위해 atomic write (tmp → rename) 적용.
 */
export class NoticeStore {
  private readonly filePath: string;
  private cache = new Map<string, Notice>();
  private loaded = false;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, FILE_NAME);
  }

  /** 저장소 파일을 읽어 인메모리 캐시 구성. 파일이 없으면 빈 맵. */
  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const data = JSON.parse(raw) as StoreFile;
      if (!data || !Array.isArray(data.notices)) {
        throw new StoreError("notices.json has invalid shape");
      }
      this.cache = new Map(data.notices.map((n) => [n.id, n]));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        this.cache = new Map();
      } else if (err instanceof SyntaxError || err instanceof StoreError) {
        // 손상 → 백업 후 새 Store로 시작
        const backup = `${this.filePath}.corrupted-${Date.now()}.json`;
        await fs.rename(this.filePath, backup).catch(() => {
          // 백업 실패해도 계속 — 사용자 데이터는 원본 그대로 둔다
        });
        process.stderr.write(
          `[store] corrupted notices.json backed up to ${backup}\n`,
        );
        this.cache = new Map();
      } else {
        throw err;
      }
    }
    this.loaded = true;
  }

  /**
   * 캐시를 디스크에 원자적으로 기록한다.
   *
   * 쓰기 순서: tmp 파일 생성 → fsync 생략(비용) → rename.
   * 같은 파티션 내 rename은 posix atomic이므로 중간에 죽어도 기존 파일은 안전.
   */
  async save(): Promise<void> {
    this.assertLoaded();
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const data: StoreFile = {
      version: STORE_VERSION,
      updatedAt: new Date().toISOString(),
      notices: [...this.cache.values()].sort(sortByPostedDesc),
    };

    const tmp = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmp, this.filePath);
  }

  /**
   * 새 공지들을 병합한다. 이미 존재하는 ID는 **덮어쓰지 않는다** —
   * scrapedAt 타임스탬프를 안정적으로 유지해 `new --since` 쿼리가 일관되도록.
   * @returns 실제로 추가된 Notice 배열
   */
  merge(incoming: Notice[]): Notice[] {
    this.assertLoaded();
    const added: Notice[] = [];
    for (const notice of incoming) {
      if (!this.cache.has(notice.id)) {
        this.cache.set(notice.id, notice);
        added.push(notice);
      }
    }
    return added;
  }

  /**
   * 조건 필터링 + 정렬 + limit 적용한 Notice 목록.
   *
   * - `since`: `scrapedAt > since`인 항목만 (증분 조회용).
   *   `postedAt`이 아니라 `scrapedAt` 기준이다 — 게시일이 오래된 공지가
   *   뒤늦게 발견되어도 "새 공지"로 잡혀야 하기 때문.
   * - 정렬: `postedAt` 내림차순 (유저가 최신 게시일부터 보기 원함).
   */
  list(
    options: {
      source?: NoticeSource;
      since?: string;
      limit?: number;
    } = {},
  ): Notice[] {
    this.assertLoaded();
    let items = [...this.cache.values()];
    if (options.source) {
      items = items.filter((n) => n.source === options.source);
    }
    if (options.since) {
      const since = options.since;
      items = items.filter((n) => n.scrapedAt > since);
    }
    items.sort(sortByPostedDesc);
    if (options.limit !== undefined && options.limit >= 0) {
      items = items.slice(0, options.limit);
    }
    return items;
  }

  /** 현재 캐시 크기. */
  size(): number {
    this.assertLoaded();
    return this.cache.size;
  }

  /** 저장소 파일의 절대 경로. */
  get path(): string {
    return this.filePath;
  }

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new StoreError("NoticeStore.load() must be called first");
    }
  }
}

function sortByPostedDesc(a: Notice, b: Notice): number {
  // ISO 8601 문자열은 lexicographic 정렬이 시간순과 일치.
  if (a.postedAt === b.postedAt) {
    return a.id.localeCompare(b.id);
  }
  return b.postedAt.localeCompare(a.postedAt);
}
