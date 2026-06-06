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

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #eceef2",
  boxShadow: "0 8px 24px rgba(28,32,41,0.08)",
};

function deltaStyle(delta: number) {
  if (delta > 0.02) return { ring: "ring-emerald-200", text: "text-emerald-600", label: "Improving" };
  if (delta < -0.02) return { ring: "ring-rose-200", text: "text-rose-600", label: "Declining" };
  return { ring: "ring-amber-200", text: "text-amber-600", label: "Stable" };
}

export function SemesterTrendSection({ trends, courseCode }: Props) {
  if (trends.length === 0) {
    return <p className="text-sm text-ink-500">No semester data available.</p>;
  }

  const latest = trends[trends.length - 1];
  const previous = trends.length >= 2 ? trends[trends.length - 2] : null;
  const delta = previous ? latest.sentiment_score - previous.sentiment_score : 0;
  const style = deltaStyle(delta);

  return (
    <div className="space-y-6">
      {previous && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`stat-card ring-2 ${style.ring}`}>
            <p className={`text-2xl font-bold ${style.text}`}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(3)}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">{style.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink-800">{courseCode}</p>
            <p className="text-xs text-ink-500">
              {previous.semester_label} → {latest.semester_label}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-ink-900">{latest.review_count}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Latest reviews</p>
            <p className="text-xs text-ink-500">{latest.semester_label}</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-ink-900">{latest.avg_rating.toFixed(1)}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Avg rating</p>
            <p className="text-xs text-ink-500">{latest.semester_label}</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-emerald-600">{latest.positive_pct}%</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">% positive</p>
            <p className="text-xs text-ink-500">{latest.semester_label}</p>
          </div>
        </div>
      )}

      {trends.length >= 2 ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis dataKey="semester_label" tick={{ fill: "#667690", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[-1, 1]} tick={{ fill: "#667690", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={0.05} stroke="#16a34a" strokeDasharray="4 4" />
              <ReferenceLine y={-0.05} stroke="#dc2626" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="#b0b9c9" />
              <Line
                type="monotone"
                dataKey="sentiment_score"
                name="Sentiment"
                stroke="#3366ff"
                strokeWidth={3}
                dot={{ r: 5, fill: "#3366ff", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Need reviews from at least two semesters for a trend line.
        </p>
      )}

      {trends.length >= 2 && (
        <p className="text-sm leading-relaxed text-ink-600">
          <strong className="text-ink-800">{courseCode}</strong> sentiment{" "}
          {(() => {
            const first = trends[0];
            const last = trends[trends.length - 1];
            const totalDelta = last.sentiment_score - first.sentiment_score;
            const word =
              totalDelta > 0.02 ? "improved" : totalDelta < -0.02 ? "declined" : "stayed stable";
            return (
              <>
                {word} from {first.semester_label} ({first.sentiment_score >= 0 ? "+" : ""}
                {first.sentiment_score.toFixed(3)}) to {last.semester_label} (
                {last.sentiment_score >= 0 ? "+" : ""}
                {last.sentiment_score.toFixed(3)}).
              </>
            );
          })()}
        </p>
      )}
    </div>
  );
}
