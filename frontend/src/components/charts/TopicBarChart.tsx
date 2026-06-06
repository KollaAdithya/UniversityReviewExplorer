import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopTopicItem } from "../../api/client";

interface Props {
  topics: TopTopicItem[];
}

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #eceef2",
  boxShadow: "0 8px 24px rgba(28,32,41,0.08)",
};

export function TopicBarChart({ topics }: Props) {
  if (topics.length === 0) {
    return <p className="text-sm text-ink-500">No topics extracted yet.</p>;
  }

  const data = [...topics].sort((a, b) => a.count - b.count);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#667690", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="topic"
            width={120}
            tick={{ fill: "#434d61", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="#3366ff" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
