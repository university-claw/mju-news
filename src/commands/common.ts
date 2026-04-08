import { Command, Option } from "commander";
import type { GlobalOptions, OutputFormat } from "../types.js";
import { sanitizeDataDir } from "../storage/paths.js";
import { InputError } from "../errors.js";

/**
 * 모든 서브커맨드가 공유하는 글로벌 옵션 등록.
 *
 * commander는 `inherited options`를 자동으로 자식에 내려주지 않기 때문에
 * 루트 Command에 `--data-dir`, `--format`, `-v`를 달고, 자식에서
 * `readGlobalOptions`로 병합 조회한다.
 */
export function attachGlobalOptions(cmd: Command): Command {
  return cmd
    .option(
      "--data-dir <path>",
      "notices.json 저장 위치 (기본: $MJU_NEWS_DATA_DIR 또는 ./data)",
    )
    .addOption(
      new Option("--format <fmt>", "출력 형식")
        .choices(["json", "table"])
        .default("json"),
    )
    .option("-v, --verbose", "디버그 로그를 stderr로 출력", false);
}

/**
 * 서브커맨드 action에서 글로벌 옵션을 꺼내는 헬퍼.
 * commander v14에서는 `cmd.optsWithGlobals()`가 모든 조상의 옵션을 머지한다.
 */
export function readGlobalOptions(cmd: Command): GlobalOptions {
  const opts = cmd.optsWithGlobals() as {
    dataDir?: string;
    format?: OutputFormat;
    verbose?: boolean;
  };
  const format = opts.format ?? "json";
  if (format !== "json" && format !== "table") {
    throw new InputError(`invalid --format: ${format}`);
  }
  return {
    dataDir: opts.dataDir ? sanitizeDataDir(opts.dataDir) : "",
    format,
    verbose: Boolean(opts.verbose),
  };
}

/** ISO 8601 timestamp 검증. 실패 시 InputError. */
export function validateIsoTimestamp(input: string, optionName: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new InputError(
      `${optionName} must be ISO 8601 (got "${input}")`,
    );
  }
  return d.toISOString();
}
