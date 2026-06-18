// ============================================================================
// Kanonisierung / Harmonisierung — 1:1-Port aus pipeline.py (Abschnitt 7 + 8).
// Logik bewusst unverändert übernommen (verbindliche Vorlage).
// ============================================================================

// --- Normen-Kanon (Reihenfolge wichtig — erste Regel, die matcht, gewinnt) ---
const NORM_MAP: [RegExp, string][] = [
  [/en\s*iso\s*20345|en\s*20345|en\s*2045|en\s*345|en\s*iso\s*23045/i, "EN ISO 20345"],
  [/en\s*iso\s*20471|en\s*471/i, "EN ISO 20471"],
  [/en\s*iso\s*20349|en\s*20349/i, "EN ISO 20349"],
  [/en\s*61340|esd/i, "EN 61340"],
  [/dguv\s*112-?191|bgr\s*191|einlagen/i, "DGUV 112-191"],
];

export function canonNorms(norms: string[] | undefined, esdFlag: boolean): string[] {
  const out: string[] = [];
  const src = [...(norms || [])];
  if (esdFlag) src.push("ESD");
  for (const raw of src) {
    const low = (raw || "").toLowerCase();
    for (const [pat, canon] of NORM_MAP) {
      if (pat.test(low)) {
        if (!out.includes(canon)) out.push(canon);
        break;
      }
    }
  }
  return out;
}

export function canonClass(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/\b(S1P|S3S|S1|S2|S3|S4|S5|S6|S7|SB)\b/);
  return m ? m[1] : null;
}

export function canonCap(raw: string | undefined): string | null {
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (low.includes("alu")) return "Aluminium";
  if (low.includes("stahl") || low.includes("steel")) return "Stahl";
  if (low.includes("kunststoff") || low.includes("composite") || low.includes("metallfrei") || low.includes("kunstst"))
    return "Kunststoff";
  return null; // unklar -> leer (VERIFY)
}

export function deriveDurchtritt(klasse: string | null, raw: string | undefined): string | null {
  if (klasse && ["S1P", "S3", "S3S", "S4", "S5"].includes(klasse)) return "Ja";
  if (klasse && ["S1", "S2", "SB"].includes(klasse)) return "Nein"; // Plausibilität: P unmöglich
  const low = (raw || "").toLowerCase();
  if (["ja", "textil", "stahl", "xp", "carbon", "metallfrei"].some((k) => low.includes(k))) return "Ja";
  return null;
}

export function canonRutsch(raw: string | undefined, _norms: string[]): string | null {
  if (raw) {
    const m = raw.toUpperCase().match(/\b(SRC|SRB|SRA|SR)\b/);
    if (m) return m[1];
  }
  // 2022er Norm -> SR, sonst nichts erfinden
  return null;
}

export function canonWeiteFromTitle(title: string): string {
  const m = title.match(/\bW\s?(1[0-4])\b/i);
  if (m) return m[1];
  if (/\bweit\b/i.test(title)) return "Weit";
  if (/\bschmal\b/i.test(title)) return "Schmal";
  return "Normal";
}

export function canonColor(raw: string | undefined): string | null {
  if (!raw) return null;
  const low = raw.toLowerCase();
  const table: Record<string, string> = {
    schwarz: "Schwarz", black: "Schwarz", blau: "Blau", blue: "Blau", grau: "Grau", grey: "Grau",
    gray: "Grau", "grün": "Grün", gruen: "Grün", green: "Grün", rot: "Rot", red: "Rot",
    "weiß": "Weiß", weiss: "Weiß", white: "Weiß", braun: "Braun", brown: "Braun",
  };
  for (const [k, v] of Object.entries(table)) {
    if (low.includes(k)) return v;
  }
  const s = raw.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

// Geschlecht aus UNSEREM Titel (kanonisch: Herren/Damen/Unisex). Nur bei klarem
// Beleg im Titel; sonst null (fill-empty, nicht raten — Guidelines §5).
export function canonGeschlecht(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(herren|männer|herren|men)\b/.test(t)) return "Herren";
  if (/\b(damen|frauen|women)\b/.test(t)) return "Damen";
  if (/\bunisex\b/.test(t)) return "Unisex";
  return null;
}

// custom.din_norm (multi_line) = kanonische Normen als Anzeigetext (Legacy-Pendant
// zu custom.normen). Keine neue Logik — gleiche Normen, anderes Feld.
export function dinNormText(norms: string[]): string | null {
  return norms.length ? norms.join("\n") : null;
}

// Warnschutz/Hi-Vis: EN ISO 20471 IST die Warnschutz-Norm. true nur bei Beleg.
export function deriveWarnschutz(norms: string[]): boolean {
  return norms.some((n) => n.includes("EN ISO 20471"));
}

// Aus dem Produkttitel Suchbegriffe für asx-Map ableiten (Marke + Modell + Nummer)
export function deriveSearchTerms(title: string): string {
  let t = title.replace(
    /\b(EN ?ISO ?\d+|EN ?\d+|S1P|S3S|S1|S2|S3|S4|S5|SB|ESD|Sicherheitsschuhe?|Halbschuhe?|Klettst\.?)\b/gi,
    " ",
  );
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
