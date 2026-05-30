/**
 * mju-news 전역 타입.
 *
 * v2.0.0 이후 이 파일의 형상은 **Postgres `public_data` 스키마의 투영**이며,
 * mjuclaw agent와의 JSON 계약이기도 하다.
 */

export type NoticeCategory = "general" | "scholarship" | "event" | "career";
export type CafeteriaId = "student-hall" | "myeongjin" | "bokji" | "bangmok";
export type MealType = "breakfast" | "lunch" | "dinner";
export type CourseCatalogMeetingParseStatus =
  | "parsed"
  | "partial"
  | "unparsed";

/** 공지 요약 행 (list/search 결과). */
export interface NoticeSummary {
  /** "<source>:<external_id>" 형식 — 재스크랩해도 동일. agent가 상세 조회 시 사용. */
  id: string;
  source: NoticeCategory;
  sourceName: string;
  externalId: string;
  title: string;
  categoryLabel: string | null;
  url: string;
  author: string | null;
  publishedAt: string;
  firstSeenAt: string;
  hasAttachments: boolean;
  hasImages: boolean;
}

/** 공지 단건 상세 (본문 + 첨부/이미지 추출 텍스트 포함). */
export interface NoticeDetail extends NoticeSummary {
  bodyText: string | null;
  attachments: NoticeAttachment[];
  images: NoticeImage[];
}

export interface NoticeAttachment {
  id: number;
  fileName: string;
  downloadUrl: string;
  contentType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  extraction: {
    status: "pending" | "succeeded" | "failed" | "unsupported";
    extractorType: string | null;
    text: string | null;
    charCount: number | null;
    error: string | null;
  } | null;
}

export interface NoticeImage {
  id: number;
  imageUrl: string;
  altText: string | null;
  storageKey: string | null;
  ocr: {
    status: "pending" | "succeeded" | "failed" | "unsupported";
    text: string | null;
    confidence: number | null;
    language: string | null;
    error: string | null;
  } | null;
}

/** 학식 단건 (날짜×식당×끼니). */
export interface CafeteriaMenuEntry {
  sourceId: CafeteriaId;
  sourceName: string;
  serviceDate: string;
  mealType: MealType;
  isClosed: boolean;
  menuText: string;
  menuItems: unknown;
  confidence: number | null;
}

export interface CourseCatalogMeeting {
  rawTimeRange: string;
  dayOfWeek: number | null;
  dayLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  parseStatus: CourseCatalogMeetingParseStatus;
  warning: string | null;
}

export interface CourseCatalogEntry {
  year: number;
  termCode: string;
  termLabel: string;
  category: string;
  categoryLabel: string;
  courseCode: string | null;
  curriculumNumber: string | null;
  courseTitle: string;
  gradeLevel: string | null;
  section: string | null;
  professor: string | null;
  credit: number | null;
  department: string | null;
  campus: string | null;
  meetings: CourseCatalogMeeting[];
}

export interface CourseCatalogDiagnosticBucket {
  key: string;
  count: number;
}

export interface CourseCatalogDiagnosticStage {
  key: string;
  label: string;
  count: number;
  status: "ok" | "empty" | "error";
  message?: string;
}

export interface CourseCatalogDiagnostics {
  generatedAt: string;
  scope: {
    year: number;
    termCode: string;
    category?: string;
    department?: string;
  };
  source: "database" | "export" | "fallback";
  departmentCandidates: string[];
  stages: CourseCatalogDiagnosticStage[];
  categoryCounts: {
    allTerm: CourseCatalogDiagnosticBucket[];
    departmentMatched: CourseCatalogDiagnosticBucket[];
    readerOutput: CourseCatalogDiagnosticBucket[];
  };
  departmentCounts: {
    allTerm: CourseCatalogDiagnosticBucket[];
    departmentMatched: CourseCatalogDiagnosticBucket[];
    readerOutput: CourseCatalogDiagnosticBucket[];
  };
  hints: string[];
  error?: {
    stage: string;
    message: string;
  };
}

export type GraduationRequirementRuleStatus = "confirmed" | "unprovided";

export interface GraduationRequirementCourseGroup {
  groupKey: string | null;
  label: string;
  requiredCredits: number | null;
  minCourses: number | null;
  requiredCourseCodes: string[];
  requiredCourseTitles: string[];
  groupType: string | null;
  alternativeGroup: string | null;
  appliesTo?: Record<string, unknown>;
  note: string | null;
}

export interface GraduationRequirementRule {
  requirementKey: string;
  label: string;
  category: string;
  requiredCredits: number | null;
  requiredCourseCodes: string[];
  requiredCourseTitles: string[];
  courseGroups: GraduationRequirementCourseGroup[];
  programTrack: string | null;
  minCourses: number | null;
  appliesTo: Record<string, unknown>;
  status: GraduationRequirementRuleStatus;
  note: string | null;
}

export interface GraduationRequirementSource {
  id: number;
  department: string;
  admissionYear: number;
  sourceKind: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  sourceRetrievedAt: string;
  rules: GraduationRequirementRule[];
}

/** 목록 응답 wrapper. */
export interface ListResult<T> {
  total: number;
  items: T[];
  query?: Record<string, unknown>;
}

/** doctor 응답. */
export interface DoctorResult {
  ok: boolean;
  node: { version: string };
  database: {
    host: string;
    port: number;
    database: string;
    schema: string;
    connected: boolean;
    error?: string;
  };
  readModel: {
    noticeItems: number;
    noticeItemsLatestAt: string | null;
    cafeteriaMenuEntries: number;
    cafeteriaMenuEntriesLatestDate: string | null;
  };
  skills: Array<{ name: string; valid: boolean; error?: string }>;
}

export type OutputFormat = "json" | "table";

export interface GlobalOptions {
  format: OutputFormat;
  verbose: boolean;
}

/**
 * CLI 실패 시 stdout으로 나가는 JSON envelope.
 * agent가 stdout만 파싱하므로 에러도 stdout.
 */
export interface ErrorEnvelope {
  error: {
    type: string;
    message: string;
    exitCode: number;
    details?: unknown;
  };
}
