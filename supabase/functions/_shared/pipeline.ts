// ============================================================================
// Anreicherungs-Pipeline pro Produkt — Port von process() aus pipeline.py
// (Abschnitt 5). Reihenfolge: Kandidaten -> EAN-Gate -> Harmonisieren ->
// Schreibset -> Schreiben -> Audit. Logik unverändert übernommen.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AsxSpecs, MetafieldTuple, ProcessResult, ShopifyProduct } from "./types.ts";
import { fcMap, fcScrape, type CreditTracker } from "./firecrawl.ts";
import { productBarcodes, writeProduct } from "./shopify.ts";
import { audit, reviewRow } from "./db.ts";
import {
  canonCap, canonClass, canonColor, canonNorms, canonRutsch, canonWeiteFromTitle,
  deriveDurchtritt, deriveSearchTerms,
} from "./canon.ts";
import { buildBody, buildBullets, buildSeo, buildUsp, richBullets } from "./templates.ts";

// EAN-Gate: scrape Kandidaten, finde den, dessen displayed_ean in unseren Barcodes liegt.
async function eanGate(
  supabase: SupabaseClient,
  product: ShopifyProduct,
  candidateUrls: string[],
  credits: CreditTracker,
): Promise<[AsxSpecs | null, string | null]> {
  const bc = productBarcodes(product);
  for (const u of candidateUrls) {
    const specs = await fcScrape(supabase, u, credits);
    if (!specs._http_ok) continue;
    const ean = (specs.displayed_ean || "").trim().replace(/\s/g, "");
    if (ean && bc.has(ean)) return [specs, u];
  }
  return [null, null];
}

export async function processProduct(
  supabase: SupabaseClient,
  product: ShopifyProduct,
  commit: boolean,
  credits: CreditTracker,
): Promise<ProcessResult> {
  const pid = product.id;
  const title = product.title;
  const brand = (product.vendor || "Atlas").trim();
  const brandTok = brand.toLowerCase().split(/\s+/)[0];
  const modell = deriveSearchTerms(title).replace(new RegExp(brand, "i"), "").trim() || title;

  // 1) Kandidaten via Map (marken-gefiltert auf asx-URL-Konvention /<brand>-)
  let cands = await fcMap(deriveSearchTerms(title));
  cands = cands.filter((u) => (brandTok ? u.toLowerCase().includes(brandTok) : true)).slice(0, 12);
  if (cands.length === 0) {
    await reviewRow(supabase, pid, title, "kein asx-Kandidat (Map leer)");
    await audit(supabase, { product_id: pid, title, result: "MANUAL", payload: { reason: "no_candidate" } });
    return { status: "manual", flags: [], fieldsWritten: [], reviewReason: "kein asx-Kandidat (Map leer)" };
  }

  // 2) EAN-Gate
  const [specs, url] = await eanGate(supabase, product, cands, credits);
  if (!specs) {
    await reviewRow(supabase, pid, title, "kein EAN-Treffer (falsche Weite/Generation oder nicht bei asx)");
    await audit(supabase, { product_id: pid, title, result: "MANUAL", payload: { reason: "no_ean", candidates: cands } });
    return {
      status: "manual", flags: [], fieldsWritten: [],
      reviewReason: "kein EAN-Treffer (falsche Weite/Generation oder nicht bei asx)",
    };
  }

  // 3) Harmonisieren
  const esdFlag =
    (specs.esd || "").toLowerCase().includes("ja") ||
    (specs.normen || []).some((n) => (n || "").toLowerCase().includes("esd"));
  const klasseAsx = canonClass(specs.klasse);
  const norms = canonNorms(specs.normen, esdFlag);
  const kappe = canonCap(specs.schutzkappe);
  const durch = deriveDurchtritt(klasseAsx, specs.durchtrittschutz);
  const rutsch = canonRutsch(specs.rutschhemmung, norms);
  const weite = canonWeiteFromTitle(title);
  const farbe = canonColor(specs.farbe);
  const laufsohle = (specs.laufsohle || "").trim() || null;
  const innenfutter = (specs.innenfutter || "").trim() || null;
  const obermaterial = (specs.obermaterial || "").trim() || null;

  // 4) Schreibset (Spec = fill-empty; Schutzklasse = asx gewinnt; Präsentation = regenerieren)
  const mf: MetafieldTuple[] = [];
  const cur = (k: keyof ShopifyProduct) => (product[k] as { value?: string } | null | undefined)?.value;
  const flags: string[] = [];
  let classChange: string | null = null;

  // Schutzklasse: asx gewinnt automatisch (auch überschreibend), nur bei valider Klasse
  if (klasseAsx) {
    if (cur("schutzklasse") !== klasseAsx) classChange = `${cur("schutzklasse") ?? ""}->${klasseAsx}`;
    mf.push(["global", "Schutzklasse", "single_line_text_field", klasseAsx]);
  }
  // Spec-Felder global.* nur in Leerfelder
  if (!cur("obermaterial") && obermaterial) mf.push(["global", "Obermaterial", "single_line_text_field", obermaterial]);
  if (!cur("innenfutter") && innenfutter) mf.push(["global", "Innenfutter", "single_line_text_field", innenfutter]);
  if (!cur("laufsohle") && laufsohle) mf.push(["global", "Laufsohle", "single_line_text_field", laufsohle]);
  if (!cur("farbe") && farbe) mf.push(["global", "Farbe", "single_line_text_field", farbe]);
  // custom-Specs nur in Leerfelder
  if (!cur("schutzkappe") && kappe) mf.push(["custom", "schutzkappe", "single_line_text_field", kappe]);
  if (!cur("durchtritt") && durch) mf.push(["custom", "durchtrittschutz", "single_line_text_field", durch]);
  if (!cur("rutsch") && rutsch) mf.push(["custom", "rutschhemmung", "single_line_text_field", rutsch]);
  if (!cur("weite")) mf.push(["custom", "weite", "single_line_text_field", weite]);
  // Normen (custom.normen list) — fill-empty
  if (!cur("normen") && norms.length) {
    mf.push(["custom", "normen", "list.single_line_text_field", JSON.stringify(norms)]);
  }

  // unklare Kappe -> Review-Notiz (Feld bleibt leer, Produkt läuft weiter)
  if (!kappe && specs.schutzkappe) {
    flags.push("Schutzkappe unklar");
    await reviewRow(supabase, pid, title, "Schutzkappe unklar", specs.schutzkappe || "");
  }

  // 5) Präsentation regenerieren
  const norm0 = norms.length ? norms[0] : null;
  const usp = buildUsp(klasseAsx, kappe, durch, esdFlag);
  const bullets = buildBullets(klasseAsx, norm0, kappe, durch, laufsohle, rutsch, obermaterial, esdFlag, innenfutter);
  mf.push(["custom", "kurz_usp", "single_line_text_field", usp]);
  mf.push(["custom", "bulletpoints_rich", "rich_text_field", richBullets(bullets)]);
  const body = buildBody(brand, modell, klasseAsx, norms, kappe, durch, laufsohle, rutsch, obermaterial, innenfutter, esdFlag, usp);
  const [seoT, seoD] = buildSeo(brand, modell, klasseAsx, kappe, durch, esdFlag, rutsch);

  // 6) Schreiben
  const res = await writeProduct(pid, mf, body, seoT, seoD, commit);
  const fieldsWritten = mf.map(([ns, k]) => `${ns}.${k}`);
  await audit(supabase, {
    product_id: pid, title, result: "GOLD",
    payload: {
      asx_url: url, ean: specs.displayed_ean, klasse: klasseAsx, class_change: classChange,
      flags, fields: fieldsWritten, commit, write_result: res,
      // Vorschau der generierten Präsentation (fürs Cockpit, auch im Dry-Run)
      preview: { body, bullets, usp, seo_title: seoT, seo_desc: seoD },
    },
  });

  return {
    status: "gold", asxUrl: url, ean: specs.displayed_ean || null, klasse: klasseAsx, classChange,
    flags, fieldsWritten,
    preview: { body, bullets, usp, seoTitle: seoT, seoDesc: seoD, metafields: mf },
  };
}
