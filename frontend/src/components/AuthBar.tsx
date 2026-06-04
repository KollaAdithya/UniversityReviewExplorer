import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AuthBar() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 text-sm">
      <Link to="/" className="font-semibold text-indigo-700 hover:underline">
        Course Review Explorer
      </Link>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-slate-600">{user.email}</span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="rounded-md bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
