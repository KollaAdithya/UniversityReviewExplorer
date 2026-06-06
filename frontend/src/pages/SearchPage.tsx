import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Course, type CourseComparisonItem, type University } from "../api/client";
import { CourseComparisonChart } from "../components/charts/CourseComparisonChart";

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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        ← All universities
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{university?.name ?? "Courses"}</h1>
        <p className="mt-2 text-slate-600">
          Search courses and explore sentiment, topics, and AI-generated summaries.
        </p>
      </header>

      <input
        type="search"
        placeholder="Search by course code, name, or department..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none"
      />

      {loading && <p className="text-slate-500">Loading courses...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {comparison.length >= 2 && (
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Course comparison</h2>
          <p className="mb-4 text-sm text-slate-600">
            Sentiment score vs. percent positive reviews across courses at this university.
          </p>
          <CourseComparisonChart courses={comparison} />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.course_id}
            to={`/universities/${uniId}/courses/${course.course_id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold text-indigo-700">{course.course_code}</h2>
            <p className="mt-1 text-slate-800">{course.course_name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
