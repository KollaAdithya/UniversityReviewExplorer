import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type BigQueryDashboard } from "../api/client";
import { InsightsNav } from "../components/InsightsNav";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

export function BigQueryDashboardPage() {
  const [dashboard, setDashboard] = useState<BigQueryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getBigQueryDashboard()
      .then((data) => {
        if (active) setDashboard(data);
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

  const chartData =
    dashboard?.sentiment_by_university.map((row) => ({
      name: row.university_name.length > 22 ? `${row.university_name.slice(0, 20)}…` : row.university_name,
      score: row.sentiment_score,
      positive: row.positive_pct,
    })) ?? [];

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="GCP analytics warehouse"
          title="BigQuery analytics dashboard"
          description="Cross-university sentiment and topic aggregates. Uses BigQuery when enabled; otherwise mirrors Cloud SQL for local demos."
        />
      }
    >
      <InsightsNav />

      {loading && <div className="loading-pulse mb-6 h-48" />}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {dashboard && (
        <>
          {!dashboard.enabled && (
            <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <strong>BigQuery sync is off locally</strong> — this is expected. Charts below use your{" "}
              <strong>Cloud SQL / SQLite database</strong> ({dashboard.row_count.toLocaleString()} reviews). On GCP
              production, set <code className="rounded bg-white/80 px-1">ENABLE_BIGQUERY=true</code> and new reviews
              stream to the warehouse on submit.
            </div>
          )}

          <SectionCard title="Warehouse status" className="mb-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="stat-card">
                <p className={`text-lg font-bold ${dashboard.enabled ? "text-emerald-600" : "text-ink-900"}`}>
                  {dashboard.enabled ? "Enabled" : "Off (local)"}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">BigQuery sync</p>
              </div>
              <div className="stat-card">
                <p className="text-lg font-bold text-ink-900">{dashboard.row_count.toLocaleString()}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Analytics rows</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-bold text-ink-900">
                  {dashboard.enabled ? "BigQuery warehouse" : "Cloud SQL mirror"}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Data source</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-mono font-bold text-ink-900">{dashboard.table_id}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Table</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-500">
              Sync trigger: <code className="rounded bg-ink-100 px-1.5 py-0.5">{dashboard.sync_trigger}</code>
            </p>
            {dashboard.bq_error && (
              <p className="mt-2 text-sm text-amber-700">BigQuery query note: {dashboard.bq_error}</p>
            )}
          </SectionCard>

          <SectionCard
            title="Sentiment by university"
            subtitle="Sentiment score from (+1 positive, 0 neutral, −1 negative)"
            className="mb-8"
          >
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
                  <XAxis dataKey="name" tick={{ fill: "#667690", fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis domain={[-1, 1]} tick={{ fill: "#667690", fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" name="Sentiment score" fill="#3366ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Global top topics" subtitle="Most frequent tags across all reviews">
            <div className="flex flex-wrap gap-2">
              {dashboard.global_top_topics.map((topic) => (
                <span
                  key={topic.topic}
                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200/70"
                >
                  {topic.topic} ({topic.count})
                </span>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}
