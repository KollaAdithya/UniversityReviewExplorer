import type { Review } from "../api/client";
import { Badge } from "./ui/Badge";

interface Props {
  review: Review;
}

function sentimentVariant(sentiment: string | null): "positive" | "neutral" | "negative" {
  if (sentiment === "positive") return "positive";
  if (sentiment === "negative") return "negative";
  return "neutral";
}

export function ReviewCard({ review }: Props) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  return (
    <article className="review-card">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink-900">{review.professor_name}</span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-500">
          {review.semester} {review.year}
        </span>
        <span className="text-ink-300">·</span>
        <span className="text-amber-500" title={`${review.rating}/5`}>
          {stars}
        </span>
        {review.sentiment && <Badge label={review.sentiment} variant={sentimentVariant(review.sentiment)} />}
      </div>
      <p className="text-[0.95rem] leading-relaxed text-ink-800">{review.review_text}</p>
      {review.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {review.topics.map((topic) => (
            <Badge key={topic} label={topic} variant="topic" />
          ))}
        </div>
      )}
    </article>
  );
}
