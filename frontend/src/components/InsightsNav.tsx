import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/analytics/top-topics", label: "Top topics" },
  { to: "/analytics/bigquery", label: "BigQuery" },
  { to: "/data/catalog", label: "Data sources" },
  { to: "/admin/imports", label: "Import admin" },
];

export function InsightsNav() {
  const location = useLocation();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={
              active
                ? "rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                : "rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
