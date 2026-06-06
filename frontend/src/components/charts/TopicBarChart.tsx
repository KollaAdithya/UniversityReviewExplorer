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

export function TopicBarChart({ topics }: Props) {
  if (topics.length === 0) {
    return <p className="text-sm text-slate-500">No topics extracted yet.</p>;
  }

  const data = [...topics].sort((a, b) => a.count - b.count);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="topic" width={120} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2980B9" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
