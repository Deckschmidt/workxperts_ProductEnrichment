import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { AuditRow } from "../lib/types";

const RESULT_COLORS: Record<string, string> = {
  GOLD: "bg-amber-100 text-amber-800",
  MANUAL: "bg-orange-100 text-orange-800",
  ERROR: "bg-red-100 text-red-800",
  SKIPPED: "bg-slate-100 text-slate-500",
};

export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
    if (result) q = q.eq("result", result);
    const { data } = await q;
    setRows((data as AuditRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const filtered = rows.filter((r) => !search || (r.title ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Audit</h1>
        <div className="flex items-center gap-3 text-sm">
          <input placeholder="Produkt suchen…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="rounded border px-2 py-1" />
          <select value={result} onChange={(e) => setResult(e.target.value)} className="rounded border px-2 py-1">
            <option value="">alle Ergebnisse</option>
            <option value="GOLD">GOLD</option>
            <option value="MANUAL">MANUAL</option>
            <option value="ERROR">ERROR</option>
            <option value="SKIPPED">SKIPPED</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Produkt</th>
              <th>Ergebnis</th>
              <th>EAN</th>
              <th>Klasse</th>
              <th>Felder</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const p = r.payload ?? {};
              const fields = (p.fields as string[] | undefined) ?? [];
              return (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2">
                    {r.product_id ? (
                      <Link className="text-blue-600 hover:underline" to={`/product/${encodeURIComponent(r.product_id)}`}>
                        {r.title ?? r.product_id}
                      </Link>
                    ) : (r.title ?? "—")}
                  </td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${RESULT_COLORS[r.result ?? ""] ?? "bg-slate-100"}`}>
                      {r.result}
                    </span>
                  </td>
                  <td>{(p.ean as string) ?? "—"}</td>
                  <td>{(p.class_change as string) || (p.klasse as string) || "—"}</td>
                  <td className="max-w-xs text-xs text-slate-500">{fields.join(", ")}</td>
                  <td className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("de-DE")}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-slate-400">Keine Einträge.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
