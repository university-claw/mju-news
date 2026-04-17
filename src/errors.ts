/**
 * 커스텀 에러 계층.
 *
 * main.ts의 에러 envelope가 `err.name`을 type 필드로 내보낸다 —
 * 각 클래스는 name을 명시적으로 세팅해야 한다.
 */

export class MjuNewsError extends Error {
  override readonly name: string = "MjuNewsError";
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** DB 연결/쿼리 실패. */
export class DbError extends MjuNewsError {
  override readonly name = "DbError";
}

/** 설정/환경변수 누락. */
export class ConfigError extends MjuNewsError {
  override readonly name = "ConfigError";
}

/** 잘못된 CLI 입력. */
export class InputError extends MjuNewsError {
  override readonly name = "InputError";
}

/** 요청한 리소스가 DB에 존재하지 않음. */
export class NotFoundError extends MjuNewsError {
  override readonly name = "NotFoundError";
}

/** SKILL.md frontmatter 검증 실패. */
export class SkillError extends MjuNewsError {
  override readonly name = "SkillError";
}
