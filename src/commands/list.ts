import { Command } from "commander";
import { NoticeStore } from "../storage/store.js";
import { resolveDataDir } from "../storage/paths.js";
import { listScraperIds } from "../scrapers/index.js";
import { printData } from "../output/print.js";
import { InputError } from "../errors.js";
import type { ListResult } from "../types.js";
import { readGlobalOptions, validateIsoTimestamp } from "./common.js";

/**
 * `mju-news list` — 저장된 공지 조회.
 *
 * `--since`는 `scrapedAt` 기준이다 (postedAt이 아님). 사이트에서 늦게
 * 발견되는 공지도 "우리 기준 신규"로 포함되도록.
 */
export function buildListCommand(): Command {
  const cmd = new Command("list")
    .description("저장된 공지를 조회")
    .option("--source <id>", "특정 source로 필터링")
    .option("--since <iso>", "scrapedAt > since 인 항목만 (ISO 8601)")
    .option("--limit <n>", "최대 개수", "50")
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);
      const opts = thisCmd.opts<{
        source?: string;
        since?: string;
        limit: string;
      }>();

      if (opts.source && !listScraperIds().includes(opts.source)) {
        throw new InputError(
          `unknown source: ${opts.source}. known: ${listScraperIds().join(", ")}`,
        );
      }

      const limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit < 0) {
        throw new InputError(`--limit must be a non-negative integer`);
      }

      const since = opts.since
        ? validateIsoTimestamp(opts.since, "--since")
        : undefined;

      const dataDir = resolveDataDir(global.dataDir || undefined);
      const store = new NoticeStore(dataDir);
      await store.load();

      const listOpts: {
        source?: string;
        since?: string;
        limit?: number;
      } = { limit };
      if (opts.source) listOpts.source = opts.source;
      if (since) listOpts.since = since;

      const items = store.list(listOpts);
      const result: ListResult = { total: items.length, items };
      printData(result, global.format, "notices");
    });
  return cmd;
}
