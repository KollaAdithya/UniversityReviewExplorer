import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="px-4 py-6 text-slate-500">Loading...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <p className="font-medium">Sign in required to submit a review</p>
        <p className="mt-1 text-sm">
          You can still read all reviews and analytics below.
        </p>
        <Link
          to="/login"
          state={{ from: location.pathname }}
          className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:underline"
        >
          Sign in or create an account →
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
