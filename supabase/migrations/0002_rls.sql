-- ============================================================================
-- RLS & Rollen
-- Abschnitt 3 + 11: RLS aktiv. Frontend LIEST (authenticated). Alle SCHREIB-
-- zugriffe laufen über Edge Functions mit Service-Role (umgeht RLS). Rollen:
-- admin (darf live schreiben/Settings) & viewer (nur lesen) — serverseitig in
-- den Edge Functions geprüft (run-control).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_roles: Rollenzuordnung. Neue Nutzer bekommen automatisch 'viewer'.
-- Admin wird manuell gesetzt (siehe README).
-- ----------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

-- Neuen Auth-Nutzern automatisch eine viewer-Rolle anlegen
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: Rolle des aktuellen Nutzers
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'viewer');
$$;

-- ----------------------------------------------------------------------------
-- RLS aktivieren
-- ----------------------------------------------------------------------------
alter table public.products_queue   enable row level security;
alter table public.audit_log         enable row level security;
alter table public.manual_review     enable row level security;
alter table public.run_state         enable row level security;
alter table public.settings          enable row level security;
alter table public.asx_scrape_cache  enable row level security;
alter table public.user_roles        enable row level security;

-- ----------------------------------------------------------------------------
-- Lese-Policies: jeder eingeloggte Nutzer (admin + viewer) darf lesen.
-- Es gibt BEWUSST keine INSERT/UPDATE/DELETE-Policies für authenticated ->
-- Schreiben ist nur der Service-Role (Edge Functions) möglich, die RLS umgeht.
-- ----------------------------------------------------------------------------
create policy "read_queue"   on public.products_queue  for select to authenticated using (true);
create policy "read_audit"   on public.audit_log        for select to authenticated using (true);
create policy "read_manual"  on public.manual_review    for select to authenticated using (true);
create policy "read_run"     on public.run_state        for select to authenticated using (true);
create policy "read_settings"on public.settings         for select to authenticated using (true);
create policy "read_roles"   on public.user_roles       for select to authenticated using (user_id = auth.uid());
-- asx_scrape_cache: kein Lesezugriff fürs Frontend nötig (intern).
