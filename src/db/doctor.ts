import type { Pool } from "pg";

export interface ReadModelStats {
  noticeItems: number;
  noticeItemsLatestAt: string | null;
  cafeteriaMenuEntries: number;
  cafeteriaMenuEntriesLatestDate: string | null;
  shuttleDepartures: number;
  shuttleActiveVersion: {
    id: number;
    title: string;
    normalizedAt: string | null;
    departureCount: number;
  } | null;
}

/** doctor용 read model 스냅샷. */
export async function readModelStats(pool: Pool): Promise<ReadModelStats> {
  const [notices, cafeterias, shuttles, activeShuttle] = await Promise.all([
    pool.query<{
      count: string;
      latest_at: Date | null;
    }>(`
      SELECT COUNT(*)::text AS count, MAX(published_at) AS latest_at
      FROM notice_items
    `),
    pool.query<{
      count: string;
      latest_date: string | null;
    }>(`
      SELECT COUNT(*)::text AS count, MAX(service_date) AS latest_date
      FROM cafeteria_menu_entries
    `),
    pool.query<{
      count: string;
    }>(`
      SELECT COUNT(*)::text AS count
      FROM shuttle_departures
    `),
    pool.query<{
      id: number;
      source_title: string;
      normalized_at: Date | null;
      departure_count: number;
    }>(`
      SELECT id, source_title, normalized_at, departure_count
      FROM shuttle_timetable_versions
      WHERE is_active = true
      ORDER BY normalized_at DESC NULLS LAST, id DESC
      LIMIT 1
    `),
  ]);

  const n = notices.rows[0]!;
  const c = cafeterias.rows[0]!;
  const s = shuttles.rows[0]!;
  const active = activeShuttle.rows[0];

  return {
    noticeItems: Number(n.count),
    noticeItemsLatestAt: n.latest_at ? n.latest_at.toISOString() : null,
    cafeteriaMenuEntries: Number(c.count),
    // DATE 파서가 문자열을 반환하도록 client.ts에서 오버라이드했다.
    cafeteriaMenuEntriesLatestDate: c.latest_date ?? null,
    shuttleDepartures: Number(s.count),
    shuttleActiveVersion: active
      ? {
        id: Number(active.id),
        title: active.source_title,
        normalizedAt:
          active.normalized_at instanceof Date
            ? active.normalized_at.toISOString()
            : active.normalized_at
              ? String(active.normalized_at)
              : null,
        departureCount: Number(active.departure_count),
      }
      : null,
  };
}
