// ============================================================================
// Edge Function: enrich-batch  (Abschnitt 4)
// Verarbeitet pro Aufruf nur batch_size Produkte mit status='pending'.
// Wiederaufnehmbar: hält allen Fortschritt in der DB. Vom Cron alle 3 Min
// aufgerufen, solange run_state es erlaubt (Gate auch hier, defense in depth).
// ============================================================================
import { adminClient, audit, corsHeaders, json } from "../_shared/db.ts";
import { fetchProductDetail } from "../_shared/shopify.ts";
import { processProduct } from "../_shared/pipeline.ts";
import type { CreditTracker } from "../_shared/firecrawl.ts";

const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();
  const body = await req.json().catch(() => ({}));
  const force = !!body.force;

  // run_state laden + Gate
  const { data: rs } = await supabase.from("run_state").select("*").eq("id", 1).single();
  if (!rs) return json({ error: "run_state fehlt" }, 500);

  // Tages-Credit-Zähler ggf. zurücksetzen
  const today = new Date().toISOString().slice(0, 10);
  let creditsToday = rs.credits_used_today as number;
  if (rs.credits_day !== today) {
    creditsToday = 0;
    await supabase.from("run_state").update({ credits_used_today: 0, credits_day: today }).eq("id", 1);
  }

  if (!force) {
    if (!rs.is_running || rs.paused) return json({ skipped: "loop nicht aktiv (is_running/paused)" });
    if (creditsToday >= rs.max_credits_per_day) return json({ skipped: "Tages-Credit-Budget erreicht" });
  }

  const batchSize = rs.batch_size as number;
  const commit = !rs.dry_run;

  // Pending-Einträge holen (optional Marken-Filter) und auf 'processing' setzen
  let q = supabase.from("products_queue").select("id,title").eq("status", "pending").limit(batchSize);
  if (rs.brand_filter) q = q.eq("vendor", rs.brand_filter);
  const { data: picks, error: pickErr } = await q;
  if (pickErr) return json({ error: pickErr.message }, 500);
  if (!picks || picks.length === 0) return json({ processed: 0, note: "keine pending-Produkte" });

  const ids = picks.map((p) => p.id);
  await supabase.from("products_queue").update({ status: "processing", last_attempt_at: new Date().toISOString() })
    .in("id", ids).eq("status", "pending");

  const credits: CreditTracker = { used: 0 };
  const stats = { gold: 0, manual: 0, skipped: 0, error: 0 };

  for (const pick of picks) {
    // Credit-Budget mitten im Batch respektieren
    if (!force && creditsToday + credits.used >= rs.max_credits_per_day) {
      await supabase.from("products_queue").update({ status: "pending" }).eq("id", pick.id);
      break;
    }
    try {
      const product = await fetchProductDetail(pick.id);
      if (!product) {
        await supabase.from("products_queue").update({ status: "skipped", error: "Produkt nicht gefunden" }).eq("id", pick.id);
        stats.skipped++;
        continue;
      }
      // Nur Bestand > 0
      if ((product.totalInventory ?? 0) <= 0) {
        await supabase.from("products_queue").update({ status: "skipped", error: "kein Bestand" }).eq("id", pick.id);
        stats.skipped++;
        continue;
      }
      // Idempotenz: bereits angereichert (custom.normen gesetzt) -> done
      if (product.normen?.value) {
        await supabase.from("products_queue").update({ status: "done" }).eq("id", pick.id);
        await audit(supabase, { product_id: pick.id, title: product.title, result: "SKIPPED", payload: { reason: "bereits angereichert" } });
        stats.skipped++;
        continue;
      }

      const r = await processProduct(supabase, product, commit, credits);
      const newStatus = r.status === "gold" ? "gold" : "manual";
      await supabase.from("products_queue").update({
        status: newStatus,
        asx_url: r.asxUrl ?? null,
        matched_ean: r.ean ?? null,
        class_change: r.classChange ?? null,
        flags: r.flags,
        fields_written: r.fieldsWritten,
        error: null,
      }).eq("id", pick.id);
      stats[r.status === "gold" ? "gold" : "manual"]++;
    } catch (e) {
      const msg = String(e).slice(0, 300);
      // attempts erhöhen; nach MAX_ATTEMPTS -> error
      const { data: cur } = await supabase.from("products_queue").select("attempts").eq("id", pick.id).single();
      const attempts = (cur?.attempts ?? 0) + 1;
      const status = attempts >= MAX_ATTEMPTS ? "error" : "pending";
      await supabase.from("products_queue").update({ attempts, status, error: msg }).eq("id", pick.id);
      if (status === "error") {
        await supabase.from("manual_review").insert({ product_id: pick.id, title: pick.title, reason: "Laufzeitfehler", details: msg });
        await audit(supabase, { product_id: pick.id, title: pick.title, result: "ERROR", payload: { error: msg } });
      }
      stats.error++;
    }
  }

  // Credits verbuchen
  if (credits.used > 0) {
    await supabase.from("run_state").update({ credits_used_today: creditsToday + credits.used }).eq("id", 1);
  }

  return json({ processed: picks.length, commit, credits_used: credits.used, stats });
});
