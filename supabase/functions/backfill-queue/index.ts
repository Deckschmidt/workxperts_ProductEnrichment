// ============================================================================
// Edge Function: backfill-queue  (Abschnitt 4)
// Einmaliger Initial-Import aller Bestandsprodukte (Bestand > 0) in die Queue.
// Gechunkt + wiederaufnehmbar: verarbeitet PAGE_BUDGET Seiten pro Aufruf, gibt
// den nächsten Cursor zurück. Cursor wird in settings('backfill_cursor')
// gehalten, sodass man die Function einfach mehrfach aufrufen kann, bis
// done=true. Bereits angereicherte Produkte werden direkt als 'done' markiert.
// ============================================================================
import { adminClient, corsHeaders, json } from "../_shared/db.ts";
import { PRODUCT_LIST_QUERY, shopifyGql } from "../_shared/shopify.ts";

const PAGE_BUDGET = 40; // ~2000 Produkte pro Aufruf (sicher unter Zeitlimit)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();
  const body = await req.json().catch(() => ({}));

  const { data: rs } = await supabase.from("run_state").select("brand_filter").eq("id", 1).single();
  let qStr = "inventory_total:>0";
  if (rs?.brand_filter) qStr += ` vendor:${rs.brand_filter}`;

  // Cursor: aus Body oder aus settings (Wiederaufnahme), 'reset' beginnt neu
  let cursor: string | null = body.cursor ?? null;
  if (!cursor && !body.reset) {
    const { data: s } = await supabase.from("settings").select("value").eq("key", "backfill_cursor").maybeSingle();
    cursor = (s?.value as any)?.cursor ?? null;
  }

  let pages = 0;
  let pending = 0;
  let done = 0;
  let hasNext = true;
  let endCursor: string | null = cursor;

  while (pages < PAGE_BUDGET) {
    const data: any = await shopifyGql(PRODUCT_LIST_QUERY, { q: qStr, cursor: endCursor });
    const conn = data.products;
    const rows = conn.nodes.map((p: any) => ({
      id: p.id, title: p.title, vendor: p.vendor, total_inventory: p.totalInventory,
      // bereits angereichert -> done, sonst pending
      status: p.normen?.value ? "done" : "pending",
    }));
    if (rows.length) {
      await supabase.from("products_queue").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      pending += rows.filter((r: any) => r.status === "pending").length;
      done += rows.filter((r: any) => r.status === "done").length;
    }
    pages++;
    hasNext = conn.pageInfo.hasNextPage;
    endCursor = conn.pageInfo.endCursor;
    if (!hasNext) break;
  }

  // Fortschritt sichern
  await supabase.from("settings").upsert({
    key: "backfill_cursor",
    value: hasNext ? { cursor: endCursor } : { cursor: null, completed: true },
  });

  return json({ pages, pending_added: pending, done_marked: done, done: !hasNext, next_cursor: hasNext ? endCursor : null });
});
