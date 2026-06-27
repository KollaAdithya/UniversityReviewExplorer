import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type University } from "../api/client";
import { PageHero, PageShell } from "../components/ui/PageShell";

export function UniversitySearchPage() {
  const [query, setQuery] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .listUniversities(query || undefined)
      .then((uniData) => {
        if (!active) return;
        setUniversities(uniData);
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
  }, [query]);

  const totalReviews = universities.reduce((sum, u) => sum + u.review_count, 0);

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="ISEM 564 · Cloud & ML"
          title="Explore course reviews across universities"
          description="Search real student reviews, compare sentiment and topics, and drill into AI-generated course summaries."
        >
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-800">
              {universities.length} universities
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-200/60">
              {totalReviews.toLocaleString()} reviews
            </span>
            <span className="rounded-full bg-ink-100 px-3 py-1 font-semibold text-ink-700">
              Public RMP dataset
            </span>
            <Link
              to="/analytics/top-topics"
              className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-800 ring-1 ring-violet-200/60 hover:bg-violet-100"
            >
              Cross-university insights →
            </Link>
          </div>
        </PageHero>
      }
    >
      <input
        type="search"
        placeholder="Search universities by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input-field mb-8"
      />

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="loading-pulse h-28" />
          ))}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {universities.map((university) => (
          <Link key={university.university_id} to={`/universities/${university.university_id}`} className="uni-card group">
            <h2 className="font-display text-lg font-semibold text-brand-800 group-hover:text-brand-600">
              {university.name}
            </h2>
            <div className="mt-4 flex gap-4 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Courses</p>
                <p className="mt-0.5 text-lg font-bold text-ink-900">{university.course_count}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Reviews</p>
                <p className="mt-0.5 text-lg font-bold text-ink-900">{university.review_count}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
              Explore courses →
            </p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
