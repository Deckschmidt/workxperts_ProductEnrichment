// ============================================================================
// Supabase-Admin-Client + DB-Helfer für die Edge Functions.
// Nutzt die Service-Role (umgeht RLS) — läuft NUR serverseitig.
// ============================================================================
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function audit(
  supabase: SupabaseClient,
  rec: { product_id?: string; title?: string; action?: string; result?: string; payload?: unknown },
): Promise<void> {
  await supabase.from("audit_log").insert({
    product_id: rec.product_id ?? null,
    title: rec.title ?? null,
    action: rec.action ?? "enrich",
    result: rec.result ?? null,
    payload: rec.payload ?? null,
  });
}

export async function reviewRow(
  supabase: SupabaseClient,
  productId: string,
  title: string,
  reason: string,
  details = "",
): Promise<void> {
  await supabase.from("manual_review").insert({ product_id: productId, title, reason, details });
}

// CORS-Header für Frontend-Aufrufe der Edge Functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
