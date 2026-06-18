// ============================================================================
// Firecrawl-Client (asx.eu) — Port aus pipeline.py (Abschnitt 5 + 6).
// map = Kandidaten finden, scrape = JSON-Specs ziehen. Scrapes werden in der
// Tabelle asx_scrape_cache gecached (spart Credits bei Re-Runs).
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AsxSpecs } from "./types.ts";

const ASX_BASE = "https://www.asx.eu";
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const SCRAPE_SCHEMA = {
  type: "object",
  properties: {
    displayed_ean: { type: "string" },
    artikelnummer: { type: "string" },
    klasse: { type: "string" },
    obermaterial: { type: "string" },
    innenfutter: { type: "string" },
    laufsohle: { type: "string" },
    schutzkappe: { type: "string" },
    durchtrittschutz: { type: "string" },
    rutschhemmung: { type: "string" },
    esd: { type: "string" },
    normen: { type: "array", items: { type: "string" } },
    farbe: { type: "string" },
    weite: { type: "string" },
    gewicht: { type: "string" },
  },
};

const SCRAPE_PROMPT =
  "Extrahiere die technischen Daten dieses Sicherheitsschuhs/Textils: " +
  "die angezeigte EAN/GTIN (Basisgroesse), Artikelnummer, Schutzklasse (S1/S1P/S2/S3/S3S/S4/S5 etc.), " +
  "Obermaterial, Innenfutter/Futter, Laufsohle, Schutzkappe/Zehenkappe, Durchtrittschutz, " +
  "Rutschhemmung (SRA/SRB/SRC/SR), ESD (ja/nein), alle Normen (EN ISO ...), Farbe, Weite, Gewicht. " +
  "Lies auch den Block 'Spezifikationen' und den Beschreibungstext. Nichts erfinden – fehlende Felder leer lassen.";

// HTTP-POST mit Backoff (Firecrawl 429/5xx)
async function postJson(url: string, body: unknown, retries = 4): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if ([429, 502, 503].includes(r.status) && attempt < retries - 1) {
        await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
        continue;
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status} bei ${url}: ${t.slice(0, 300)}`);
      }
      return await r.json();
    } catch (e) {
      if (attempt < retries - 1) {
        await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function fcMap(search: string, limit = 200): Promise<string[]> {
  try {
    const resp = await postJson("https://api.firecrawl.dev/v2/map", {
      url: ASX_BASE,
      search,
      sitemap: "include",
      limit,
    });
    const links = resp.links || resp.data?.links || [];
    return links.map((l: any) => (typeof l === "string" ? l : l.url)).filter(Boolean);
  } catch (e) {
    console.log(`  [map-Fehler] ${search}: ${e}`);
    return [];
  }
}

export interface CreditTracker {
  used: number;
}

// Scrape mit DB-Cache. Erhöht credits.used bei echtem API-Call.
export async function fcScrape(
  supabase: SupabaseClient,
  url: string,
  credits: CreditTracker,
): Promise<AsxSpecs> {
  const { data: cached } = await supabase
    .from("asx_scrape_cache")
    .select("specs, http_ok")
    .eq("url", url)
    .maybeSingle();
  if (cached) {
    return { ...(cached.specs as AsxSpecs), _http_ok: cached.http_ok };
  }

  let specs: AsxSpecs;
  try {
    const resp = await postJson("https://api.firecrawl.dev/v2/scrape", {
      url,
      formats: [{ type: "json", prompt: SCRAPE_PROMPT, schema: SCRAPE_SCHEMA }],
      onlyMainContent: false,
      waitFor: 6000,
      proxy: "auto",
    }, 4);
    credits.used += 1;
    const d = resp.data || resp;
    const status = d.metadata?.statusCode ?? d.metadata?.status_code ?? null;
    specs = (d.json || {}) as AsxSpecs;
    specs._http_ok = status !== null ? status === 200 : Object.keys(specs).length > 0;
  } catch (e) {
    console.log(`  [scrape-Fehler] ${url}: ${e}`);
    specs = { _http_ok: false };
  }

  const { _http_ok, ...specsOnly } = specs;
  await supabase.from("asx_scrape_cache").upsert({ url, specs: specsOnly, http_ok: !!_http_ok });
  return specs;
}
