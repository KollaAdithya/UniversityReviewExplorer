import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AuthBar() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="app-nav">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-lg shadow-brand-900/40">
            CR
          </span>
          <span>
            <span className="block font-display text-base font-semibold leading-tight text-white">
              Course Review Explorer
            </span>
            <span className="block text-[11px] font-medium text-brand-200/90">
              Sentiment · Topics · Analytics
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {!loading && location.pathname !== "/login" && !user && (
            <Link
              to="/login"
              className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-brand-100 transition hover:bg-white/10 sm:inline"
            >
              Sign in
            </Link>
          )}
          {loading ? (
            <span className="text-sm text-brand-200">Loading…</span>
          ) : user ? (
            <>
              <span className="hidden max-w-[180px] truncate text-sm text-brand-100 sm:inline">
                {user.email}
              </span>
              <button type="button" onClick={() => logout()} className="btn-ghost !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary !bg-white !text-brand-800 hover:!bg-brand-50 sm:hidden">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
