import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RunState } from "../lib/types";

// Lädt run_state und hält es per Realtime + Polling aktuell.
export function useRunState() {
  const [runState, setRunState] = useState<RunState | null>(null);

  async function load() {
    const { data } = await supabase.from("run_state").select("*").eq("id", 1).maybeSingle();
    if (data) setRunState(data as RunState);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("run_state_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "run_state" }, (payload) => {
        setRunState(payload.new as RunState);
      })
      .subscribe();
    const poll = setInterval(load, 15000); // Fallback, falls Realtime aus ist
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  return { runState, reload: load };
}
