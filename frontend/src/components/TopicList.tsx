import { Badge } from "./ui/Badge";

interface Props {
  topics: string[];
}

export function TopicList({ topics }: Props) {
  if (topics.length === 0) {
    return <p className="text-sm text-ink-500">No topics extracted yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <Badge key={topic} label={topic} variant="topic" />
      ))}
    </div>
  );
}
