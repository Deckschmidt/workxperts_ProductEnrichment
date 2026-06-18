-- ============================================================================
-- workXperts Anreicherungs-App — Datenmodell
-- Abschnitt 3 des Übergabe-Prompts.
-- ============================================================================

-- Status-Enum für die Produkt-Queue
do $$ begin
  create type product_status as enum
    ('pending','processing','gold','manual','error','done','skipped');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- products_queue: Arbeitsvorrat. id = Shopify-Produkt-GID.
-- ----------------------------------------------------------------------------
create table if not exists public.products_queue (
  id              text primary key,                 -- shopify gid (gid://shopify/Product/...)
  title           text,
  vendor          text,
  status          product_status not null default 'pending',
  total_inventory integer,
  last_attempt_at timestamptz,
  attempts        integer not null default 0,
  asx_url         text,
  matched_ean     text,
  class_change    text,                             -- z.B. "S2->S3"
  flags           text[]   not null default '{}',
  fields_written  text[]   not null default '{}',
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_queue_status_idx on public.products_queue (status);
create index if not exists products_queue_vendor_idx on public.products_queue (vendor);

-- ----------------------------------------------------------------------------
-- audit_log: jede Aktion (GOLD/MANUAL/ERROR) mit vollem Payload.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  product_id  text,
  title       text,
  action      text,                                 -- z.B. 'enrich'
  result      text,                                 -- GOLD | MANUAL | ERROR | SKIPPED
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_product_idx on public.audit_log (product_id);
create index if not exists audit_log_created_idx  on public.audit_log (created_at desc);

-- ----------------------------------------------------------------------------
-- manual_review: strittige/unklare Fälle (Produkt läuft trotzdem weiter).
-- ----------------------------------------------------------------------------
create table if not exists public.manual_review (
  id          bigint generated always as identity primary key,
  product_id  text,
  title       text,
  reason      text,
  details     text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists manual_review_resolved_idx on public.manual_review (resolved);

-- ----------------------------------------------------------------------------
-- run_state: Singleton-Steuertabelle für den Loop.
-- ----------------------------------------------------------------------------
create table if not exists public.run_state (
  id                  integer primary key default 1,
  is_running          boolean not null default false,
  dry_run             boolean not null default true,   -- Sicherheits-Default!
  batch_size          integer not null default 15,
  brand_filter        text,                            -- nullable: null = alle Marken
  max_credits_per_day integer not null default 6000,
  credits_used_today  integer not null default 0,
  credits_day         date    not null default current_date,
  paused              boolean not null default false,
  updated_at          timestamptz not null default now(),
  constraint run_state_singleton check (id = 1)
);
insert into public.run_state (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- settings: NUR nicht-geheime Konfiguration. KEINE Tokens.
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- asx_scrape_cache: Firecrawl-Scrapes cachen (spart Credits bei Re-Runs).
-- ----------------------------------------------------------------------------
create table if not exists public.asx_scrape_cache (
  url         text primary key,
  specs       jsonb,
  http_ok     boolean,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_products_queue_touch on public.products_queue;
create trigger trg_products_queue_touch before update on public.products_queue
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_run_state_touch on public.run_state;
create trigger trg_run_state_touch before update on public.run_state
  for each row execute function public.touch_updated_at();
