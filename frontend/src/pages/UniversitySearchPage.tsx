import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type University, type UniversityTopicAnalytics } from "../api/client";

export function UniversitySearchPage() {
  const [query, setQuery] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [topicData, setTopicData] = useState<UniversityTopicAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.listUniversities(query || undefined), api.getTopTopicsByUniversity(3)])
      .then(([uniData, topics]) => {
        if (!active) return;
        setUniversities(uniData);
        setTopicData(topics.slice(0, 3));
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
  }, [query]);

  const compareData = useMemo(() => {
    const topicNames = Array.from(
      new Set(topicData.flatMap((entry) => entry.topics.map((item) => item.topic))),
    ).slice(0, 5);
    return topicNames.map((topic) => {
      const row: Record<string, string | number> = { topic };
      topicData.forEach((entry) => {
        const match = entry.topics.find((item) => item.topic === topic);
        row[entry.university_name.split(" ")[0]] = match?.count ?? 0;
      });
      return row;
    });
  }, [topicData]);

  const compareKeys = topicData.map((entry) => entry.university_name.split(" ")[0]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Multi-University Course Review Explorer</h1>
        <p className="mt-2 text-slate-600">
          Choose a university to explore course sentiment, topics, and AI-generated summaries.
        </p>
      </header>

      <input
        type="search"
        placeholder="Search universities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none"
      />

      {loading && <p className="text-slate-500">Loading universities...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {universities.map((university) => (
          <Link
            key={university.university_id}
            to={`/universities/${university.university_id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-indigo-700">{university.name}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {university.course_count} courses · {university.review_count} reviews
            </p>
          </Link>
        ))}
      </div>

      {compareData.length > 0 && (
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Cross-University Topic Comparison</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                {compareKeys.map((key, index) => (
                  <Bar key={key} dataKey={key} fill={["#4f46e5", "#0891b2", "#059669"][index % 3]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
