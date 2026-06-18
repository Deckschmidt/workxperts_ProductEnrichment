import type { QueueStats } from "../hooks/useQueueStats";

const LABELS: { key: keyof QueueStats; label: string; color: string }[] = [
  { key: "pending", label: "Offen", color: "text-slate-700" },
  { key: "processing", label: "In Arbeit", color: "text-blue-600" },
  { key: "gold", label: "GOLD", color: "text-amber-600" },
  { key: "manual", label: "Manuell", color: "text-orange-600" },
  { key: "done", label: "Fertig", color: "text-green-600" },
  { key: "error", label: "Fehler", color: "text-red-600" },
  { key: "skipped", label: "Übersprungen", color: "text-slate-400" },
];

export default function StatCards({ stats }: { stats: QueueStats | null }) {
  const processed = stats ? stats.gold + stats.manual + stats.done + stats.error + stats.skipped : 0;
  const total = stats?.total ?? 0;
  const pct = total ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex justify-between text-sm text-slate-600">
          <span>Fortschritt: {processed} von {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded bg-slate-200">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        {LABELS.map((l) => (
          <div key={l.key} className="rounded-lg border bg-white p-3 text-center">
            <div className={`text-xl font-semibold ${l.color}`}>{stats ? stats[l.key] : "–"}</div>
            <div className="text-xs text-slate-500">{l.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
