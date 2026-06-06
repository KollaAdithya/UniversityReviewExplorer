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

export function CourseComparisonChart({ courses }: Props) {
  if (courses.length < 2) {
    return (
      <p className="text-sm text-slate-500">Select a university with at least two courses to compare.</p>
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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="code" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            domain={[-1, 1]}
            tick={{ fontSize: 11 }}
            label={{ value: "Sentiment", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: "% Positive", angle: 90, position: "insideRight", fontSize: 11 }}
          />
          <Tooltip />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="sentiment"
            name="Sentiment score"
            fill="#2980B9"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="positivePct"
            name="% Positive"
            stroke="#27AE60"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
