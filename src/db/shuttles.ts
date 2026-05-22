import type { Pool } from "pg";
import type {
  ShuttleDayType,
  ShuttleDeparture,
  ShuttleLatestResult,
  ShuttleNextResult,
  ShuttleTimetableVersion,
} from "../types.js";

export interface NextShuttleOptions {
  serviceDate: string;
  after: string;
  limit: number;
}

function formatTimestamp(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function formatTime(value: unknown): string {
  return String(value).slice(0, 5);
}

function rowToVersion(row: Record<string, unknown>): ShuttleTimetableVersion {
  return {
    id: Number(row.id),
    sourceId: row.source_id as string,
    sourceExternalId: row.source_external_id as string,
    sourceTitle: row.source_title as string,
    sourceUrl: row.source_url as string,
    sourcePublishedAt: formatTimestamp(row.source_published_at),
    academicYear: row.academic_year == null ? null : Number(row.academic_year),
    termLabel: row.term_label == null ? null : String(row.term_label),
    isActive: Boolean(row.is_active),
    normalizationStatus: row.normalization_status as "succeeded" | "failed",
    normalizationErrorMessage:
      row.normalization_error_message == null
        ? null
        : String(row.normalization_error_message),
    departureCount: Number(row.departure_count),
    normalizedAt: formatTimestamp(row.normalized_at),
  };
}

function rowToDeparture(row: Record<string, unknown>): ShuttleDeparture {
  return {
    id: Number(row.id),
    timetableVersionId: Number(row.timetable_version_id),
    campus: row.campus == null ? null : String(row.campus),
    routeName: row.route_name as string,
    direction: row.direction == null ? null : String(row.direction),
    stopName: row.stop_name as string,
    dayType: row.day_type as ShuttleDayType,
    departureTime: formatTime(row.departure_time),
    note: row.note == null ? null : String(row.note),
    sortOrder: Number(row.sort_order),
  };
}

function dayTypesForServiceDate(serviceDate: string): ShuttleDayType[] {
  const day = new Date(`${serviceDate}T00:00:00Z`).getUTCDay();
  if (day === 0) {
    return ["daily", "sunday", "holiday"];
  }
  if (day === 6) {
    return ["daily", "saturday"];
  }
  return ["daily", "weekday"];
}

export async function getActiveShuttleTimetableVersion(
  pool: Pool,
): Promise<ShuttleTimetableVersion | null> {
  const result = await pool.query(
    `
      SELECT
        id,
        source_id,
        source_external_id,
        source_title,
        source_url,
        source_published_at,
        academic_year,
        term_label,
        is_active,
        normalization_status,
        normalization_error_message,
        departure_count,
        normalized_at
      FROM shuttle_timetable_versions
      WHERE is_active = true
      ORDER BY normalized_at DESC NULLS LAST, id DESC
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  return row ? rowToVersion(row) : null;
}

export async function listShuttleDeparturesForVersion(
  pool: Pool,
  timetableVersionId: number,
): Promise<ShuttleDeparture[]> {
  const result = await pool.query(
    `
      SELECT
        id,
        timetable_version_id,
        campus,
        route_name,
        direction,
        stop_name,
        day_type,
        departure_time,
        note,
        sort_order
      FROM shuttle_departures
      WHERE timetable_version_id = $1
      ORDER BY day_type, departure_time, sort_order, id
    `,
    [timetableVersionId],
  );

  return result.rows.map(rowToDeparture);
}

export async function getLatestShuttleTimetable(
  pool: Pool,
): Promise<ShuttleLatestResult> {
  const version = await getActiveShuttleTimetableVersion(pool);
  if (!version) {
    return {
      version: null,
      total: 0,
      items: [],
    };
  }

  const items = await listShuttleDeparturesForVersion(pool, version.id);
  return {
    version,
    total: items.length,
    items,
  };
}

export async function listNextShuttleDepartures(
  pool: Pool,
  opts: NextShuttleOptions,
): Promise<ShuttleNextResult> {
  const version = await getActiveShuttleTimetableVersion(pool);
  if (!version) {
    return {
      serviceDate: opts.serviceDate,
      after: opts.after,
      limit: opts.limit,
      version: null,
      total: 0,
      items: [],
    };
  }

  const result = await pool.query(
    `
      SELECT
        id,
        timetable_version_id,
        campus,
        route_name,
        direction,
        stop_name,
        day_type,
        departure_time,
        note,
        sort_order
      FROM shuttle_departures
      WHERE timetable_version_id = $1
        AND day_type = ANY($2::text[])
        AND departure_time > $3::time
      ORDER BY departure_time ASC, sort_order ASC, id ASC
      LIMIT $4
    `,
    [
      version.id,
      dayTypesForServiceDate(opts.serviceDate),
      opts.after,
      opts.limit,
    ],
  );
  const items = result.rows.map(rowToDeparture);

  return {
    serviceDate: opts.serviceDate,
    after: opts.after,
    limit: opts.limit,
    version,
    total: items.length,
    items,
  };
}
