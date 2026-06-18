import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { RunState } from "../lib/types";

export default function RunControls({
  runState, isAdmin, onChange,
}: {
  runState: RunState;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [batch, setBatch] = useState(runState.batch_size);
  const [brand, setBrand] = useState(runState.brand_filter ?? "");
  const [maxCredits, setMaxCredits] = useState(runState.max_credits_per_day);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setBatch(runState.batch_size);
    setBrand(runState.brand_filter ?? "");
    setMaxCredits(runState.max_credits_per_day);
  }, [runState]);

  async function patch(p: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true); setErr(null);
    try { await api.updateRunState(p); onChange(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  async function trigger(fn: "enrich-batch" | "discover-new" | "backfill-queue", payload = {}) {
    setBusy(true); setErr(null);
    try { await api.trigger(fn, payload); onChange(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  const disabled = !isAdmin || busy;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Steuerung</h2>
        {!isAdmin && <span className="text-xs text-slate-400">nur Lesen (viewer)</span>}
      </div>

      {/* Loop / Pause / Live-Schalter */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={disabled}
          onClick={() => patch({ is_running: !runState.is_running })}
          className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 ${runState.is_running ? "bg-slate-600" : "bg-green-600"}`}
        >
          {runState.is_running ? "Loop stoppen" : "Loop starten"}
        </button>
        <button
          disabled={disabled}
          onClick={() => patch({ paused: !runState.paused })}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {runState.paused ? "Fortsetzen" : "Pause"}
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            patch(
              { dry_run: !runState.dry_run },
              runState.dry_run
                ? "Wirklich LIVE schalten? Ab jetzt werden echte Schreibzugriffe an Shopify gesendet."
                : undefined,
            )
          }
          className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 ${runState.dry_run ? "bg-red-600" : "bg-green-600"}`}
        >
          {runState.dry_run ? "LIVE schreiben aktivieren" : "Zurück zu DRY-RUN"}
        </button>
      </div>

      {/* Parameter */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-slate-500">Batch-Größe</span>
          <div className="mt-1 flex gap-2">
            <input type="number" min={1} max={50} value={batch} disabled={disabled}
              onChange={(e) => setBatch(Number(e.target.value))}
              className="w-full rounded border px-2 py-1" />
            <button disabled={disabled} onClick={() => patch({ batch_size: batch })}
              className="rounded border px-2 text-xs disabled:opacity-40">OK</button>
          </div>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Marken-Filter (leer = alle)</span>
          <div className="mt-1 flex gap-2">
            <input value={brand} disabled={disabled} placeholder="z.B. Atlas"
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded border px-2 py-1" />
            <button disabled={disabled} onClick={() => patch({ brand_filter: brand.trim() || null })}
              className="rounded border px-2 text-xs disabled:opacity-40">OK</button>
          </div>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Credit-Budget/Tag</span>
          <div className="mt-1 flex gap-2">
            <input type="number" min={0} value={maxCredits} disabled={disabled}
              onChange={(e) => setMaxCredits(Number(e.target.value))}
              className="w-full rounded border px-2 py-1" />
            <button disabled={disabled} onClick={() => patch({ max_credits_per_day: maxCredits })}
              className="rounded border px-2 text-xs disabled:opacity-40">OK</button>
          </div>
        </label>
      </div>

      <div className="text-sm text-slate-600">
        Firecrawl-Credits heute: <span className="font-semibold">{runState.credits_used_today}</span> / {runState.max_credits_per_day}
      </div>

      {/* Manuelle Trigger */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button disabled={disabled} onClick={() => trigger("enrich-batch", { force: true })}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40">
          1 Batch jetzt (Test)
        </button>
        <button disabled={disabled} onClick={() => trigger("discover-new")}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40">
          Neue Produkte suchen
        </button>
        <button disabled={disabled} onClick={() => trigger("backfill-queue")}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40">
          Backfill (Initial-Import)
        </button>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
