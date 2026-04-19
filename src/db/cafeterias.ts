import type { Pool } from "pg";
import type { CafeteriaId, CafeteriaMenuEntry, MealType } from "../types.js";

export interface ListCafeteriaOpts {
  serviceDate?: string;
  startDate?: string;
  endDate?: string;
  meal?: MealType;
  where?: CafeteriaId;
}

function rowToEntry(row: Record<string, unknown>): CafeteriaMenuEntry {
  // pg type parser(1082)를 오버라이드해 DATE를 문자열로 받는다. client.ts 참고.
  return {
    sourceId: row.source_id as CafeteriaId,
    sourceName: row.source_name as string,
    serviceDate: row.service_date as string,
    mealType: row.meal_type as MealType,
    isClosed: Boolean(row.is_closed),
    menuText: row.menu_text as string,
    menuItems: row.menu_items,
    confidence:
      row.normalization_confidence != null
        ? Number(row.normalization_confidence)
        : null,
  };
}

/**
 * 식단 read model(cafeteria_menu_entries) 조회.
 * 오늘 학식 / 주간 학식 모두 이 함수 하나로.
 */
export async function listCafeteriaMenuEntries(
  pool: Pool,
  opts: ListCafeteriaOpts,
): Promise<CafeteriaMenuEntry[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.serviceDate) {
    params.push(opts.serviceDate);
    where.push(`e.service_date = $${params.length}`);
  }
  if (opts.startDate) {
    params.push(opts.startDate);
    where.push(`e.service_date >= $${params.length}`);
  }
  if (opts.endDate) {
    params.push(opts.endDate);
    where.push(`e.service_date <= $${params.length}`);
  }
  if (opts.meal) {
    params.push(opts.meal);
    where.push(`e.meal_type = $${params.length}`);
  }
  if (opts.where) {
    params.push(opts.where);
    where.push(`e.source_id = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT
      e.source_id,
      s.name AS source_name,
      e.service_date,
      e.meal_type,
      e.is_closed,
      e.menu_text,
      e.menu_items,
      e.normalization_confidence
    FROM cafeteria_menu_entries e
    JOIN cafeteria_instagram_sources s ON s.id = e.source_id
    ${whereClause}
    ORDER BY e.service_date ASC, e.source_id, e.meal_type
  `;
  const res = await pool.query(sql, params);
  return res.rows.map(rowToEntry);
}
