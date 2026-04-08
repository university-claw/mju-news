import { Command } from "commander";
import { NoticeStore } from "../storage/store.js";
import { resolveDataDir } from "../storage/paths.js";
import { listScraperIds } from "../scrapers/index.js";
import { printData } from "../output/print.js";
import { InputError } from "../errors.js";
import type { ListResult } from "../types.js";
import { readGlobalOptions, validateIsoTimestamp } from "./common.js";

/**
 * `mju-news new` — mju-server가 유저 메시지 처리 시 호출하는 핵심 엔드포인트.
 *
 * `list --since`와 거의 같지만 의미적으로 분리:
 *  - `list`는 "저장소 조회" — UI/디버깅용
 *  - `new`는 "마지막 본 시점 이후 증분" — 파이프라인 자동 호출용
 *
 * 동일 코드라도 엔드포인트를 분리해두면 서버의 exec 명령어가
 * 의도를 드러낸다. 또한 추후 `new`에만 추가 정렬/쿨다운/중복 제거 로직을
 * 얹을 수 있다.
 */
export function buildNewCommand(): Command {
  const cmd = new Command("new")
    .description("특정 시각 이후 저장소에 들어온 새 공지만 반환")
    .requiredOption("--since <iso>", "ISO 8601 (scrapedAt > since)")
    .option("--source <id>", "특정 source로 필터링")
    .option("--limit <n>", "최대 개수", "50")
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);
      const opts = thisCmd.opts<{
        since: string;
        source?: string;
        limit: string;
      }>();

      const since = validateIsoTimestamp(opts.since, "--since");

      if (opts.source && !listScraperIds().includes(opts.source)) {
        throw new InputError(
          `unknown source: ${opts.source}. known: ${listScraperIds().join(", ")}`,
        );
      }

      const limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit < 0) {
        throw new InputError(`--limit must be a non-negative integer`);
      }

      const dataDir = resolveDataDir(global.dataDir || undefined);
      const store = new NoticeStore(dataDir);
      await store.load();

      const listOpts: {
        source?: string;
        since: string;
        limit: number;
      } = { since, limit };
      if (opts.source) listOpts.source = opts.source;

      const items = store.list(listOpts);
      const result: ListResult = { total: items.length, items };
      printData(result, global.format, "notices");
    });
  return cmd;
}
