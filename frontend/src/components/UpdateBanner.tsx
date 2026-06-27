import { useEffect, useState } from "react";

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";

export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (BUILD_ID === "dev") return;

    const checkForUpdate = async () => {
      try {
        const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
        const response = await fetch(`${base}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { buildId?: string };
        if (payload.buildId && payload.buildId !== BUILD_ID) {
          setUpdateReady(true);
        }
      } catch {
        // Offline or version.json missing — ignore.
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, 5 * 60 * 1000);
    window.addEventListener("focus", checkForUpdate);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,520px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-lg"
    >
      <p className="text-sm font-medium text-ink-800">A new version of the app is available.</p>
      <button
        type="button"
        className="btn-primary shrink-0 px-4 py-2 text-sm"
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}
