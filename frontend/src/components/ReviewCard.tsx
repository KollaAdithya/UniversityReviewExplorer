import type { Review } from "../api/client";

interface Props {
  review: Review;
}

const sentimentColors: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-slate-100 text-slate-700",
  negative: "bg-red-100 text-red-800",
};

export function ReviewCard({ review }: Props) {
  const sentimentClass = review.sentiment
    ? sentimentColors[review.sentiment] || sentimentColors.neutral
    : sentimentColors.neutral;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-medium text-slate-900">{review.professor_name}</span>
        <span>•</span>
        <span>
          {review.semester} {review.year}
        </span>
        <span>•</span>
        <span>Rating: {review.rating}/5</span>
        {review.sentiment && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClass}`}>
            {review.sentiment}
          </span>
        )}
      </div>
      <p className="text-slate-800">{review.review_text}</p>
      {review.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.topics.map((topic) => (
            <span key={topic} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {topic}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
