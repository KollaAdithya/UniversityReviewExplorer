import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type CourseAnalytics,
  type Offering,
  type Review,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RequireAuth } from "../components/RequireAuth";
import { ReviewCard } from "../components/ReviewCard";
import { SentimentChart } from "../components/SentimentChart";
import { TopicList } from "../components/TopicList";

export function DashboardPage() {
  const { user } = useAuth();
  const { uniId, courseId } = useParams<{ uniId: string; courseId: string }>();
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [semester, setSemester] = useState("");
  const [professor, setProfessor] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const professors = useMemo(
    () => Array.from(new Set(offerings.map((o) => o.professor_name))).sort(),
    [offerings],
  );

  const loadDashboard = async () => {
    if (!uniId || !courseId) return;
    const [analyticsData, reviewData, offeringData] = await Promise.all([
      api.getAnalytics(uniId, courseId),
      api.getReviews(uniId, courseId, {
        semester,
        professor,
        sentiment,
      }),
      api.getOfferings(uniId, courseId),
    ]);
    setAnalytics(analyticsData);
    setReviews(reviewData);
    setOfferings(offeringData);
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Sentiment Breakdown</h2>
          <SentimentChart
            positive={analytics.positive}
            neutral={analytics.neutral}
            negative={analytics.negative}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Top Topics</h2>
          <TopicList topics={analytics.topics} />
          <h2 className="mb-3 mt-8 text-lg font-semibold">AI Summary</h2>
          <p className="leading-relaxed text-slate-700">{analytics.summary}</p>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Review Explorer</h2>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
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
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">All professors</option>
            {professors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
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

        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.review_id} review={review} />
          ))}
          {reviews.length === 0 && <p className="text-slate-500">No reviews match these filters.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Submit a Review</h2>
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
