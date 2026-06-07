import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type CourseAnalytics,
  type Offering,
  type Review,
  type SemesterTrendPoint,
  type SummaryProvider,
  type SummaryProviderInfo,
  type TopTopicItem,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RequireAuth } from "../components/RequireAuth";
import { ReviewCard } from "../components/ReviewCard";
import { SentimentChart } from "../components/SentimentChart";
import { TopicList } from "../components/TopicList";
import { KpiCards } from "../components/charts/KpiCards";
import { SemesterTrendSection } from "../components/charts/SemesterTrendSection";
import { TopicBarChart } from "../components/charts/TopicBarChart";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

function sentimentScore(positive: number, neutral: number, negative: number): number {
  const total = positive + neutral + negative;
  if (total === 0) return 0;
  return Math.round(((positive - negative) / total) * 1000) / 1000;
}

function summaryProviderLabel(
  provider: string,
  model: string | null | undefined,
  unavailableNote?: string,
): string {
  const modelSuffix = model ? ` — ${model}` : "";
  const note = unavailableNote ?? "";
  return `${provider}${modelSuffix}${note}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { uniId, courseId } = useParams<{ uniId: string; courseId: string }>();
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [trends, setTrends] = useState<SemesterTrendPoint[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [semester, setSemester] = useState("");
  const [professor, setProfessor] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [search, setSearch] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySource, setSummarySource] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryProvider, setSummaryProvider] = useState<SummaryProvider>("ollama");
  const [summaryProviders, setSummaryProviders] = useState<
    Record<SummaryProvider, SummaryProviderInfo> | null
  >(null);

  const professors = useMemo(
    () => Array.from(new Set(offerings.map((o) => o.professor_name))).sort(),
    [offerings],
  );

  const filteredReviews = useMemo(() => {
    if (!search.trim()) return reviews;
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => r.review_text.toLowerCase().includes(q));
  }, [reviews, search]);

  const displayTopics: TopTopicItem[] = useMemo(() => {
    if (analytics?.topic_breakdown?.length) return analytics.topic_breakdown;
    const counts: Record<string, number> = {};
    for (const review of reviews) {
      for (const topic of review.topics) {
        counts[topic] = (counts[topic] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [analytics, reviews]);

  const kpiSentiment = useMemo(() => {
    if (!analytics) return 0;
    return sentimentScore(analytics.positive, analytics.neutral, analytics.negative);
  }, [analytics]);

  const loadSummary = async (provider: SummaryProvider, reviewCount: number) => {
    if (!uniId || !courseId || reviewCount === 0) return;
    setSummaryLoading(true);
    setSummarySource(null);
    setSummaryError(null);
    try {
      const result = await api.refreshSummary(uniId, courseId, provider);
      setAnalytics((prev) => (prev ? { ...prev, summary: result.summary } : prev));
      setSummarySource(result.source);
      setSummaryError(result.fallback_error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadDashboard = async () => {
    if (!uniId || !courseId) return;
    const [analyticsData, reviewData, offeringData, trendData] = await Promise.all([
      api.getAnalytics(uniId, courseId),
      api.getReviews(uniId, courseId, {
        semester,
        professor,
        sentiment,
      }),
      api.getOfferings(uniId, courseId),
      api.getSemesterTrends(uniId, courseId),
    ]);
    setAnalytics(analyticsData);
    setReviews(reviewData);
    setOfferings(offeringData);
    setTrends(trendData);
    if (!offeringId && offeringData.length > 0) {
      setOfferingId(offeringData[0].offering_id);
    }
    return analyticsData.review_count;
  };

  useEffect(() => {
    api.getHealth().then((health) => setSummaryProviders(health.summary_providers)).catch(() => {});
  }, []);

  useEffect(() => {
    setSummarySource(null);
    setSummaryError(null);
  }, [uniId, courseId]);

  useEffect(() => {
    loadDashboard().catch((err: Error) => setError(err.message));
  }, [uniId, courseId, semester, professor, sentiment]);

  useEffect(() => {
    setSummarySource(null);
    setSummaryError(null);
  }, [summaryProvider]);

  const handleGenerateSummary = () => {
    if (!analytics || analytics.review_count === 0) return;
    loadSummary(summaryProvider, analytics.review_count);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !offeringId || !reviewText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createReview({
        offering_id: offeringId,
        rating,
        review_text: reviewText.trim(),
      });
      setReviewText("");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (!analytics) {
    return (
      <PageShell>
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="loading-pulse h-32" />
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="loading-pulse h-24" />
              ))}
            </div>
            <div className="loading-pulse h-64" />
          </div>
        )}
      </PageShell>
    );
  }

  const topTopic = displayTopics[0]?.topic ?? analytics.topics[0] ?? "—";

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="Course dashboard"
          title={`${analytics.course_code}: ${analytics.course_name}`}
          description="Sentiment breakdown, topic trends, AI summary, and searchable student reviews."
        >
          <Link to={`/universities/${uniId}`} className="breadcrumb">
            ← Back to courses
          </Link>
        </PageHero>
      }
    >
      <SectionCard title="Key metrics" className="mb-8">
        <KpiCards
          totalReviews={analytics.review_count}
          avgRating={analytics.avg_rating}
          sentimentScore={kpiSentiment}
          topTopic={topTopic}
        />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Sentiment distribution" subtitle="Share of positive, neutral, and negative reviews">
          <SentimentChart
            positive={analytics.positive}
            neutral={analytics.neutral}
            negative={analytics.negative}
          />
        </SectionCard>

        <SectionCard title="Topic distribution" subtitle="Most frequently mentioned themes in reviews">
          <TopicBarChart topics={displayTopics} />
        </SectionCard>
      </div>

      <SectionCard
        title="AI summary"
        subtitle={
          summaryLoading
            ? `Generating summary via ${summaryProvider === "default" ? "default template" : summaryProvider}…`
            : summarySource === "ollama"
              ? "Llama summary (local Ollama)"
              : summarySource === "openai"
                ? `GPT summary (${summaryProviders?.openai?.model ?? "OpenAI"})`
                : summarySource === "groq"
                  ? "Llama summary (Groq cloud API)"
                  : summarySource === "mock" && summaryProvider !== "default"
                    ? summaryError
                      ? `${summaryProvider} failed — ${summaryError}`
                      : `${summaryProvider} unavailable — showing default template`
                    : summarySource === "mock"
                      ? "Fast template summary (default)"
                      : "Stored course summary — choose a model and click Generate"
        }
        className="mt-8"
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
            <label htmlFor="summary-provider" className="text-sm font-medium text-ink-400">
              Summary model
            </label>
            <select
              id="summary-provider"
              value={summaryProvider}
              onChange={(e) => setSummaryProvider(e.target.value as SummaryProvider)}
              className="select-field"
              disabled={summaryLoading}
            >
              <option value="ollama" disabled={summaryProviders?.ollama?.available === false}>
                {summaryProviderLabel(
                  "Ollama (local)",
                  summaryProviders?.ollama?.model,
                  summaryProviders?.ollama?.available === false ? " (not running)" : undefined,
                )}
              </option>
              <option value="openai" disabled={summaryProviders?.openai?.available === false}>
                {summaryProviderLabel(
                  "OpenAI",
                  summaryProviders?.openai?.model,
                  summaryProviders?.openai?.available === false ? " (needs API key)" : undefined,
                )}
              </option>
              <option value="groq" disabled={summaryProviders?.groq?.available === false}>
                {summaryProviderLabel(
                  "Groq",
                  summaryProviders?.groq?.model,
                  summaryProviders?.groq?.available === false ? " (needs API key)" : undefined,
                )}
              </option>
              <option value="default">Default — fast template</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={summaryLoading || analytics.review_count === 0}
            className="btn-primary shrink-0"
          >
            {summaryLoading ? "Generating…" : "Generate summary"}
          </button>
        </div>
        {summaryLoading ? (
          <div className="space-y-2">
            <div className="loading-pulse h-4 w-full" />
            <div className="loading-pulse h-4 w-5/6" />
            <div className="loading-pulse h-4 w-4/6" />
          </div>
        ) : (
          (() => {
            const points = analytics.summary
              .split("\n")
              .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
              .filter(Boolean);
            const isList = points.length > 1;
            return (
              <div className="summary-callout border-l-4 border-l-brand-500">
                {isList ? (
                  <ul className="space-y-2">
                    {points.map((point, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1 text-brand-400">▸</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  analytics.summary
                )}
              </div>
            );
          })()
        )}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Top topic tags</h3>
          <TopicList topics={analytics.topics} />
        </div>
      </SectionCard>

      <SectionCard
        title="Semester-over-semester comparison"
        subtitle="How sentiment and ratings change across terms"
        className="mt-8"
      >
        <SemesterTrendSection trends={trends} courseCode={analytics.course_code} />
      </SectionCard>

      <SectionCard
        title="Review explorer"
        subtitle="Filter and search individual student reviews"
        className="mt-8"
      >
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input
            type="search"
            placeholder="Search review text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field md:col-span-2"
          />
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="select-field"
          >
            <option value="">All semesters</option>
            <option value="Fall">Fall</option>
            <option value="Spring">Spring</option>
          </select>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            className="select-field"
          >
            <option value="">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div className="mb-6">
          <select
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            className="select-field"
          >
            <option value="">All professors</option>
            {professors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <ReviewCard key={review.review_id} review={review} />
          ))}
          {filteredReviews.length === 0 && (
            <p className="text-center text-sm text-ink-500">No reviews match these filters.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Submit a review"
        subtitle="Sign in to share your experience with this course"
        className="mt-8"
      >
        <RequireAuth>
          <form onSubmit={handleSubmit} className="space-y-4">
            <select
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              className="select-field"
              required
            >
              {offerings.map((offering) => (
                <option key={offering.offering_id} value={offering.offering_id}>
                  {offering.professor_name} — {offering.semester} {offering.year}
                </option>
              ))}
            </select>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink-400">Your rating</label>
              <div className="flex items-center gap-2">
                <div className="flex" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        className="p-0.5 text-3xl leading-none transition-transform hover:scale-110 focus:outline-none"
                      >
                        <span className={active ? "text-amber-400" : "text-ink-600"}>★</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm font-semibold text-ink-300">{hoverRating || rating}/5</span>
              </div>
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this course…"
              className="input-field min-h-28 resize-y"
              required
            />
            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Analyzing with AI…" : "Submit review"}
            </button>
          </form>
        </RequireAuth>
      </SectionCard>
    </PageShell>
  );
}
