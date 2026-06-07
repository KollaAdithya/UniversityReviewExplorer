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
};
