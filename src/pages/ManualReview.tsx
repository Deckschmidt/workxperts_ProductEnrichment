import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { api } from "../lib/api";
import { useAuthCtx } from "../App";
import type { ManualReviewRow } from "../lib/types";

export default function ManualReview() {
  const { isAdmin } = useAuthCtx();
  const [rows, setRows] = useState<ManualReviewRow[]>([]);
  const [search, setSearch] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("manual_review").select("*").order("created_at", { ascending: false }).limit(500);
    if (!showResolved) q = q.eq("resolved", false);
    const { data } = await q;
    setRows((data as ManualReviewRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResolved]);

  async function resolve(id: number, resolved: boolean) {
    await api.resolveReview(id, resolved);
    load();
  }

  const filtered = rows.filter((r) =>
    !search ||
    (r.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.reason ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Manuell-Liste</h1>
        <div className="flex items-center gap-3 text-sm">
          <input placeholder="Suche…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="rounded border px-2 py-1" />
          <label className="flex items-center gap-1 text-slate-500">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Erledigte zeigen
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Produkt</th>
              <th>Grund</th>
              <th>Details</th>
              <th>Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-b ${r.resolved ? "text-slate-400" : ""}`}>
                <td className="py-2">
                  {r.product_id ? (
                    <Link className="text-blue-600 hover:underline" to={`/product/${encodeURIComponent(r.product_id)}`}>
                      {r.title ?? r.product_id}
                    </Link>
                  ) : (r.title ?? "—")}
                </td>
                <td>{r.reason}</td>
                <td className="max-w-xs truncate" title={r.details ?? ""}>{r.details}</td>
                <td className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("de-DE")}</td>
                <td className="text-right">
                  {isAdmin && (
                    <button onClick={() => resolve(r.id, !r.resolved)}
                      className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50">
                      {r.resolved ? "Wieder offen" : "Erledigt"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-400">Keine Einträge.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
