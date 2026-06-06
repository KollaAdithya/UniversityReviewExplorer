import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SemesterTrendPoint } from "../../api/client";

interface Props {
  trends: SemesterTrendPoint[];
  courseCode: string;
}

function deltaStyle(delta: number) {
  if (delta > 0.02) return { border: "border-green-500", color: "#27AE60", icon: "📈" };
  if (delta < -0.02) return { border: "border-red-500", color: "#E74C3C", icon: "📉" };
  return { border: "border-amber-400", color: "#F39C12", icon: "➡️" };
}

export function SemesterTrendSection({ trends, courseCode }: Props) {
  if (trends.length === 0) {
    return <p className="text-sm text-slate-500">No semester data available.</p>;
  }

  const latest = trends[trends.length - 1];
  const previous = trends.length >= 2 ? trends[trends.length - 2] : null;
  const delta = previous ? latest.sentiment_score - previous.sentiment_score : 0;
  const style = deltaStyle(delta);

  return (
    <div className="space-y-6">
      {previous && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className={`rounded-xl border-2 bg-white p-4 text-center shadow-sm ${style.border}`}
          >
            <p className="text-2xl font-bold" style={{ color: style.color }}>
              {style.icon} {delta >= 0 ? "+" : ""}
              {delta.toFixed(3)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{courseCode}</p>
            <p className="text-xs text-slate-500">
              {previous.semester_label} → {latest.semester_label}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-800">{latest.review_count}</p>
            <p className="text-xs font-semibold uppercase text-slate-500">Latest reviews</p>
            <p className="text-xs text-slate-400">{latest.semester_label}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-800">{latest.avg_rating.toFixed(1)}</p>
            <p className="text-xs font-semibold uppercase text-slate-500">Latest avg rating</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{latest.positive_pct}%</p>
            <p className="text-xs font-semibold uppercase text-slate-500">Latest % positive</p>
          </div>
        </div>
      )}

      {trends.length >= 2 ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semester_label" tick={{ fontSize: 11 }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={0.05} stroke="#27AE60" strokeDasharray="4 4" />
              <ReferenceLine y={-0.05} stroke="#E74C3C" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="#BDC3C7" />
              <Line
                type="monotone"
                dataKey="sentiment_score"
                name="Sentiment"
                stroke="#2980B9"
                strokeWidth={3}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-amber-700">Need reviews from at least two semesters for a trend line.</p>
      )}

      {trends.length >= 2 && (
        <div className="space-y-1 text-sm text-slate-600">
          {(() => {
            const first = trends[0];
            const last = trends[trends.length - 1];
            const totalDelta = last.sentiment_score - first.sentiment_score;
            const word =
              totalDelta > 0.02 ? "improved" : totalDelta < -0.02 ? "declined" : "stayed stable";
            return (
              <p>
                <strong>
                  {courseCode}
                </strong>{" "}
                sentiment {word} from {first.semester_label} ({first.sentiment_score >= 0 ? "+" : ""}
                {first.sentiment_score.toFixed(3)}) to {last.semester_label} (
                {last.sentiment_score >= 0 ? "+" : ""}
                {last.sentiment_score.toFixed(3)}).
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
