// Aufrufe der run-control Edge Function (admin-gesichert) + Status-Reads.
import { supabase } from "./supabaseClient";

async function callRunControl(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("run-control", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const api = {
  updateRunState: (patch: Record<string, unknown>) =>
    callRunControl({ action: "update_run_state", ...patch }),

  resolveReview: (id: number, resolved = true) =>
    callRunControl({ action: "resolve_review", id, resolved }),

  resetProduct: (id: string) =>
    callRunControl({ action: "reset_product", id }),

  trigger: (fn: "enrich-batch" | "discover-new" | "backfill-queue", payload: Record<string, unknown> = {}) =>
    callRunControl({ action: "trigger", fn, payload }),
};
