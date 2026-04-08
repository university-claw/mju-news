import { Command } from "commander";
import { NoticeStore } from "../storage/store.js";
import { resolveDataDir } from "../storage/paths.js";
import { getActiveScrapers, listScraperIds } from "../scrapers/index.js";
import { printData } from "../output/print.js";
import { InputError } from "../errors.js";
import type { ScrapeResult, SourceResult } from "../types.js";
import { readGlobalOptions } from "./common.js";

/**
 * `mju-news scrape` — 활성 스크래퍼를 돌려 저장소에 병합.
 *
 * 스크래퍼 격리: 한 소스의 실패가 다른 소스를 죽이지 않는다.
 * 부분 실패는 `sources[id].error`에 기록하고 exit code 0.
 * 전체 실패 시에만 exit code 1.
 */
export function buildScrapeCommand(): Command {
  const cmd = new Command("scrape")
    .description("활성 스크래퍼를 실행하고 결과를 data/notices.json에 병합")
    .option(
      "--sources <list>",
      "쉼표 구분 source id (예: general,scholarship)",
    )
    .option("--limit <n>", "source당 가져올 공지 수", "30")
    .option("--dry-run", "저장소에 쓰지 않고 결과만 반환", false)
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);
      const opts = thisCmd.opts<{
        sources?: string;
        limit: string;
        dryRun: boolean;
      }>();

      const limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new InputError(`--limit must be a positive integer`);
      }

      const sourceIds = opts.sources
        ? opts.sources.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

      if (sourceIds) {
        const known = new Set(listScraperIds());
        const unknown = sourceIds.filter((id) => !known.has(id));
        if (unknown.length > 0) {
          throw new InputError(
            `unknown source(s): ${unknown.join(", ")}. known: ${listScraperIds().join(", ")}`,
          );
        }
      }

      const scrapers = getActiveScrapers(sourceIds);
      if (scrapers.length === 0) {
        throw new InputError("no scrapers selected");
      }

      const dataDir = resolveDataDir(global.dataDir || undefined);
      const store = new NoticeStore(dataDir);
      await store.load();

      const scrapedAt = new Date().toISOString();
      const result: ScrapeResult = {
        scrapedAt,
        sources: {},
        totalNew: 0,
        totalStored: 0,
      };

      // 모든 스크래퍼 병렬 실행 — Promise.allSettled로 격리.
      const runs = await Promise.allSettled(
        scrapers.map(async (s) => {
          const notices = await s.scrape({ limit });
          return { id: s.config.id, notices };
        }),
      );

      for (let i = 0; i < runs.length; i++) {
        const scraper = scrapers[i]!;
        const run = runs[i]!;
        const srcResult: SourceResult = { fetched: 0, new: 0, error: null };

        if (run.status === "fulfilled") {
          srcResult.fetched = run.value.notices.length;
          if (!opts.dryRun) {
            srcResult.new = store.merge(run.value.notices).length;
          } else {
            // dry-run에서는 중복 체크만 하고 실제 병합 안 함
            srcResult.new = run.value.notices.filter(
              (n) => store.list().every((existing) => existing.id !== n.id),
            ).length;
          }
        } else {
          srcResult.error =
            run.reason instanceof Error
              ? run.reason.message
              : String(run.reason);
        }
        result.sources[scraper.config.id] = srcResult;
      }

      if (!opts.dryRun) await store.save();

      result.totalNew = Object.values(result.sources).reduce(
        (acc, s) => acc + s.new,
        0,
      );
      result.totalStored = store.size();

      const allFailed = Object.values(result.sources).every(
        (s) => s.error !== null,
      );

      printData(result, global.format, "scrape");
      if (allFailed) process.exit(1);
    });
  return cmd;
}
