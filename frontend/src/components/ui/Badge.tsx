interface Props {
  label: string;
  variant?: "positive" | "neutral" | "negative" | "topic";
}

const map = {
  positive: "badge-pos",
  neutral: "badge-neu",
  negative: "badge-neg",
  topic: "badge-topic",
};

export function Badge({ label, variant = "topic" }: Props) {
  return <span className={map[variant]}>{label}</span>;
}
