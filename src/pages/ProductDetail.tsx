import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { api } from "../lib/api";
import { useAuthCtx } from "../App";
import type { AuditRow, QueueRow } from "../lib/types";

interface Preview {
  body?: string;
  bullets?: string[];
  usp?: string;
  seo_title?: string;
  seo_desc?: string;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuthCtx();
  const [row, setRow] = useState<QueueRow | null>(null);
  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: q }, { data: a }] = await Promise.all([
      supabase.from("products_queue").select("*").eq("id", id).maybeSingle(),
      supabase.from("audit_log").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setRow((q as QueueRow) ?? null);
    setAudit((a as AuditRow) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-slate-500">Lädt…</p>;

  const preview = (audit?.payload?.preview as Preview | undefined) ?? undefined;
  const committed = audit?.payload?.commit as boolean | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{row?.title ?? audit?.title ?? id}</h1>
        <Link to="/audit" className="text-sm text-blue-600 hover:underline">← zurück</Link>
      </div>

      {/* Status / Metadaten */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm sm:grid-cols-4">
        <Meta label="Status" value={row?.status} />
        <Meta label="Marke" value={row?.vendor} />
        <Meta label="Bestand" value={row?.total_inventory?.toString()} />
        <Meta label="EAN-Treffer" value={row?.matched_ean} />
        <Meta label="Klassenänderung" value={row?.class_change} />
        <Meta label="Versuche" value={row?.attempts?.toString()} />
        <Meta label="Flags" value={row?.flags?.join(", ")} />
        <Meta label="asx-URL (nur intern)" value={row?.asx_url} />
      </div>

      {row?.error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{row.error}</p>}

      {/* Vorschau der generierten Präsentation */}
      {preview ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">Generierte Inhalte</h2>
            <span className={`rounded px-2 py-0.5 text-xs ${committed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {committed ? "LIVE geschrieben" : "nur Vorschau (Dry-Run)"}
            </span>
          </div>

          <Field label="SEO-Title">{preview.seo_title}</Field>
          <Field label="SEO-Meta">{preview.seo_desc}</Field>
          <Field label="USP">{preview.usp}</Field>

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-2 text-xs font-medium uppercase text-slate-400">Bulletpoints</div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {(preview.bullets ?? []).map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-2 text-xs font-medium uppercase text-slate-400">Body HTML (gerendert)</div>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.body ?? "" }} />
          </div>
        </div>
      ) : (
        <p className="text-slate-500">Noch keine Vorschau vorhanden (Produkt wurde noch nicht verarbeitet).</p>
      )}

      {isAdmin && row && (
        <button onClick={async () => { await api.resetProduct(row.id); load(); }}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">
          Neu in die Queue (erneut verarbeiten)
        </button>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="break-words text-slate-700">{value || "—"}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-1 text-xs font-medium uppercase text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{children || "—"}</div>
    </div>
  );
}
