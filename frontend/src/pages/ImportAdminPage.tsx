import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ImportRun } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { InsightsNav } from "../components/InsightsNav";
import { PageHero, PageShell, SectionCard } from "../components/ui/PageShell";

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-800 ring-emerald-200/70";
  if (status === "failed") return "bg-rose-50 text-rose-800 ring-rose-200/70";
  if (status === "skipped") return "bg-amber-50 text-amber-800 ring-amber-200/70";
  return "bg-brand-50 text-brand-800 ring-brand-200/70";
}

export function ImportAdminPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = () => {
    setLoading(true);
    api
      .listImportRuns()
      .then(setRuns)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleRecord = async () => {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.recordImportRun();
      setMessage("Recorded snapshot of current database counts.");
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record import run");
    } finally {
      setBusy(false);
    }
  };

  const handleTrigger = async () => {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const run = await api.triggerImport();
      setMessage(`Import finished with status: ${run.status}`);
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import trigger failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow="Data pipeline"
          title="Import admin console"
          description="Audit log for bulk CSV imports. Sign in to record snapshots or trigger a small incremental import job."
        />
      }
    >
      <InsightsNav />

      {!user ? (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5">
          <p className="font-semibold text-amber-900">Sign in to manage imports</p>
          <p className="mt-1 text-sm text-amber-800/80">Import triggers require authentication.</p>
          <Link to="/login" className="btn-primary mt-4 inline-flex">
            Sign in
          </Link>
        </div>
      ) : (
        <SectionCard title="Actions" subtitle="Requires signed-in user" className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={handleRecord} className="btn-primary">
              Record current DB snapshot
            </button>
            <button type="button" disabled={busy} onClick={handleTrigger} className="btn-secondary">
              Trigger import (max 100 rows)
            </button>
          </div>
          {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
        </SectionCard>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <SectionCard title="Import audit log" subtitle="Recent pipeline runs">
        {loading && <div className="loading-pulse h-32" />}
        {!loading && runs.length === 0 && (
          <p className="text-sm text-ink-500">No import runs recorded yet.</p>
        )}
        {!loading && runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-3 py-3">Started</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Imported</th>
                  <th className="px-3 py-3">Triggered by</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.run_id} className="border-b border-ink-50 align-top">
                    <td className="px-3 py-3 text-ink-600">{new Date(run.started_at).toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-xs">{run.source_file}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(run.status)}`}>
                        {run.status}
                      </span>
                      {run.error_message && (
                        <p className="mt-1 max-w-xs text-xs text-ink-500">{run.error_message}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {run.rows_imported.toLocaleString()}
                      {run.rows_skipped > 0 && (
                        <span className="text-ink-400"> · {run.rows_skipped} skipped</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-600">{run.triggered_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
