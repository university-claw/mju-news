import { afterEach, describe, expect, it, vi } from "vitest";
import { closePool, getPool } from "../../src/db/client.js";

const pgMock = vi.hoisted(() => {
  const end = vi.fn(async () => {
    await Promise.resolve();
  });
  return {
    end,
    pool: vi.fn(() => ({ end })),
    setTypeParser: vi.fn(),
  };
});

vi.mock("pg", () => ({
  default: {
    Pool: pgMock.pool,
    types: {
      setTypeParser: pgMock.setTypeParser,
    },
  },
}));

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

describe("db client", () => {
  afterEach(async () => {
    await closePool();
    pgMock.end.mockClear();
    pgMock.pool.mockClear();
  });

  it("closes the cached pool only once when concurrent readers finish together", async () => {
    process.env.PGDATABASE = "mjuclaw";
    process.env.PGUSER = "mjuclaw_app";
    process.env.PGPASSWORD = "change-me";

    getPool();

    await Promise.all([
      closePool(),
      closePool(),
    ]);

    expect(pgMock.end).toHaveBeenCalledTimes(1);
  });
});
