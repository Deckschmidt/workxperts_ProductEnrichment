# workXperts Produktdaten-Anreicherung

Automatisierte Anreicherung der Shopify-Produktdaten von **workxperts.de** aus **asx.eu**
(EAN-gesichert) mit Cockpit-Oberfläche. Lovable-kompatibel: **React + Vite + TypeScript +
Tailwind** (Frontend) und **Supabase** (Postgres, Edge Functions, pg_cron) im Backend.

> **Sicherheit zuerst:** Die App startet immer im **Trockenlauf** (`dry_run = true`) und
> schreibt NICHTS an Shopify, bis ein Admin im Cockpit „LIVE schreiben" aktiviert.
> Alle Tokens liegen ausschließlich in **Supabase Secrets** — niemals im Code/Frontend.

---

## Inhalt
1. [Was die App tut](#1-was-die-app-tut)
2. [Architektur in einem Bild](#2-architektur)
3. [Setup-Schritt 1: Supabase-Projekt](#3-setup-schritt-1--supabase-projekt-anlegen)
4. [Setup-Schritt 2: Shopify-Custom-App + Token](#4-setup-schritt-2--shopify-custom-app--token)
5. [Setup-Schritt 3: Secrets setzen](#5-setup-schritt-3--secrets-in-supabase-setzen)
6. [Setup-Schritt 4: Datenbank + Functions deployen](#6-setup-schritt-4--datenbank--functions-deployen)
7. [Setup-Schritt 5: Cron aktivieren](#7-setup-schritt-5--cron-aktivieren-vault)
8. [Setup-Schritt 6: Frontend + erster Admin](#8-setup-schritt-6--frontend-starten--ersten-admin-festlegen)
9. [Betrieb: Trockenlauf → Live](#9-betrieb--erst-trockenlauf-dann-live)
10. [Import in Lovable](#10-import-in-lovable-weg-a--github)
11. [Wie du künftig per Lovable-Prompt änderst](#11-künftig-per-lovable-prompt-ändern)
12. [Fachliche Regeln (Kurzfassung)](#12-fachliche-regeln-kurzfassung)

---

## 1. Was die App tut

Pro Produkt (nur **Bestand > 0**, noch nicht angereichert):
1. **Kandidaten finden** — Firecrawl `map` auf asx.eu mit Suchbegriffen aus dem Titel.
2. **EAN-Gate** — Kandidaten scrapen; nur wenn die asx-EAN in unserer Varianten-Barcode-Menge
   liegt → **GOLD**. Kein Treffer → **Manuell-Liste** (kein Raten, Produkt wird nicht blockiert).
3. **Harmonisieren** (Normen/Klasse/Kappe/Durchtritt/Rutsch/Weite/Farbe) + Plausibilitäts-Layer.
4. **Schreiben** via Shopify Admin GraphQL: Specs `global.*` nur in Leerfelder,
   **Schutzklasse = asx gewinnt** (auch überschreibend), Präsentation (Body, Bullets, USP, SEO)
   regeneriert.
5. **Audit** jeder Aktion; strittige Felder landen in der Manuell-Liste.

Zwei Betriebsarten: **Einmal-Aufräumen** (~5.000 Bestandsprodukte) und **Dauerbetrieb**
(neue Produkte werden stündlich automatisch erkannt).

---

## 2. Architektur

```
Frontend (Cockpit, React/Vite)  ──ruft nur──▶  Supabase Edge Functions
   Login · Dashboard · Manuell · Audit · Detail        │
                                                        ▼
   Postgres  ◀── pg_cron alle 3 Min ──  enrich-batch (15 Produkte/Lauf)
   products_queue · audit_log ·         discover-new  (1×/Std, neue Produkte)
   manual_review · run_state ·          backfill-queue (Initial-Import)
   settings · asx_scrape_cache          run-control    (Admin-Steuerung)
                                                        │
                          Firecrawl (asx.eu) ◀──────────┤──────────▶ Shopify Admin API
```

Edge Functions haben ein Zeitlimit → der 5.000er-Lauf läuft **gehäppchent per Cron**
(Batch-Architektur, jederzeit wiederaufnehmbar — der Fortschritt steht in der DB).

---

## 3. Setup-Schritt 1 — Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) einloggen → **New Project** (Region EU, z. B. Frankfurt).
2. Projekt-Passwort vergeben und notieren.
3. Unter **Project Settings → API** findest du:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon public key** (für das Frontend, ist öffentlich)
   - **service_role key** (GEHEIM — nur fürs Backend/Cron, nie ins Frontend)

---

## 4. Setup-Schritt 2 — Shopify-Custom-App + Token

> Als Mitarbeiter brauchst du dafür ggf. einmalig den Shop-Inhaber (Admin-Rechte). Danach nie wieder.

1. Shopify-Admin → **Einstellungen → Apps und Vertriebskanäle → Apps entwickeln**.
2. Falls nötig „Entwicklung benutzerdefinierter Apps erlauben" aktivieren.
3. **App erstellen** → Name z. B. „workXperts Enrichment".
4. **Admin API-Integration konfigurieren** → folgende Scopes setzen:
   - `read_products`, `write_products`, `read_inventory`, `read_orders`
5. **Installieren** → unter **API-Zugangsdaten** das **Admin API Access Token** kopieren
   (beginnt mit `shpat_…`). Es wird nur EINMAL angezeigt — sicher notieren.
6. Notiere außerdem die Backend-Domain `<store>.myshopify.com` (NICHT die Custom-Domain
   workxperts.de).

---

## 5. Setup-Schritt 3 — Secrets in Supabase setzen

Im Supabase-Dashboard: **Project Settings → Edge Functions → Secrets** (oder per CLI
`supabase secrets set …`). Folgende Werte hinterlegen:

| Secret | Wert |
|---|---|
| `SHOPIFY_ADMIN_HOST` | `workxperts.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_…` (aus Schritt 4) |
| `SHOPIFY_API_VERSION` | `2025-07` |
| `FIRECRAWL_API_KEY` | `fc-…` (aus deinem Firecrawl-Dashboard) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase für Edge
Functions **automatisch** — nicht selbst eintragen.

> Diese Secrets liegen NUR hier. Im Repo / `.env` stehen ausschließlich Platzhalter.

---

## 6. Setup-Schritt 4 — Datenbank + Functions deployen

**Variante A (einfach, im Browser):**
- **Datenbank:** Supabase-Dashboard → **SQL Editor** → die drei Dateien aus
  `supabase/migrations/` der Reihe nach (0001 → 0002 → 0003) einfügen und „Run".
- **Edge Functions:** Dashboard → **Edge Functions** → für jede der vier Functions
  (`enrich-batch`, `discover-new`, `backfill-queue`, `run-control`) den Code aus
  `supabase/functions/<name>/index.ts` einfügen und deployen.

**Variante B (Supabase CLI, falls vorhanden):**
```bash
supabase link --project-ref <ref>
supabase db push                       # spielt die Migrationen ein
supabase functions deploy enrich-batch discover-new backfill-queue run-control
```

> In Lovable übernimmt der Lovable-/Supabase-Connector das Deployen der `supabase/`-Dateien
> meist automatisch — siehe Schritt 10.

---

## 7. Setup-Schritt 5 — Cron aktivieren (Vault)

Damit `pg_cron` die Edge Functions aufrufen kann, müssen Projekt-URL und Service-Role-Key
im **Vault** liegen (so steht der geheime Key NICHT im Code). Im **SQL Editor** ausführen:

```sql
-- Extensions (falls 0003 sie nicht schon aktiviert hat)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Geheimnisse in den Vault legen (Werte einsetzen!)
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>',        'service_role_key');
```

Migration `0003_cron.sql` legt dann die beiden Cron-Jobs an:
- `workxperts-enrich-loop` — alle 3 Min `enrich-batch` (nur wenn der Loop laufen darf).
- `workxperts-discover-new` — stündlich neue Produkte einsammeln.

Prüfen: `select * from cron.job;`

---

## 8. Setup-Schritt 6 — Frontend starten & ersten Admin festlegen

1. Frontend-Env setzen (`.env` aus `.env.example`):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
2. In Lovable läuft das Frontend automatisch. Lokal: `npm install && npm run dev`.
3. Im Cockpit **registrieren** (E-Mail/Passwort). Neue Nutzer sind automatisch **viewer**.
4. **Ersten Admin freischalten** — im Supabase SQL Editor:
   ```sql
   update public.user_roles set role = 'admin'
   where user_id = (select id from auth.users where email = 'DEINE@mail.de');
   ```
   Danach im Cockpit neu laden — du hast jetzt die Steuerungsrechte.

---

## 9. Betrieb — erst Trockenlauf, dann Live

1. **Queue füllen:** Dashboard → „Backfill (Initial-Import)". Bei ~5.000 Produkten ggf.
   mehrmals klicken (er arbeitet in Blöcken und merkt sich den Fortschritt).
   Optional vorher einen **Marken-Filter** (z. B. `Atlas`) setzen, um klein anzufangen.
2. **Trockenlauf:** `dry_run` bleibt aktiv (rotes/grünes Banner beachten — grün = sicher).
   „1 Batch jetzt (Test)" klicken → unter **Audit** die Ergebnisse + unter **Produkt-Detail**
   die generierten Inhalte (Body/Bullets/USP/SEO) prüfen. Es wird nichts geschrieben.
3. **Stichprobe ok?** Dann „Loop starten" — der Cron arbeitet die Queue gehäppchent ab
   (immer noch Dry-Run).
4. **Scharf schalten:** Wenn die Trockenlauf-Stichprobe passt → „LIVE schreiben aktivieren"
   (mit Sicherheitsabfrage). Ab jetzt gehen echte Schreibzugriffe an Shopify. Das Banner
   wird **rot**.
5. **Manuell-Liste** abarbeiten: strittige Fälle (kein EAN-Treffer, unklare Kappe …) prüfen
   und auf „Erledigt" setzen.

**Empfehlung:** Vor dem ersten Live-Lauf einen Matrixify-Produkt-Export als Backup ziehen.

---

## 10. Import in Lovable (Weg A — GitHub)

Lovable kann kein beliebiges Repo nativ importieren; der verlässliche Weg führt über das von
Lovable angelegte GitHub-Repo:

1. In Lovable **New Project** → **Connect to GitHub** und das Repo
   `Deckschmidt/workxperts_ProductEnrichment` verbinden (bzw. Lovables Repo anlegen und diesen
   Code hineinpushen — der eine Git-Befehl dafür wird dir separat genannt).
2. Lovable behandelt das GitHub-Repo als „source of truth". Dein Code überschreibt das
   Starter-Gerüst.
3. **Secrets kommen NICHT mit.** Trage die Edge-Function-Secrets (Schritt 5) im
   Supabase-Panel ein und die zwei `VITE_*`-Werte als Frontend-Env in Lovable.

> Alternative (Weg B): Lovable stellt sich unter `https://mcp.lovable.dev` als MCP-Server
> bereit; damit ließe sich das Projekt direkt anlegen/iterieren (kostet Lovable-Credits,
> braucht OAuth). Hier bewusst nicht genutzt.

---

## 11. Künftig per Lovable-Prompt ändern

Du pflegst alles als Nicht-Entwickler über Lovables Chat. Beispiele:
- „Mach die Bulletpoints kürzer (max. 60 Zeichen)." → ändert `templates.ts`.
- „Füge im Dashboard eine Spalte ‚Marke' zur Fortschrittsanzeige hinzu."
- „Lass discover-new alle 30 Minuten statt stündlich laufen." → ändert den Cron in `0003`.

Wichtig: Die **fachliche Logik** (EAN-Gate, Kanonisierung, Namespaces) ist in
`supabase/functions/_shared/` gekapselt — Änderungen dort betreffen die Schreib-Regeln,
also vorsichtig prompten und immer erst im Trockenlauf prüfen.

---

## 12. Fachliche Regeln (Kurzfassung)

Verbindliche Quellen: die mitgelieferten **Guidelines** (Stand 2026-06-17) und die
**Feld-Landkarte** [`docs/FELDKATALOG.md`](docs/FELDKATALOG.md) (echte Keys/Typen aus
workxperts.de, Stand 2026-06-18). Kernpunkte:
- **Schmaler Engine-Scope:** Die Engine schreibt NUR ihre eigenen ENRICH/Präsentations-/SEO-Felder
  (per Allow-List `enforceScope` erzwungen) und fasst Compliance (`simplecomply.*`/GPSR),
  Kanal-/Feed-Felder (Google/Zalando/Otto), Shopify-Taxonomie und Stammdaten **niemals** an.
- **Nur GOLD schreiben** (HTTP 200 + EAN-Identität bewiesen). Keine Halluzination.
- **Spec-Felder nur in Leerfelder.** Ausnahme **Schutzklasse**: asx gewinnt automatisch.
- **Präsentationsfelder** (Body, `custom.bulletpoints_rich`, `custom.kurz_usp`, native SEO)
  dürfen regeneriert werden.
- **Namespace-Disziplin:** Specs in `global.*`, Rest in `custom.*`. Tote Kleinbuchstaben-
  Dubletten **nie** beschreiben. `custom.lieferantenartikelnummer` NICHT mit asx-Nummern füllen.
- **Plausibilität** überschreibt asx bei innerem Widerspruch (S1/S2/SB → Durchtritt „Nein";
  Norm-Tippfehler → Kanon; unklare Kappe → leer + Review).
- **Nur Bestand > 0.** Bereits angereicherte (`custom.normen` gesetzt) werden übersprungen.

---

## Hinweis zur Bauzeit
Die fachliche Logik ist ein 1:1-Port der getesteten Python-Referenz `pipeline.py` nach
TypeScript/Deno (`supabase/functions/_shared/`). Eine eventuell während der Entwicklung
genutzte Shopify-MCP-Verbindung diente nur zum **Lesen von Beispielprodukten** — der
Produktivpfad ist ausschließlich der Shopify-Admin-Token im Backend.
