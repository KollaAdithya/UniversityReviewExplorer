import { useEffect, useState } from "react";
import { api, type DataCatalog } from "../api/client";
import { InsightsNav } from "../components/InsightsNav";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataCatalogPage() {
  const [catalog, setCatalog] = useState<DataCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getDataCatalog()
      .then((data) => {
        if (active) setCatalog(data);
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

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="Data provenance"
          title="Public dataset catalog"
          description="Real RateMyProfessors-style research data — no synthetic reviews. See sources, licenses, and import commands."
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

      {catalog && (
        <>
          <SectionCard title="Live database" subtitle="Current PostgreSQL / SQLite counts" className="mb-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <p className="text-2xl font-bold text-ink-900">{catalog.database.university_count}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Universities</p>
              </div>
              <div className="stat-card">
                <p className="text-2xl font-bold text-ink-900">{catalog.database.course_count}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Courses</p>
              </div>
              <div className="stat-card">
                <p className="text-2xl font-bold text-ink-900">{catalog.database.review_count.toLocaleString()}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-400">Reviews</p>
              </div>
            </div>
            {catalog.last_import && (
              <p className="mt-4 text-sm text-ink-500">
                Last import: <span className="font-semibold text-ink-800">{catalog.last_import.status}</span> —{" "}
                {catalog.last_import.rows_imported.toLocaleString()} rows from {catalog.last_import.source_file} (
                {new Date(catalog.last_import.started_at).toLocaleString()})
              </p>
            )}
          </SectionCard>

          <div className="grid gap-6">
            {catalog.datasets.map((dataset) => (
              <SectionCard key={dataset.id} title={dataset.name} subtitle={dataset.coverage}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-ink-700">Source</dt>
                    <dd className="mt-1 break-all text-brand-700">
                      <a href={dataset.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                        {dataset.source_url}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-700">License</dt>
                    <dd className="mt-1 text-ink-600">{dataset.license}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-700">Local path</dt>
                    <dd className="mt-1 font-mono text-xs text-ink-600">{dataset.local_path}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-700">File on server</dt>
                    <dd className="mt-1 text-ink-600">
                      {dataset.file_exists
                        ? `${formatBytes(dataset.file_size_bytes)} · modified ${dataset.file_modified_at ? new Date(dataset.file_modified_at).toLocaleString() : "—"}`
                        : "Not present (optional download)"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-ink-100">
                    <code>{dataset.download_command}</code>
                  </pre>
                  <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-ink-100">
                    <code>{dataset.import_command}</code>
                  </pre>
                </div>
              </SectionCard>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
