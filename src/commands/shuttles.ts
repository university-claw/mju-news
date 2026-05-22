import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import {
  getLatestShuttleTimetable,
  listNextShuttleDepartures,
} from "../db/shuttles.js";
import { InputError } from "../errors.js";
import { printData } from "../output/print.js";
import { parsePositiveInt, readGlobalOptions, validateDate } from "./common.js";

function validateTime(input: string, optionName: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input);
  if (!match) {
    throw new InputError(`${optionName} must be HH:mm (got "${input}")`);
  }
  return input;
}

function buildLatest(): Command {
  return new Command("latest")
    .description("active 셔틀 시간표 버전과 전체 출발 행")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const pool = getPool();

      try {
        const result = await getLatestShuttleTimetable(pool);
        printData(result, g.format, "shuttles");
      } finally {
        await closePool();
      }
    });
}

function buildNext(): Command {
  return new Command("next")
    .description("지정 날짜/시각 이후 가장 가까운 셔틀 출발 후보")
    .requiredOption("--date <yyyy-mm-dd>", "조회 날짜")
    .requiredOption("--after <hh:mm>", "이 시각 이후 출발편")
    .option("--limit <n>", "최대 후보 수 (기본 3, 최대 10)", "3")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        date: string;
        after: string;
        limit: string;
      }>();
      const serviceDate = validateDate(opts.date, "--date");
      const after = validateTime(opts.after, "--after");
      const limit = Math.min(parsePositiveInt(opts.limit, "--limit"), 10);
      const pool = getPool();

      try {
        const result = await listNextShuttleDepartures(pool, {
          serviceDate,
          after,
          limit,
        });
        printData(result, g.format, "shuttles");
      } finally {
        await closePool();
      }
    });
}

export function buildShuttlesCommand(): Command {
  const cmd = new Command("shuttles").description(
    "셔틀 시간표 조회 (shuttle read model 사용)",
  );
  cmd.addCommand(buildLatest());
  cmd.addCommand(buildNext());
  return cmd;
}
