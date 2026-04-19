import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import {
  getNoticeDetail,
  listRecentNotices,
  searchNotices,
} from "../db/notices.js";
import { InputError } from "../errors.js";
import { printData } from "../output/print.js";
import type { ListResult, NoticeCategory, NoticeSummary } from "../types.js";
import {
  parsePositiveInt,
  readGlobalOptions,
  validateIsoTimestamp,
} from "./common.js";

const ALLOWED_CATEGORIES: readonly NoticeCategory[] = [
  "general",
  "scholarship",
  "event",
  "career",
];

function coerceCategory(raw: string | undefined): NoticeCategory | undefined {
  if (!raw) return undefined;
  if ((ALLOWED_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as NoticeCategory;
  }
  throw new InputError(
    `--category must be one of ${ALLOWED_CATEGORIES.join("|")} (got "${raw}")`,
  );
}

function buildRecent(): Command {
  return new Command("recent")
    .description("최신 공지 목록")
    .option("--limit <n>", "최대 건수 (기본 20, 최대 100)", "20")
    .option(
      "--category <cat>",
      "general | scholarship | event | career (생략 시 전체)",
    )
    .option("--since <iso>", "ISO 8601 이후 published_at만")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        limit: string;
        category?: string;
        since?: string;
      }>();
      const limit = Math.min(parsePositiveInt(opts.limit, "--limit"), 100);
      const category = coerceCategory(opts.category);
      const since = opts.since
        ? validateIsoTimestamp(opts.since, "--since")
        : undefined;

      const pool = getPool();
      try {
        const items = await listRecentNotices(pool, { limit, category, since });
        const result: ListResult<NoticeSummary> = {
          total: items.length,
          items,
        };
        printData(result, g.format, "notices");
      } finally {
        await closePool();
      }
    });
}

function buildSearch(): Command {
  return new Command("search")
    .description("공지 제목/본문/카테고리에 키워드 부분일치")
    .requiredOption("--q <keyword>", "검색어 (필수)")
    .option("--limit <n>", "최대 건수 (기본 20, 최대 100)", "20")
    .option(
      "--category <cat>",
      "general | scholarship | event | career",
    )
    .option("--since <iso>", "ISO 8601 이후 published_at만")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        q: string;
        limit: string;
        category?: string;
        since?: string;
      }>();
      if (opts.q.trim().length === 0) {
        throw new InputError("--q cannot be empty");
      }
      const limit = Math.min(parsePositiveInt(opts.limit, "--limit"), 100);
      const category = coerceCategory(opts.category);
      const since = opts.since
        ? validateIsoTimestamp(opts.since, "--since")
        : undefined;

      const pool = getPool();
      try {
        const items = await searchNotices(pool, {
          q: opts.q.trim(),
          limit,
          category,
          since,
        });
        const result: ListResult<NoticeSummary> = {
          total: items.length,
          items,
        };
        printData(result, g.format, "notices");
      } finally {
        await closePool();
      }
    });
}

function buildGet(): Command {
  return new Command("get")
    .description("공지 상세 (본문 + 첨부 추출 텍스트 + 이미지 OCR)")
    .argument("<id>", "<source>:<external_id> 형식 (예: general:12345)")
    .action(async (id: string, _optsIgnored: unknown, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const colon = id.indexOf(":");
      if (colon <= 0 || colon === id.length - 1) {
        throw new InputError(
          `notice id must be "<source>:<external_id>" (got "${id}")`,
        );
      }
      const source = coerceCategory(id.slice(0, colon));
      if (!source) {
        throw new InputError(`missing source in id "${id}"`);
      }
      const externalId = id.slice(colon + 1);

      const pool = getPool();
      try {
        const detail = await getNoticeDetail(pool, source, externalId);
        printData(detail, g.format, "notice-detail");
      } finally {
        await closePool();
      }
    });
}

export function buildNoticesCommand(): Command {
  const cmd = new Command("notices").description("공지 조회 (worker가 쓴 DB를 읽는다)");
  cmd.addCommand(buildRecent());
  cmd.addCommand(buildSearch());
  cmd.addCommand(buildGet());
  return cmd;
}
