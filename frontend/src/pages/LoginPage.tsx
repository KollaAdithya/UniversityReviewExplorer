import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageShell } from "../components/ui/PageShell";

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("student@demo.edu");
  const [password, setPassword] = useState("demo123456");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/network-request-failed") {
        setError(
          "Cannot reach Firebase Auth. Start the local emulator: ./scripts/start-firebase-emulator.sh",
        );
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto flex min-h-[65vh] max-w-md flex-col justify-center">
        <div className="hero-panel text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Account</p>
          <h1 className="font-display text-3xl font-bold text-ink-950">Sign in to submit reviews</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Browse universities and analytics without an account. Sign in only when you want to post a review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="section-card mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              minLength={6}
              required
            />
          </div>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm font-medium text-brand-600 transition hover:text-brand-800"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          <Link to="/" className="font-medium text-brand-600 hover:text-brand-800">
            Continue browsing without signing in →
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
