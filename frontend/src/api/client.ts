const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
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
  summary: string;
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

export const api = {
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
