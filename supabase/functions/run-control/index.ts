// ============================================================================
// Edge Function: run-control
// Admin-gesicherte Steuerung aus dem Cockpit. Prüft serverseitig die Rolle
// (user_roles.role = 'admin'). viewer dürfen NICHT schreiben/steuern.
// Aktionen: update_run_state | resolve_review | reset_product | trigger
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { adminClient, corsHeaders, json } from "../_shared/db.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) Nutzer aus JWT ermitteln
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return json({ error: "nicht eingeloggt" }, 401);

  const supabase = adminClient();

  // 2) Adminrolle prüfen
  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleRow?.role !== "admin") return json({ error: "nur Admins dürfen steuern" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  switch (action) {
    case "update_run_state": {
      const allowed = ["is_running", "paused", "dry_run", "batch_size", "brand_filter", "max_credits_per_day"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) patch[k] = body[k];
      if (Object.keys(patch).length === 0) return json({ error: "keine gültigen Felder" }, 400);
      const { data, error } = await supabase.from("run_state").update(patch).eq("id", 1).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, run_state: data });
    }

    case "resolve_review": {
      const { id, resolved = true } = body;
      if (!id) return json({ error: "id fehlt" }, 400);
      const { error } = await supabase.from("manual_review").update({ resolved }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case "reset_product": {
      const { id } = body;
      if (!id) return json({ error: "id fehlt" }, 400);
      const { error } = await supabase.from("products_queue")
        .update({ status: "pending", attempts: 0, error: null }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case "trigger": {
      // Manueller Anstoß einer anderen Edge Function (z.B. Trockenlauf-Batch)
      const fn = body.fn as string;
      if (!["enrich-batch", "discover-new", "backfill-queue"].includes(fn)) {
        return json({ error: "unbekannte Function" }, 400);
      }
      const r = await fetch(`${URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}` },
        body: JSON.stringify(body.payload || {}),
      });
      const out = await r.json().catch(() => ({}));
      return json({ ok: true, fn, result: out });
    }

    default:
      return json({ error: `unbekannte action: ${action}` }, 400);
  }
});
