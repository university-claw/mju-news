import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import { listCafeteriaMenuEntries } from "../db/cafeterias.js";
import { InputError } from "../errors.js";
import { printData } from "../output/print.js";
import type {
  CafeteriaId,
  CafeteriaMenuEntry,
  ListResult,
  MealType,
} from "../types.js";
import { readGlobalOptions, validateDate } from "./common.js";

const CAFETERIAS: readonly CafeteriaId[] = [
  "student-hall",
  "myeongjin",
  "bokji",
  "bangmok",
];
const MEALS: readonly MealType[] = ["breakfast", "lunch", "dinner"];

function coerceWhere(raw: string | undefined): CafeteriaId | undefined {
  if (!raw) return undefined;
  if ((CAFETERIAS as readonly string[]).includes(raw)) {
    return raw as CafeteriaId;
  }
  throw new InputError(
    `--where must be one of ${CAFETERIAS.join("|")} (got "${raw}")`,
  );
}

function coerceMeal(raw: string | undefined): MealType | undefined {
  if (!raw) return undefined;
  if ((MEALS as readonly string[]).includes(raw)) {
    return raw as MealType;
  }
  throw new InputError(
    `--meal must be one of ${MEALS.join("|")} (got "${raw}")`,
  );
}

function todayKST(): string {
  // KST 자정 기준 오늘 날짜 YYYY-MM-DD.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildToday(): Command {
  return new Command("today")
    .description("오늘(KST) 학식")
    .option(
      "--meal <type>",
      "breakfast | lunch | dinner (생략 시 전체)",
    )
    .option(
      "--where <id>",
      "student-hall | myeongjin | bokji | bangmok (생략 시 전체)",
    )
    .option(
      "--date <yyyy-mm-dd>",
      "오늘 대신 특정 날짜를 보고 싶을 때 (KST 기준)",
    )
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        meal?: string;
        where?: string;
        date?: string;
      }>();
      const serviceDate = opts.date
        ? validateDate(opts.date, "--date")
        : todayKST();
      const meal = coerceMeal(opts.meal);
      const where = coerceWhere(opts.where);

      const pool = getPool();
      try {
        const items = await listCafeteriaMenuEntries(pool, {
          serviceDate,
          meal,
          where,
        });
        const result: ListResult<CafeteriaMenuEntry> = {
          total: items.length,
          items,
        };
        printData(result, g.format, "cafeterias");
      } finally {
        await closePool();
      }
    });
}

function buildWeek(): Command {
  return new Command("week")
    .description("주간 학식 (시작일 포함 7일)")
    .requiredOption("--start <yyyy-mm-dd>", "주간 시작 날짜 (필수)")
    .option(
      "--where <id>",
      "student-hall | myeongjin | bokji | bangmok",
    )
    .option("--meal <type>", "breakfast | lunch | dinner")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        start: string;
        where?: string;
        meal?: string;
      }>();
      const startDate = validateDate(opts.start, "--start");
      const endDate = shiftDate(startDate, 6);
      const where = coerceWhere(opts.where);
      const meal = coerceMeal(opts.meal);

      const pool = getPool();
      try {
        const items = await listCafeteriaMenuEntries(pool, {
          startDate,
          endDate,
          meal,
          where,
        });
        const result: ListResult<CafeteriaMenuEntry> = {
          total: items.length,
          items,
        };
        printData(result, g.format, "cafeterias");
      } finally {
        await closePool();
      }
    });
}

export function buildCafeteriasCommand(): Command {
  const cmd = new Command("cafeterias").description(
    "학식 조회 (cafeteria_menu_entries read model 사용)",
  );
  cmd.addCommand(buildToday());
  cmd.addCommand(buildWeek());
  return cmd;
}
