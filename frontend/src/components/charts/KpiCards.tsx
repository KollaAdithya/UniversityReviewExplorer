interface Props {
  totalReviews: number;
  avgRating: number;
  sentimentScore: number;
  topTopic: string;
}

export function KpiCards({ totalReviews, avgRating, sentimentScore, topTopic }: Props) {
  const sentColor =
    sentimentScore >= 0.05 ? "#27AE60" : sentimentScore <= -0.05 ? "#E74C3C" : "#F39C12";
  const stars = "⭐".repeat(Math.max(1, Math.round(avgRating)));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-3xl font-extrabold text-slate-800">{totalReviews}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total Reviews
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-3xl font-extrabold text-slate-800">{avgRating.toFixed(2)}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Avg Rating
        </p>
        <p className="mt-1 text-sm text-slate-400">{stars}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-3xl font-extrabold" style={{ color: sentColor }}>
          {sentimentScore >= 0 ? "+" : ""}
          {sentimentScore.toFixed(3)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sentiment Score
        </p>
        <p className="mt-1 text-xs text-slate-400">−1 to +1 scale</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-lg font-extrabold text-indigo-700">{topTopic}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Top Topic
        </p>
      </div>
    </div>
  );
}
