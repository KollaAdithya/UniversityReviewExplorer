import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Props {
  positive: number;
  neutral: number;
  negative: number;
}

const COLORS = ["#16a34a", "#d97706", "#dc2626"];

export function SentimentChart({ positive, neutral, negative }: Props) {
  const slices = [
    { name: "Positive", value: positive },
    { name: "Neutral", value: neutral },
    { name: "Negative", value: negative },
  ].filter((item) => item.value > 0);

  const total = positive + neutral + negative;

  if (total === 0 || slices.length === 0) {
    return <p className="text-sm text-ink-500">No sentiment data yet.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={62}
            outerRadius={96}
            paddingAngle={slices.length > 1 ? 3 : 0}
            label={false}
          >
            {slices.map((slice, index) => (
              <Cell
                key={slice.name}
                fill={COLORS[["Positive", "Neutral", "Negative"].indexOf(slice.name)]}
                stroke="#fff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
            formatter={(value: string) => {
              const item = slices.find((slice) => slice.name === value);
              return `${value} ${item?.value ?? 0}%`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
