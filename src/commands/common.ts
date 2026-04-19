import { Command, Option } from "commander";
import type { GlobalOptions, OutputFormat } from "../types.js";
import { InputError } from "../errors.js";

/**
 * 모든 서브커맨드가 공유하는 글로벌 옵션.
 *
 * v2.0.0 이후 `--data-dir`은 제거됨 (파일 저장소가 사라짐).
 * DB 연결은 환경변수(`PGHOST`/`PGUSER`/...)로만 구성.
 */
export function attachGlobalOptions(cmd: Command): Command {
  return cmd
    .addOption(
      new Option("--format <fmt>", "출력 형식")
        .choices(["json", "table"])
        .default("json"),
    )
    .option("-v, --verbose", "디버그 로그를 stderr로 출력", false);
}

export function readGlobalOptions(cmd: Command): GlobalOptions {
  const opts = cmd.optsWithGlobals() as {
    format?: OutputFormat;
    verbose?: boolean;
  };
  const format = opts.format ?? "json";
  if (format !== "json" && format !== "table") {
    throw new InputError(`invalid --format: ${format}`);
  }
  return {
    format,
    verbose: Boolean(opts.verbose),
  };
}

/** ISO 8601 timestamp 검증. */
export function validateIsoTimestamp(input: string, optionName: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new InputError(`${optionName} must be ISO 8601 (got "${input}")`);
  }
  return d.toISOString();
}

/** YYYY-MM-DD 날짜 검증. */
export function validateDate(input: string, optionName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new InputError(
      `${optionName} must be YYYY-MM-DD (got "${input}")`,
    );
  }
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new InputError(`${optionName} is not a real date ("${input}")`);
  }
  return input;
}

/** 양수 정수 검증. */
export function parsePositiveInt(input: string, optionName: string): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InputError(`${optionName} must be a positive integer (got "${input}")`);
  }
  return n;
}
