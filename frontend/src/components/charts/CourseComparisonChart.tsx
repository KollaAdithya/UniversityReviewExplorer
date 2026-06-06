import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CourseComparisonItem } from "../../api/client";

interface Props {
  courses: CourseComparisonItem[];
}

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #eceef2",
  boxShadow: "0 8px 24px rgba(28,32,41,0.08)",
};

export function CourseComparisonChart({ courses }: Props) {
  if (courses.length < 2) {
    return (
      <p className="text-sm text-ink-500">Select a university with at least two courses to compare.</p>
    );
  }

  const data = courses.map((c) => ({
    code: c.course_code,
    sentiment: c.sentiment_score,
    positivePct: c.positive_pct,
    reviews: c.review_count,
  }));

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
          <XAxis dataKey="code" tick={{ fill: "#667690", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            domain={[-1, 1]}
            tick={{ fill: "#667690", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Sentiment", angle: -90, position: "insideLeft", fontSize: 11, fill: "#8593ab" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: "#667690", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: "% Positive", angle: 90, position: "insideRight", fontSize: 11, fill: "#8593ab" }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#434d61" }} />
          <Bar
            yAxisId="left"
            dataKey="sentiment"
            name="Sentiment score"
            fill="#3366ff"
            radius={[6, 6, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="positivePct"
            name="% Positive"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 4, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
