import { describe, expect, it, vi } from "vitest";
import {
  getLatestShuttleTimetable,
  listNextShuttleDepartures,
} from "../../src/db/shuttles.js";

describe("shuttle db reader", () => {
  it("returns an empty latest result when there is no active timetable", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
    } as unknown as Parameters<typeof getLatestShuttleTimetable>[0];

    await expect(getLatestShuttleTimetable(pool)).resolves.toEqual({
      version: null,
      total: 0,
      items: [],
    });
  });

  it("lists the nearest departures after the requested time", async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 3,
              source_id: "general",
              source_external_id: "100",
              source_title: "2026학년도 1학기 셔틀버스 운행 안내",
              source_url: "https://example.com",
              source_published_at: new Date("2026-03-01T00:00:00.000Z"),
              academic_year: 2026,
              term_label: "1학기",
              is_active: true,
              normalization_status: "succeeded",
              normalization_error_message: null,
              departure_count: 2,
              normalized_at: new Date("2026-05-01T00:00:00.000Z"),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 9,
              timetable_version_id: 3,
              campus: "자연",
              route_name: "명지대역 노선",
              direction: "명지대역 -> 자연캠퍼스",
              stop_name: "명지대역",
              day_type: "weekday",
              departure_time: "18:10:00",
              note: null,
              sort_order: 0,
            },
          ],
        }),
    } as unknown as Parameters<typeof listNextShuttleDepartures>[0];

    const result = await listNextShuttleDepartures(pool, {
      serviceDate: "2026-05-22",
      after: "18:00",
      limit: 3,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.departureTime).toBe("18:10");
    expect(vi.mocked(pool.query).mock.calls[1]?.[1]).toEqual([
      3,
      ["daily", "weekday"],
      "18:00",
      3,
    ]);
  });
});
