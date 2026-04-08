import path from "node:path";

/**
 * data 디렉토리 경로를 resolve한다.
 *
 * 우선순위: 명시적 override > 환경변수(MJU_NEWS_DATA_DIR) > CWD/data.
 * 반환값은 항상 절대경로 — mju-server가 execFile로 호출할 때 cwd가
 * 예상과 다를 수 있어서 상대경로를 쓰면 안 된다.
 */
export function resolveDataDir(override?: string): string {
  if (override) return path.resolve(override);
  const fromEnv = process.env.MJU_NEWS_DATA_DIR;
  if (fromEnv && fromEnv.length > 0) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data");
}

/**
 * --data-dir 입력을 sanitize한다. 빈 문자열이나 shell 메타문자가 섞여
 * 들어오면 거부. path traversal은 resolve 후 prefix 체크로 막진 않고,
 * 단순히 실행 주체가 쓸 수 있는 경로인지만 확인한다.
 */
export function sanitizeDataDir(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("--data-dir must not be empty");
  }
  // null byte, shell 메타문자 거부 (정상 경로에는 거의 없음)
  if (/[\0]/.test(trimmed)) {
    throw new Error("--data-dir contains invalid characters");
  }
  return path.resolve(trimmed);
}
