import type { RunState } from "../lib/types";

// Auffälliges Sicherheits-Banner: DRY-RUN (grün) vs. LIVE schreibt (rot).
export default function StatusBanner({ runState }: { runState: RunState | null }) {
  if (!runState) return null;
  const live = !runState.dry_run;
  return (
    <div
      className={`w-full px-4 py-2 text-center text-sm font-bold text-white ${live ? "bg-live" : "bg-dry"}`}
    >
      {live ? "⚠️ LIVE — Schreibzugriffe gehen an Shopify" : "🛡️ DRY-RUN aktiv — es wird NICHTS geschrieben"}
      {runState.paused && " · PAUSIERT"}
      {runState.is_running ? " · Loop läuft" : " · Loop gestoppt"}
    </div>
  );
}
