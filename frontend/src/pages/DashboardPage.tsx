import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type CourseAnalytics,
  type Offering,
  type Review,
  type SemesterTrendPoint,
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
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  };

  useEffect(() => {
    loadDashboard().catch((err: Error) => setError(err.message));
  }, [uniId, courseId, semester, professor, sentiment]);

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
        subtitle="Auto-generated overview from review corpus"
        className="mt-8"
      >
        <div className="summary-callout border-l-4 border-l-brand-500">{analytics.summary}</div>
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
              <label className="mb-2 block text-sm font-medium text-ink-600">
                Rating: <span className="font-bold text-brand-700">{rating}/5</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
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
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </RequireAuth>
      </SectionCard>
    </PageShell>
  );
}
