import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ProfessorDetail, type University } from "../api/client";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

export function ProfessorPage() {
  const { uniId, professorId } = useParams<{ uniId: string; professorId: string }>();
  const [university, setUniversity] = useState<University | null>(null);
  const [professor, setProfessor] = useState<ProfessorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uniId || !professorId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getUniversity(uniId), api.getProfessor(uniId, professorId)])
      .then(([uniData, profData]) => {
        if (!active) return;
        setUniversity(uniData);
        setProfessor(profData);
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
  }, [uniId, professorId]);

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow={university?.name ?? "Professor"}
          title={professor?.professor_name ?? "Professor profile"}
          description="Review sentiment, ratings, and top discussion topics for this instructor."
        >
          {uniId && (
            <Link to={`/universities/${uniId}`} className="breadcrumb">
              ← Back to courses
            </Link>
          )}
        </PageHero>
      }
    >
      {loading && <div className="loading-pulse mb-6 h-48" />}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {professor && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <p className="text-2xl font-bold text-ink-900">{professor.review_count}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Reviews</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-bold text-ink-900">{professor.avg_rating.toFixed(2)}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Avg rating</p>
            </div>
            <div className="stat-card">
              <p className={`text-2xl font-bold ${professor.sentiment_score >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {professor.sentiment_score >= 0 ? "+" : ""}
                {professor.sentiment_score.toFixed(3)}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Sentiment score</p>
            </div>
            <div className="stat-card">
              <p className="text-sm font-bold text-ink-900">
                +{professor.positive} / {professor.neutral} / −{professor.negative}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Pos / neu / neg</p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <SectionCard title="Top topics" subtitle="Most-mentioned themes in this professor's reviews">
              <div className="flex flex-wrap gap-2">
                {professor.top_topics.map((topic) => (
                  <span
                    key={topic.topic}
                    className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-200/70"
                  >
                    {topic.topic} ({topic.count})
                  </span>
                ))}
                {professor.top_topics.length === 0 && (
                  <p className="text-sm text-ink-500">No topic tags yet.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Courses taught" subtitle="Courses with reviews for this professor">
              <ul className="space-y-3">
                {professor.courses.map((course) => (
                  <li key={course.course_code} className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3">
                    <div>
                      <p className="font-semibold text-ink-900">{course.course_code}</p>
                      <p className="text-sm text-ink-500">{course.course_name}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink-600">{course.review_count} reviews</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </>
      )}
    </PageShell>
  );
}
