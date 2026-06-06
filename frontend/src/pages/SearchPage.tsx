import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Course, type CourseComparisonItem, type University } from "../api/client";
import { CourseComparisonChart } from "../components/charts/CourseComparisonChart";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

export function SearchPage() {
  const { uniId } = useParams<{ uniId: string }>();
  const [query, setQuery] = useState("");
  const [university, setUniversity] = useState<University | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [comparison, setComparison] = useState<CourseComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uniId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.getUniversity(uniId),
      api.listCourses(uniId, query || undefined),
      api.getCourseComparison(uniId),
    ])
      .then(([uniData, courseData, comparisonData]) => {
        if (!active) return;
        setUniversity(uniData);
        setCourses(courseData);
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
  }, [uniId, query]);

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
      />

      {loading && <div className="loading-pulse mb-6 h-64" />}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {comparison.length >= 2 && (
        <SectionCard
          title="Course comparison"
          subtitle="Sentiment score vs. percent positive reviews across this university"
          className="mb-10"
        >
          <CourseComparisonChart courses={comparison} />
        </SectionCard>
      )}

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

      {!loading && courses.length === 0 && (
        <p className="text-center text-sm text-ink-500">No courses match your search.</p>
      )}
    </PageShell>
  );
}
