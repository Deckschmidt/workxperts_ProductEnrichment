// ============================================================================
// Edge Function: discover-new  (Abschnitt 4)
// Läuft 1×/Stunde per Cron. Fragt Shopify nach Produkten mit Bestand > 0, die
// noch nicht in products_queue sind (oder 'done', aber custom.normen wieder
// leer), und legt sie als 'pending' an. -> Dauerbetrieb für neue Produkte.
// ============================================================================
import { adminClient, corsHeaders, json } from "../_shared/db.ts";
import { PRODUCT_LIST_QUERY, shopifyGql } from "../_shared/shopify.ts";

const MAX_PAGES = 60; // Sicherheitsdeckel pro Aufruf

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();

  const { data: rs } = await supabase.from("run_state").select("brand_filter").eq("id", 1).single();
  let qStr = "inventory_total:>0 status:active";
  if (rs?.brand_filter) qStr += ` vendor:${rs.brand_filter}`;

  let cursor: string | null = null;
  let pages = 0;
  let added = 0;
  let requeued = 0;
  let seen = 0;

  while (pages < MAX_PAGES) {
    const data: any = await shopifyGql(PRODUCT_LIST_QUERY, { q: qStr, cursor });
    const conn = data.products;
    const unenriched = conn.nodes.filter((p: any) => !p.normen?.value);
    seen += conn.nodes.length;

    if (unenriched.length) {
      const rows = unenriched.map((p: any) => ({
        id: p.id, title: p.title, vendor: p.vendor, total_inventory: p.totalInventory, status: "pending",
      }));
      // Neue Produkte einfügen (vorhandene unberührt lassen)
      const { error: insErr, count } = await supabase
        .from("products_queue")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
      if (!insErr && count) added += count;

      // 'done'-Einträge, deren normen wieder leer ist, neu in die Queue
      const ids = unenriched.map((p: any) => p.id);
      const { count: reqCount } = await supabase
        .from("products_queue")
        .update({ status: "pending", error: null }, { count: "exact" })
        .in("id", ids)
        .eq("status", "done");
      if (reqCount) requeued += reqCount;
    }

    pages++;
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return json({ scanned: seen, added, requeued, pages, capped: pages >= MAX_PAGES });
});
