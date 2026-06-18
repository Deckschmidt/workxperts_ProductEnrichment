// ============================================================================
// Shopify Admin GraphQL — Port aus pipeline.py (Abschnitt 9).
// metafieldsSet (max 25/Call) + productUpdate. API-Version aus Secret.
// ============================================================================
import type { MetafieldTuple, ShopifyProduct } from "./types.ts";

const HOST = Deno.env.get("SHOPIFY_ADMIN_HOST") || "";
const TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN") || "";
const API_VER = Deno.env.get("SHOPIFY_API_VERSION") || "2025-07";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function shopifyGql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!HOST || !TOKEN) {
    throw new Error("SHOPIFY_ADMIN_HOST und SHOPIFY_ADMIN_TOKEN nötig (Supabase Secrets).");
  }
  const url = `https://${HOST}/admin/api/${API_VER}/graphql.json`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
      body: JSON.stringify({ query, variables }),
    });
    if ([429, 502, 503].includes(r.status) && attempt < 5) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const resp = await r.json();
    if (resp.errors && resp.errors.length) {
      const msg = JSON.stringify(resp.errors);
      if (msg.includes("THROTTLED") && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error(`Shopify GraphQL Fehler: ${msg.slice(0, 500)}`);
    }
    return resp.data as T;
  }
  throw new Error("Shopify GraphQL dauerhaft gedrosselt.");
}

// Vollständiges Produkt-Detail inkl. Varianten-Barcodes + aktuelle Metafelder.
// (Wird in enrich-batch pro Queue-Eintrag frisch geholt.)
export const PRODUCT_DETAIL_QUERY = `
query($id:ID!){
  product(id:$id){
    id title status totalInventory vendor descriptionHtml
    seo{ title description }
    variants(first:100){ nodes{ barcode } }
    schutzklasse: metafield(namespace:"global",key:"Schutzklasse"){ value }
    obermaterial: metafield(namespace:"global",key:"Obermaterial"){ value }
    innenfutter:  metafield(namespace:"global",key:"Innenfutter"){ value }
    laufsohle:    metafield(namespace:"global",key:"Laufsohle"){ value }
    farbe:        metafield(namespace:"global",key:"Farbe"){ value }
    normen:       metafield(namespace:"custom",key:"normen"){ value }
    schutzkappe:  metafield(namespace:"custom",key:"schutzkappe"){ value }
    durchtritt:   metafield(namespace:"custom",key:"durchtrittschutz"){ value }
    rutsch:       metafield(namespace:"custom",key:"rutschhemmung"){ value }
    weite:        metafield(namespace:"custom",key:"weite"){ value }
  }
}`;

// Leichtere Liste für discover-new / backfill-queue.
export const PRODUCT_LIST_QUERY = `
query($q:String!, $cursor:String){
  products(first:50, query:$q, after:$cursor){
    pageInfo{ hasNextPage endCursor }
    nodes{
      id title vendor status totalInventory
      normen: metafield(namespace:"custom",key:"normen"){ value }
    }
  }
}`;

export async function fetchProductDetail(gid: string): Promise<ShopifyProduct | null> {
  const data = await shopifyGql<{ product: ShopifyProduct | null }>(PRODUCT_DETAIL_QUERY, { id: gid });
  return data.product;
}

export function productBarcodes(p: ShopifyProduct): Set<string> {
  return new Set(
    p.variants.nodes.map((v) => v.barcode).filter((b): b is string => !!b),
  );
}

const METAFIELDS_SET = `
mutation($mf:[MetafieldsSetInput!]!){
  metafieldsSet(metafields:$mf){ userErrors{ field message } }
}`;

const PRODUCT_UPDATE = `
mutation($input:ProductInput!){
  productUpdate(input:$input){ userErrors{ field message } }
}`;

// Schreibt Metafelder + Body/SEO. Nur wenn commit=true (sonst Dry-Run).
export async function writeProduct(
  pid: string,
  metafields: MetafieldTuple[],
  bodyHtml: string | null,
  seoTitle: string | null,
  seoDesc: string | null,
  commit: boolean,
): Promise<Record<string, unknown>> {
  if (!commit) return { dry_run: true };
  const results: Record<string, unknown> = {};

  if (metafields.length) {
    const mfin = metafields.map(([ns, k, t, v]) => ({ ownerId: pid, namespace: ns, key: k, type: t, value: v }));
    for (let i = 0; i < mfin.length; i += 25) {
      const d = await shopifyGql<{ metafieldsSet: { userErrors: unknown[] } }>(METAFIELDS_SET, {
        mf: mfin.slice(i, i + 25),
      });
      const errs = d.metafieldsSet.userErrors;
      if (errs.length) {
        const acc = (results.metafield_errors as unknown[]) || [];
        acc.push(...errs);
        results.metafield_errors = acc;
      }
      await sleep(400);
    }
  }

  const pin: Record<string, unknown> = { id: pid };
  if (bodyHtml !== null) pin.descriptionHtml = bodyHtml;
  if (seoTitle !== null || seoDesc !== null) pin.seo = { title: seoTitle, description: seoDesc };
  const d = await shopifyGql<{ productUpdate: { userErrors: unknown[] } }>(PRODUCT_UPDATE, { input: pin });
  if (d.productUpdate.userErrors.length) results.product_errors = d.productUpdate.userErrors;
  await sleep(400);
  return results;
}
