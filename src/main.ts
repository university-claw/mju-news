#!/usr/bin/env node
/**
 * mju-news CLI 엔트리포인트.
 *
 * 핵심 책임:
 *  1) 루트 Command 실행
 *  2) 미처리 예외 → JSON ErrorEnvelope 로 stdout 출력 (mju-server가 파싱)
 *  3) exit code는 예외 종류와 무관하게 1
 *
 * stderr는 --verbose일 때만 사용. 기본 stdout은 JSON 한 개여야 한다.
 */
import { buildRootCommand } from "./commands/root.js";
import type { ErrorEnvelope } from "./types.js";

async function main(): Promise<void> {
  const root = buildRootCommand();
  // commander는 내부적으로 process.exit을 쓸 수 있으므로 parseAsync를 catch.
  await root.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  // --format이 무엇이든 에러는 JSON envelope로 stdout에 찍는다.
  // 이유: mju-server가 stdout만 파싱한다. --format json이 기본이므로
  // table 포맷에서도 에러는 JSON으로 통일하는 게 파이프라인에 일관적이다.
  const envelope: ErrorEnvelope = {
    error: {
      type: err instanceof Error ? err.name : "Error",
      message: err instanceof Error ? err.message : String(err),
      exitCode: 1,
    },
  };
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  if (process.env.MJU_NEWS_DEBUG) {
    process.stderr.write(
      `${err instanceof Error && err.stack ? err.stack : String(err)}\n`,
    );
  }
  process.exit(1);
});
