import type { Pool } from "pg";

export interface ReadModelStats {
  noticeItems: number;
  noticeItemsLatestAt: string | null;
  cafeteriaMenuEntries: number;
  cafeteriaMenuEntriesLatestDate: string | null;
}

/** doctor용 read model 스냅샷. */
export async function readModelStats(pool: Pool): Promise<ReadModelStats> {
  const [notices, cafeterias] = await Promise.all([
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
  ]);

  const n = notices.rows[0]!;
  const c = cafeterias.rows[0]!;

  return {
    noticeItems: Number(n.count),
    noticeItemsLatestAt: n.latest_at ? n.latest_at.toISOString() : null,
    cafeteriaMenuEntries: Number(c.count),
    // DATE 파서가 문자열을 반환하도록 client.ts에서 오버라이드했다.
    cafeteriaMenuEntriesLatestDate: c.latest_date ?? null,
  };
}
