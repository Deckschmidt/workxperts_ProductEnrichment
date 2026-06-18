import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ProductStatus } from "../lib/types";

const STATUSES: ProductStatus[] = ["pending", "processing", "gold", "manual", "error", "done", "skipped"];

export type QueueStats = Record<ProductStatus, number> & { total: number };

export function useQueueStats(pollMs = 10000) {
  const [stats, setStats] = useState<QueueStats | null>(null);

  const load = useCallback(async () => {
    const entries = await Promise.all(
      STATUSES.map(async (s) => {
        const { count } = await supabase
          .from("products_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", s);
        return [s, count ?? 0] as const;
      }),
    );
    const obj = Object.fromEntries(entries) as Record<ProductStatus, number>;
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    setStats({ ...obj, total });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { stats, reload: load };
}
