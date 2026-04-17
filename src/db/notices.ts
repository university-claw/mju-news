import type { Pool } from "pg";
import type {
  NoticeCategory,
  NoticeDetail,
  NoticeSummary,
} from "../types.js";
import { NotFoundError } from "../errors.js";

export interface ListNoticesOpts {
  limit: number;
  category?: NoticeCategory;
  since?: string;
}

export interface SearchNoticesOpts {
  q: string;
  limit: number;
  since?: string;
  category?: NoticeCategory;
}

function rowToSummary(row: Record<string, unknown>): NoticeSummary {
  const source = row.source_id as NoticeCategory;
  const externalId = row.external_id as string;
  return {
    id: `${source}:${externalId}`,
    source,
    sourceName: row.source_name as string,
    externalId,
    title: row.title as string,
    categoryLabel: (row.category_label as string | null) ?? null,
    url: row.detail_url as string,
    author: (row.author as string | null) ?? null,
    publishedAt: (row.published_at as Date).toISOString(),
    firstSeenAt: (row.first_seen_at as Date).toISOString(),
    hasAttachments: Number(row.attachments_count) > 0,
    hasImages: Number(row.images_count) > 0,
  };
}

const NOTICE_LIST_SELECT = `
  SELECT
    n.source_id,
    n.external_id,
    n.title,
    n.category_label,
    n.detail_url,
    n.author,
    n.published_at,
    n.first_seen_at,
    n.attachments_count,
    n.images_count,
    s.name AS source_name
  FROM notice_items n
  JOIN notice_sources s ON s.id = n.source_id
`;

export async function listRecentNotices(
  pool: Pool,
  opts: ListNoticesOpts,
): Promise<NoticeSummary[]> {
  const params: unknown[] = [];
  const where: string[] = ["n.status = 'active'"];
  if (opts.category) {
    params.push(opts.category);
    where.push(`n.source_id = $${params.length}`);
  }
  if (opts.since) {
    params.push(opts.since);
    where.push(`n.published_at >= $${params.length}`);
  }
  params.push(opts.limit);
  const sql = `
    ${NOTICE_LIST_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY n.published_at DESC, n.id DESC
    LIMIT $${params.length}
  `;
  const res = await pool.query(sql, params);
  return res.rows.map(rowToSummary);
}

export async function searchNotices(
  pool: Pool,
  opts: SearchNoticesOpts,
): Promise<NoticeSummary[]> {
  const params: unknown[] = [];
  const where: string[] = ["n.status = 'active'"];
  // 제목 + body_text + category_label 대상으로 case-insensitive 부분 일치.
  params.push(`%${opts.q}%`);
  const qIdx = params.length;
  where.push(
    `(n.title ILIKE $${qIdx} OR COALESCE(n.body_text, '') ILIKE $${qIdx} OR COALESCE(n.category_label, '') ILIKE $${qIdx})`,
  );
  if (opts.category) {
    params.push(opts.category);
    where.push(`n.source_id = $${params.length}`);
  }
  if (opts.since) {
    params.push(opts.since);
    where.push(`n.published_at >= $${params.length}`);
  }
  params.push(opts.limit);
  const sql = `
    ${NOTICE_LIST_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY n.published_at DESC, n.id DESC
    LIMIT $${params.length}
  `;
  const res = await pool.query(sql, params);
  return res.rows.map(rowToSummary);
}

/**
 * 단건 상세 조회. `<source>:<external_id>` 형식의 복합 키.
 * 본문 텍스트 + 첨부(추출 텍스트 포함) + 본문 이미지(OCR 포함).
 */
export async function getNoticeDetail(
  pool: Pool,
  source: NoticeCategory,
  externalId: string,
): Promise<NoticeDetail> {
  const noticeRes = await pool.query(
    `
    SELECT
      n.id,
      n.source_id,
      n.external_id,
      n.title,
      n.category_label,
      n.detail_url,
      n.author,
      n.published_at,
      n.first_seen_at,
      n.attachments_count,
      n.images_count,
      n.body_text,
      s.name AS source_name
    FROM notice_items n
    JOIN notice_sources s ON s.id = n.source_id
    WHERE n.source_id = $1 AND n.external_id = $2
    LIMIT 1
  `,
    [source, externalId],
  );

  if (noticeRes.rowCount === 0) {
    throw new NotFoundError(
      `notice not found: ${source}:${externalId}`,
    );
  }

  const row = noticeRes.rows[0]!;
  const noticeItemId = row.id as number;
  const summary = rowToSummary(row);

  const [attRes, imgRes] = await Promise.all([
    pool.query(
      `
      SELECT
        a.id,
        a.file_name,
        a.download_url,
        a.content_type,
        a.size_bytes,
        a.storage_key,
        e.extraction_status,
        e.extractor_type,
        e.extracted_text,
        e.extracted_char_count,
        e.error_message AS extraction_error
      FROM notice_attachments a
      LEFT JOIN notice_attachment_extractions e ON e.attachment_id = a.id
      WHERE a.notice_item_id = $1
      ORDER BY a.sort_order, a.id
    `,
      [noticeItemId],
    ),
    pool.query(
      `
      SELECT
        i.id,
        i.image_url,
        i.alt_text,
        i.storage_key,
        o.ocr_status,
        o.ocr_text,
        o.ocr_confidence,
        o.ocr_language,
        o.error_message AS ocr_error
      FROM notice_images i
      LEFT JOIN notice_image_ocr_results o ON o.image_id = i.id
      WHERE i.notice_item_id = $1
      ORDER BY i.sort_order, i.id
    `,
      [noticeItemId],
    ),
  ]);

  return {
    ...summary,
    bodyText: (row.body_text as string | null) ?? null,
    attachments: attRes.rows.map((r) => ({
      id: Number(r.id),
      fileName: r.file_name as string,
      downloadUrl: r.download_url as string,
      contentType: (r.content_type as string | null) ?? null,
      sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
      storageKey: (r.storage_key as string | null) ?? null,
      extraction: r.extraction_status
        ? {
            status: r.extraction_status as
              | "pending"
              | "succeeded"
              | "failed"
              | "unsupported",
            extractorType: (r.extractor_type as string | null) ?? null,
            text: (r.extracted_text as string | null) ?? null,
            charCount:
              r.extracted_char_count != null
                ? Number(r.extracted_char_count)
                : null,
            error: (r.extraction_error as string | null) ?? null,
          }
        : null,
    })),
    images: imgRes.rows.map((r) => ({
      id: Number(r.id),
      imageUrl: r.image_url as string,
      altText: (r.alt_text as string | null) ?? null,
      storageKey: (r.storage_key as string | null) ?? null,
      ocr: r.ocr_status
        ? {
            status: r.ocr_status as
              | "pending"
              | "succeeded"
              | "failed"
              | "unsupported",
            text: (r.ocr_text as string | null) ?? null,
            confidence:
              r.ocr_confidence != null ? Number(r.ocr_confidence) : null,
            language: (r.ocr_language as string | null) ?? null,
            error: (r.ocr_error as string | null) ?? null,
          }
        : null,
    })),
  };
}
