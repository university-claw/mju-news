import { describe, it, expect } from "vitest";
import {
  parsePositiveInt,
  validateDate,
  validateIsoTimestamp,
} from "../../src/commands/common.js";
import { InputError } from "../../src/errors.js";

describe("validateIsoTimestamp", () => {
  it("returns the normalized ISO string", () => {
    expect(validateIsoTimestamp("2026-04-01T00:00:00Z", "--since")).toBe(
      "2026-04-01T00:00:00.000Z",
    );
  });
  it("throws InputError on garbage", () => {
    expect(() => validateIsoTimestamp("not-a-date", "--since")).toThrow(
      InputError,
    );
  });
});

describe("validateDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(validateDate("2026-04-17", "--start")).toBe("2026-04-17");
  });
  it("rejects non-iso shapes", () => {
    expect(() => validateDate("2026/04/17", "--start")).toThrow(InputError);
    expect(() => validateDate("26-04-17", "--start")).toThrow(InputError);
  });
});

describe("parsePositiveInt", () => {
  it("parses positive integers", () => {
    expect(parsePositiveInt("10", "--limit")).toBe(10);
  });
  it("rejects zero / negative / non-int", () => {
    expect(() => parsePositiveInt("0", "--limit")).toThrow(InputError);
    expect(() => parsePositiveInt("-1", "--limit")).toThrow(InputError);
    expect(() => parsePositiveInt("1.5", "--limit")).toThrow(InputError);
    expect(() => parsePositiveInt("abc", "--limit")).toThrow(InputError);
  });
});
