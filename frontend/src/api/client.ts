const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  authTokenGetter = getter;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

export interface University {
  university_id: string;
  name: string;
  slug: string;
  country: string;
  course_count: number;
  review_count: number;
}

export interface Course {
  course_id: string;
  course_code: string;
  course_name: string;
}

export interface CourseAnalytics {
  course_id: string;
  course_code: string;
  course_name: string;
  positive: number;
  neutral: number;
  negative: number;
  topics: string[];
  topic_breakdown: TopTopicItem[];
  summary: string;
  review_count: number;
  avg_rating: number;
}

export type SummaryProvider = "default" | "openai" | "groq" | "gemini" | "ollama";

export interface SummaryProviderInfo {
  label: string;
  description: string;
  available: boolean;
  model: string | null;
}

export interface CourseSummaryRefresh {
  course_id: string;
  summary: string;
  source: "ollama" | "groq" | "gemini" | "mock" | "vertex" | string;
  requested_provider: SummaryProvider;
  model: string | null;
  fallback_error: string | null;
}

export interface HealthResponse {
  status: string;
  ml_provider: string;
  summary_providers: Record<SummaryProvider, SummaryProviderInfo>;
}

export interface SemesterTrendPoint {
  semester_label: string;
  semester: string;
  year: number;
  review_count: number;
  avg_rating: number;
  positive_pct: number;
  sentiment_score: number;
}

export interface CourseComparisonItem {
  course_id: string;
  course_code: string;
  course_name: string;
  review_count: number;
  avg_rating: number;
  positive_pct: number;
  sentiment_score: number;
}

export interface Review {
  review_id: string;
  offering_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  sentiment: string | null;
  professor_name: string | null;
  semester: string | null;
  year: number | null;
  topics: string[];
}

export interface Offering {
  offering_id: string;
  course_id: string;
  professor_id: string;
  professor_name: string;
  semester: string;
  year: number;
}

export interface TopTopicItem {
  topic: string;
  count: number;
}

export interface UniversityTopicAnalytics {
  university_id: string;
  university_name: string;
  topics: TopTopicItem[];
}

export interface AuthMe {
  authenticated: boolean;
  user_id?: string;
  email?: string;
  display_name?: string;
}

export interface ProfessorListItem {
  professor_id: string;
  professor_name: string;
  review_count: number;
  avg_rating: number;
  sentiment_score: number;
  top_topics: TopTopicItem[];
}

export interface ProfessorCourseItem {
  course_code: string;
  course_name: string;
  review_count: number;
}

export interface ProfessorDetail {
  professor_id: string;
  professor_name: string;
  email: string;
  review_count: number;
  avg_rating: number;
  positive: number;
  neutral: number;
  negative: number;
  sentiment_score: number;
  top_topics: TopTopicItem[];
  courses: ProfessorCourseItem[];
}

export interface DatasetInfo {
  id: string;
  name: string;
  source_url: string;
  license: string;
  coverage: string;
  local_path: string;
  download_command: string;
  import_command: string;
  file_exists: boolean;
  file_size_bytes: number;
  file_modified_at: string | null;
}

export interface DataCatalog {
  datasets: DatasetInfo[];
  database: { university_count: number; course_count: number; review_count: number };
  last_import: ImportRun | null;
}

export interface ImportRun {
  run_id: string;
  source_file: string;
  status: string;
  rows_imported: number;
  rows_skipped: number;
  universities_created: number;
  error_message: string | null;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface UniversitySentimentRow {
  university_name: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positive_pct: number;
  sentiment_score: number;
}

export interface BigQueryDashboard {
  enabled: boolean;
  table_id: string;
  source: string;
  row_count: number;
  bq_error: string | null;
  sentiment_by_university: UniversitySentimentRow[];
  global_top_topics: TopTopicItem[];
  sync_trigger: string;
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),
  getMe: () => request<AuthMe>("/api/v1/auth/me"),
  listUniversities: (q?: string) =>
    request<University[]>(`/api/v1/universities${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getUniversity: (universityId: string) =>
    request<University>(`/api/v1/universities/${universityId}`),
  listCourses: (universityId: string, q?: string) =>
    request<Course[]>(
      `/api/v1/universities/${universityId}/courses${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  getAnalytics: (universityId: string, courseId: string) =>
    request<CourseAnalytics>(`/api/v1/universities/${universityId}/courses/${courseId}/analytics`),
  refreshSummary: (universityId: string, courseId: string, provider: SummaryProvider = "default") =>
    request<CourseSummaryRefresh>(
      `/api/v1/universities/${universityId}/courses/${courseId}/summary/refresh?provider=${provider}`,
      { method: "POST" },
    ),
  getSemesterTrends: (universityId: string, courseId: string) =>
    request<SemesterTrendPoint[]>(
      `/api/v1/universities/${universityId}/courses/${courseId}/trends`,
    ),
  getCourseComparison: (universityId: string) =>
    request<CourseComparisonItem[]>(
      `/api/v1/universities/${universityId}/analytics/course-comparison`,
    ),
  getReviews: (universityId: string, courseId: string, params?: Record<string, string>) => {
    const query = params
      ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
      : "";
    return request<Review[]>(
      `/api/v1/universities/${universityId}/courses/${courseId}/reviews${query}`,
    );
  },
  getOfferings: (universityId: string, courseId: string) =>
    request<Offering[]>(`/api/v1/universities/${universityId}/courses/${courseId}/offerings`),
  getUniversityTopTopics: (universityId: string, limit = 5) =>
    request<UniversityTopicAnalytics>(
      `/api/v1/universities/${universityId}/analytics/top-topics?limit=${limit}`,
    ),
  getTopTopicsByUniversity: (limit = 5) =>
    request<UniversityTopicAnalytics[]>(`/api/v1/analytics/top-topics?limit=${limit}`),
  createReview: (payload: { offering_id: string; rating: number; review_text: string }) =>
    request<Review>("/api/v1/reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDataCatalog: () => request<DataCatalog>("/api/v1/data/catalog"),
  getBigQueryDashboard: () => request<BigQueryDashboard>("/api/v1/data/bigquery-dashboard"),
  listImportRuns: () => request<ImportRun[]>("/api/v1/data/import-runs"),
  recordImportRun: (sourceFile = "data/rmp_public.csv") =>
    request<ImportRun>("/api/v1/data/import-runs/record", {
      method: "POST",
      body: JSON.stringify({ source_file: sourceFile }),
    }),
  triggerImport: () =>
    request<ImportRun>("/api/v1/data/import-runs/trigger", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  listProfessors: (universityId: string, q?: string) =>
    request<ProfessorListItem[]>(
      `/api/v1/universities/${universityId}/professors${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  getProfessor: (universityId: string, professorId: string) =>
    request<ProfessorDetail>(`/api/v1/universities/${universityId}/professors/${professorId}`),
};
