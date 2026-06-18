// Frontend-Typen (Spiegel der DB-Tabellen)

export type ProductStatus =
  | "pending" | "processing" | "gold" | "manual" | "error" | "done" | "skipped";

export interface RunState {
  id: number;
  is_running: boolean;
  dry_run: boolean;
  batch_size: number;
  brand_filter: string | null;
  max_credits_per_day: number;
  credits_used_today: number;
  credits_day: string;
  paused: boolean;
  updated_at: string;
}

export interface QueueRow {
  id: string;
  title: string | null;
  vendor: string | null;
  status: ProductStatus;
  total_inventory: number | null;
  attempts: number;
  asx_url: string | null;
  matched_ean: string | null;
  class_change: string | null;
  flags: string[];
  fields_written: string[];
  error: string | null;
  updated_at: string;
}

export interface ManualReviewRow {
  id: number;
  product_id: string | null;
  title: string | null;
  reason: string | null;
  details: string | null;
  resolved: boolean;
  created_at: string;
}

export interface AuditRow {
  id: number;
  product_id: string | null;
  title: string | null;
  action: string | null;
  result: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
