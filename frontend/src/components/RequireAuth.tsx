import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="text-sm text-ink-500">Checking session…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5">
        <p className="font-semibold text-amber-900">Sign in to submit a review</p>
        <p className="mt-1 text-sm text-amber-800/80">
          You can browse all analytics and reviews without an account.
        </p>
        <Link
          to="/login"
          state={{ from: location.pathname }}
          className="btn-primary mt-4 inline-flex"
        >
          Sign in or create account
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
