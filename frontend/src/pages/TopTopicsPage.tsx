import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type UniversityTopicAnalytics } from "../api/client";
import { InsightsNav } from "../components/InsightsNav";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

export function TopTopicsPage() {
  const [data, setData] = useState<UniversityTopicAnalytics[]>([]);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getTopTopicsByUniversity(5)
      .then((rows) => {
        if (active) setData(rows.filter((row) => row.topics.length > 0));
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const allTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      for (const topic of row.topics) {
        counts.set(topic.topic, (counts.get(topic.topic) ?? 0) + topic.count);
      }
    }
    return [...counts.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const matchesQuery = !query || row.university_name.toLowerCase().includes(query.toLowerCase());
      const matchesTopic =
        !topicFilter || row.topics.some((t) => t.topic.toLowerCase().includes(topicFilter.toLowerCase()));
      return matchesQuery && matchesTopic;
    });
  }, [data, query, topicFilter]);

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="Cross-university analytics"
          title="Top review topics by university"
          description="Compare the most-mentioned themes across schools. Data comes from the live /api/v1/analytics/top-topics endpoint."
        />
      }
    >
      <InsightsNav />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <input
          type="search"
          placeholder="Filter universities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field"
        />
        <input
          type="search"
          placeholder="Filter by topic (e.g. Tough Grader)…"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="input-field"
        />
      </div>

      {loading && <div className="loading-pulse mb-6 h-48" />}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <SectionCard title="Popular topics nationally" subtitle="Aggregated across all imported reviews" className="mb-8">
            <div className="flex flex-wrap gap-2">
              {allTopics.map((item) => (
                <button
                  key={item.topic}
                  type="button"
                  onClick={() => setTopicFilter(item.topic)}
                  className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-200/80 transition hover:bg-brand-100"
                >
                  {item.topic} ({item.count})
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By university" subtitle={`${filtered.length} schools shown`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-3 py-3">University</th>
                    <th className="px-3 py-3">Top topics</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.university_id} className="border-b border-ink-50 align-top">
                      <td className="px-3 py-4">
                        <Link
                          to={`/universities/${row.university_id}`}
                          className="font-semibold text-brand-700 hover:text-brand-900"
                        >
                          {row.university_name}
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          {row.topics.map((topic) => (
                            <span
                              key={topic.topic}
                              className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-ink-200/70"
                            >
                              {topic.topic} ({topic.count})
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}
