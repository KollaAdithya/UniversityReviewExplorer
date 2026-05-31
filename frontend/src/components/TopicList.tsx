interface Props {
  topics: string[];
}

export function TopicList({ topics }: Props) {
  if (topics.length === 0) {
    return <p className="text-sm text-slate-500">No topics extracted yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <span
          key={topic}
          className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800"
        >
          {topic}
        </span>
      ))}
    </div>
  );
}
