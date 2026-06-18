-- ============================================================================
-- Cron-Steuerung (pg_cron + pg_net) — Abschnitt 4 (Batch-Architektur)
--
-- Voraussetzung: Extensions aktiviert (im Supabase-Dashboard unter Database >
-- Extensions: pg_cron, pg_net). Projekt-URL + Service-Role-Key liegen im Vault:
--
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',        'service_role_key');
--
-- (Anleitung im README.) Der Service-Role-Key bleibt im Vault — NICHT im Code.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Tages-Credit-Zähler zurücksetzen, wenn ein neuer Tag begonnen hat
create or replace function public.reset_credits_if_new_day()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.run_state
     set credits_used_today = 0, credits_day = current_date
   where id = 1 and credits_day <> current_date;
end $$;

-- Generischer Aufruf einer Edge Function über den Vault (kein Secret im Code)
create or replace function public.call_edge_function(fn text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare
  base text;
  key  text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key  from vault.decrypted_secrets where name = 'service_role_key';
  if base is null or key is null then
    raise notice 'call_edge_function: project_url/service_role_key fehlen im Vault';
    return;
  end if;
  perform net.http_post(
    url     := base || '/functions/v1/' || fn,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || key),
    body    := '{}'::jsonb
  );
end $$;

-- Enrich-Tick: nur feuern, wenn der Loop laufen darf (Abschnitt 4-Bedingung)
create or replace function public.enrich_tick()
returns void language plpgsql security definer set search_path = public as $$
declare r public.run_state;
begin
  perform public.reset_credits_if_new_day();
  select * into r from public.run_state where id = 1;
  if r.is_running and not r.paused and r.credits_used_today < r.max_credits_per_day then
    perform public.call_edge_function('enrich-batch');
  end if;
end $$;

-- Vorhandene Jobs gleichen Namens entfernen (idempotent re-runnable)
do $$ begin
  perform cron.unschedule('workxperts-enrich-loop');
exception when others then null; end $$;
do $$ begin
  perform cron.unschedule('workxperts-discover-new');
exception when others then null; end $$;

-- enrich-batch alle 3 Minuten (gehäppchent, wiederaufnehmbar)
select cron.schedule('workxperts-enrich-loop', '*/3 * * * *', $$ select public.enrich_tick(); $$);

-- discover-new 1×/Stunde (Dauerbetrieb für neue Produkte)
select cron.schedule('workxperts-discover-new', '0 * * * *', $$ select public.call_edge_function('discover-new'); $$);
