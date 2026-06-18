// ============================================================================
// Gemeinsame Typen für die Edge Functions.
// ============================================================================

// Aus Firecrawl gescrapte asx-Specs (Schema aus Abschnitt 6)
export interface AsxSpecs {
  displayed_ean?: string;
  artikelnummer?: string;
  klasse?: string;
  obermaterial?: string;
  innenfutter?: string;
  laufsohle?: string;
  schutzkappe?: string;
  durchtrittschutz?: string;
  rutschhemmung?: string;
  esd?: string;
  normen?: string[];
  farbe?: string;
  weite?: string;
  gewicht?: string;
  _http_ok?: boolean;
}

// Ein Metafeld-Schreibtupel: [namespace, key, type, value]
export type MetafieldTuple = [string, string, string, string];

// Shopify-Produkt mit den für die Pipeline relevanten Feldern (aus GraphQL)
export interface ShopifyProduct {
  id: string;
  title: string;
  status?: string;
  totalInventory?: number;
  vendor?: string;
  descriptionHtml?: string;
  seo?: { title?: string; description?: string };
  variants: { nodes: { barcode?: string | null }[] };
  // gemappte Metafelder (Alias-Keys aus der Query)
  schutzklasse?: { value?: string } | null;
  obermaterial?: { value?: string } | null;
  innenfutter?: { value?: string } | null;
  laufsohle?: { value?: string } | null;
  farbe?: { value?: string } | null;
  normen?: { value?: string } | null;
  schutzkappe?: { value?: string } | null;
  durchtritt?: { value?: string } | null;
  rutsch?: { value?: string } | null;
  weite?: { value?: string } | null;
}

// Ergebnis der Verarbeitung eines Produkts
export interface ProcessResult {
  status: "gold" | "manual" | "error";
  asxUrl?: string | null;
  ean?: string | null;
  klasse?: string | null;
  classChange?: string | null;
  flags: string[];
  fieldsWritten: string[];
  reviewReason?: string;
  error?: string;
  // Vorschau fürs Cockpit (Body/Bullets/USP/SEO) — auch im Dry-Run gefüllt
  preview?: {
    body?: string;
    bullets?: string[];
    usp?: string;
    seoTitle?: string;
    seoDesc?: string;
    metafields?: MetafieldTuple[];
  };
}
