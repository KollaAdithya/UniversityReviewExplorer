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
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-slate-500">{error || "Loading dashboard..."}</p>
      </div>
    );
  }

  const topTopic = displayTopics[0]?.topic ?? analytics.topics[0] ?? "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/universities/${uniId}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to courses
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {analytics.course_code}: {analytics.course_name}
        </h1>
        <p className="mt-2 text-slate-600">Analytics dashboard and review explorer</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Key metrics</h2>
        <KpiCards
          totalReviews={analytics.review_count}
          avgRating={analytics.avg_rating}
          sentimentScore={kpiSentiment}
          topTopic={topTopic}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Sentiment distribution</h2>
          <SentimentChart
            positive={analytics.positive}
            neutral={analytics.neutral}
            negative={analytics.negative}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Topic distribution</h2>
          <TopicBarChart topics={displayTopics} />
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">AI summary</h2>
        <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4 text-slate-800 leading-relaxed">
          {analytics.summary}
        </div>
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Top topic tags</h3>
          <TopicList topics={analytics.topics} />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Semester-over-semester comparison</h2>
        <SemesterTrendSection trends={trends} courseCode={analytics.course_code} />
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Review explorer</h2>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input
            type="search"
            placeholder="Search review text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
          />
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">All semesters</option>
            <option value="Fall">Fall</option>
            <option value="Spring">Spring</option>
          </select>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
            <p className="text-slate-500">No reviews match these filters.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Submit a review</h2>
        <RequireAuth>
          <form onSubmit={handleSubmit} className="space-y-4">
            <select
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            >
              {offerings.map((offering) => (
                <option key={offering.offering_id} value={offering.offering_id}>
                  {offering.professor_name} — {offering.semester} {offering.year}
                </option>
              ))}
            </select>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Rating: {rating}/5</label>
              <input
                type="range"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this course..."
              className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            {error && <p className="text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </RequireAuth>
      </section>
    </div>
  );
}
