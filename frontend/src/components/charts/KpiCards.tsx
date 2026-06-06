interface Props {
  totalReviews: number;
  avgRating: number;
  sentimentScore: number;
  topTopic: string;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight" style={{ color: accent ?? "#1c2029" }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

export function KpiCards({ totalReviews, avgRating, sentimentScore, topTopic }: Props) {
  const sentColor =
    sentimentScore >= 0.05 ? "#16a34a" : sentimentScore <= -0.05 ? "#dc2626" : "#d97706";
  const stars = "★".repeat(Math.max(1, Math.round(avgRating))) + "☆".repeat(5 - Math.max(1, Math.round(avgRating)));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total reviews" value={String(totalReviews)} />
      <StatCard label="Avg rating" value={avgRating.toFixed(2)} sub={stars} />
      <StatCard
        label="Sentiment score"
        value={`${sentimentScore >= 0 ? "+" : ""}${sentimentScore.toFixed(3)}`}
        sub="−1 to +1 scale"
        accent={sentColor}
      />
      <StatCard label="Top topic" value={topTopic} accent="#3366ff" />
    </div>
  );
}
