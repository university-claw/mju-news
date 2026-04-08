/**
 * 커스텀 에러 계층.
 *
 * 각 에러는 `name`을 명시적으로 세팅해서 main.ts의 에러 envelope가
 * `err.name`을 type 필드로 그대로 내보낼 수 있게 한다.
 */

export class MjuNewsError extends Error {
  override readonly name: string = "MjuNewsError";
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** 스크래퍼 레벨 실패 (네트워크/파싱/구조 변경). */
export class ScraperError extends MjuNewsError {
  override readonly name = "ScraperError";
  constructor(
    public readonly sourceId: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${sourceId}] ${message}`, options);
  }
}

/** 저장소 파일 손상/권한 문제. */
export class StoreError extends MjuNewsError {
  override readonly name = "StoreError";
}

/** 잘못된 CLI 입력 (--since 포맷, 존재하지 않는 source 등). */
export class InputError extends MjuNewsError {
  override readonly name = "InputError";
}

/** SKILL.md frontmatter 검증 실패. */
export class SkillError extends MjuNewsError {
  override readonly name = "SkillError";
}
