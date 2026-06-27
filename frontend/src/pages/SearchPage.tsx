import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Course, type CourseComparisonItem, type ProfessorListItem, type University } from "../api/client";
import { CourseComparisonChart } from "../components/charts/CourseComparisonChart";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

export function SearchPage() {
  const { uniId } = useParams<{ uniId: string }>();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [professorQuery, setProfessorQuery] = useState("");
  const [debouncedProfessorQuery, setDebouncedProfessorQuery] = useState("");
  const [university, setUniversity] = useState<University | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [showProfessorSection, setShowProfessorSection] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [professorsLoading, setProfessorsLoading] = useState(false);
  const [comparison, setComparison] = useState<CourseComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [professorError, setProfessorError] = useState<string | null>(null);
  const coursesRequestId = useRef(0);
  const professorsRequestId = useRef(0);

  useEffect(() => {
    setQuery("");
    setDebouncedQuery("");
    setProfessorQuery("");
    setDebouncedProfessorQuery("");
    setShowProfessorSection(false);
    setProfessors([]);
    setCourses([]);
  }, [uniId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProfessorQuery(professorQuery), 300);
    return () => window.clearTimeout(timer);
  }, [professorQuery]);

  useEffect(() => {
    if (!uniId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getUniversity(uniId), api.getCourseComparison(uniId)])
      .then(([uniData, comparisonData]) => {
        if (!active) return;
        setUniversity(uniData);
        setComparison(comparisonData);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uniId]);

  useEffect(() => {
    if (!uniId) return;
    const requestId = ++coursesRequestId.current;
    let active = true;
    setCoursesLoading(true);
    setCourseError(null);
    api
      .listCourses(uniId, debouncedQuery || undefined)
      .then((courseData) => {
        if (!active || requestId !== coursesRequestId.current) return;
        setCourses(courseData);
      })
      .catch((err: Error) => {
        if (active && requestId === coursesRequestId.current) setCourseError(err.message);
      })
      .finally(() => {
        if (active && requestId === coursesRequestId.current) setCoursesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uniId, debouncedQuery]);

  useEffect(() => {
    if (!uniId) return;
    const requestId = ++professorsRequestId.current;
    let active = true;
    setProfessorsLoading(true);
    setProfessorError(null);
    api
      .listProfessors(uniId, debouncedProfessorQuery || undefined)
      .then((professorData) => {
        if (!active || requestId !== professorsRequestId.current) return;
        setProfessors(professorData.slice(0, 12));
        if (!debouncedProfessorQuery && professorData.length > 0) {
          setShowProfessorSection(true);
        }
      })
      .catch((err: Error) => {
        if (active && requestId === professorsRequestId.current) setProfessorError(err.message);
      })
      .finally(() => {
        if (active && requestId === professorsRequestId.current) setProfessorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uniId, debouncedProfessorQuery]);

  const filteredComparison = useMemo(() => {
    if (!debouncedQuery.trim()) return comparison;
    const courseIds = new Set(courses.map((course) => course.course_id));
    return comparison.filter((item) => courseIds.has(item.course_id));
  }, [comparison, courses, debouncedQuery]);

  const comparisonSubtitle = debouncedQuery.trim()
    ? `Filtered to courses matching “${debouncedQuery.trim()}”`
    : "Sentiment score vs. percent positive reviews across this university";

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="University"
          title={university?.name ?? "Courses"}
          description="Search courses and open a dashboard with sentiment charts, topic trends, and review explorer."
        >
          <Link to="/" className="breadcrumb">
            ← All universities
          </Link>
        </PageHero>
      }
    >
      <input
        type="search"
        placeholder="Search by course code, name, or department…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input-field mb-8"
        aria-busy={coursesLoading || query !== debouncedQuery}
      />

      {loading && <div className="loading-pulse mb-6 h-24" />}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {filteredComparison.length >= 2 && (
        <SectionCard title="Course comparison" subtitle={comparisonSubtitle} className="mb-10">
          <CourseComparisonChart courses={filteredComparison} />
        </SectionCard>
      )}

      {debouncedQuery.trim() && !coursesLoading && query === debouncedQuery && filteredComparison.length === 1 && (
        <SectionCard
          title="Course snapshot"
          subtitle={`Single match for “${debouncedQuery.trim()}” — open the course for full charts`}
          className="mb-10"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="stat-card">
              <p className="text-2xl font-bold text-ink-900">{filteredComparison[0].review_count}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Reviews</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-ink-900">{filteredComparison[0].avg_rating.toFixed(1)}★</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Avg rating</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-emerald-600">{filteredComparison[0].positive_pct}%</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Positive</p>
            </div>
          </div>
        </SectionCard>
      )}

      {debouncedQuery.trim() &&
        !coursesLoading &&
        query === debouncedQuery &&
        courses.length > 0 &&
        filteredComparison.length === 0 && (
          <SectionCard title="Course comparison" subtitle={comparisonSubtitle} className="mb-10">
            <p className="text-sm text-ink-500">No comparison metrics yet for the matching courses.</p>
          </SectionCard>
        )}

      {(showProfessorSection || professorQuery) && (
        <SectionCard
          title="Professor analytics"
          subtitle="Sentiment and top topics by instructor"
          className="mb-10"
        >
          <input
            type="search"
            placeholder="Search professors…"
            value={professorQuery}
            onChange={(e) => setProfessorQuery(e.target.value)}
            className="input-field mb-4"
          />
          {professorError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {professorError}
            </div>
          )}
          {professorsLoading && <div className="loading-pulse mb-4 h-24" />}
          {!professorsLoading && professors.length === 0 && (
            <p className="text-sm text-ink-500">No professors match your search.</p>
          )}
          {!professorsLoading && professors.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {professors.map((professor) => (
                <Link
                  key={professor.professor_id}
                  to={`/universities/${uniId}/professors/${professor.professor_id}`}
                  className="rounded-xl border border-ink-100 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{professor.professor_name}</p>
                      <p className="mt-1 text-sm text-ink-500">
                        {professor.review_count} reviews · {professor.avg_rating.toFixed(1)}★ · sentiment{" "}
                        {professor.sentiment_score >= 0 ? "+" : ""}
                        {professor.sentiment_score.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-brand-600">View →</span>
                  </div>
                  {professor.top_topics[0] && (
                    <p className="mt-2 text-xs text-ink-500">Top topic: {professor.top_topics[0].topic}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Courses" subtitle="Open a course dashboard" className="mb-4">
        {courseError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {courseError}
          </div>
        )}
        {(coursesLoading || query !== debouncedQuery) && (
          <div className="loading-pulse mb-4 h-32" />
        )}
        {!coursesLoading && query === debouncedQuery && courses.length === 0 && (
          <p className="text-sm text-ink-500">No courses match your search.</p>
        )}
        {!coursesLoading && query === debouncedQuery && courses.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.course_id}
                to={`/universities/${uniId}/courses/${course.course_id}`}
                className="course-card group"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{course.course_code}</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink-950 group-hover:text-brand-700">
                  {course.course_name}
                </h2>
                <p className="mt-3 text-sm font-medium text-brand-600">View dashboard →</p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
