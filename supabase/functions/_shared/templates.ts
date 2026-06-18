// ============================================================================
// Content-Templating (Body / Bullets / USP / SEO) — 1:1-Port aus pipeline.py
// (Abschnitt 10). Faktenbasiert, KEINE erfundene Konformität. Kein Shopify Magic.
// ============================================================================

// Shopify Rich-Text-JSON (valide Struktur, NICHT HTML) für custom.bulletpoints_rich
export function richBullets(items: string[]): string {
  return JSON.stringify({
    type: "root",
    children: [
      {
        type: "list",
        listType: "unordered",
        children: items
          .filter(Boolean)
          .map((it) => ({ type: "list-item", children: [{ type: "text", value: it }] })),
      },
    ],
  });
}

export function clip(s: string, n: number): string {
  s = s.trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return i > 0 ? cut.slice(0, i) : cut;
}

export function buildUsp(
  klasse: string | null,
  kappe: string | null,
  durchtritt: string | null,
  esd: boolean,
): string {
  const parts: string[] = [];
  if (kappe) parts.push(kappe.endsWith("kappe") ? kappe : `${kappe}kappe`);
  if (durchtritt === "Ja") parts.push("Durchtrittschutz");
  if (esd) parts.push("ESD-Schutz");
  let feat = "";
  if (parts.length > 1) feat = parts.slice(0, -1).join(", ") + " und " + parts[parts.length - 1];
  else if (parts.length === 1) feat = parts[0];
  const kl = klasse ? `${klasse}-` : "";
  return `Robuster ${kl}Sicherheitsschuh mit ${feat} – zuverlässige Sicherheit bei hohem Tragekomfort.`;
}

export function buildBullets(
  klasse: string | null,
  norm0: string | null,
  kappe: string | null,
  durchtritt: string | null,
  laufsohle: string | null,
  rutsch: string | null,
  obermaterial: string | null,
  esd: boolean,
  innenfutter: string | null,
): string[] {
  const b: string[] = [];
  if (klasse && norm0) b.push(`Schutzklasse ${klasse} nach ${norm0} für anspruchsvolle Arbeit`);
  if (kappe) {
    const s = kappe.toLowerCase().endsWith("kappe") ? kappe : `${kappe}kappe`;
    b.push(s + (durchtritt === "Ja" ? " und durchtrittsichere Sohle" : ""));
  }
  if (laufsohle) b.push(clip(`Laufsohle: ${laufsohle}` + (rutsch ? ` (${rutsch})` : ""), 78));
  if (obermaterial) b.push(clip(`Obermaterial aus ${obermaterial}`, 78));
  if (esd) b.push("ESD-fähig nach EN 61340 für elektrostatisch sichere Bereiche");
  else if (innenfutter) b.push(clip(`Innenfutter: ${innenfutter}`, 78));
  return b.slice(0, 5);
}

export function buildBody(
  brand: string,
  modell: string,
  klasse: string | null,
  norms: string[],
  kappe: string | null,
  durchtritt: string | null,
  laufsohle: string | null,
  rutsch: string | null,
  obermaterial: string | null,
  innenfutter: string | null,
  esd: boolean,
  usp: string,
): string {
  const normTxt = norms.length ? norms.join(", ") : "den einschlägigen EN-Normen";
  let schutz = klasse ? `Zertifizierungsstufe ${klasse} nach ${norms[0] || "EN ISO 20345"}.` : "";
  if (kappe) schutz += ` Eine ${kappe}kappe schützt die Zehen.`;
  if (durchtritt === "Ja") schutz += " Eine durchtrittsichere Sohle sichert gegen spitze Gegenstände.";
  if (esd) schutz += " ESD-fähig nach EN 61340.";
  if (rutsch) schutz += ` Rutschhemmung nach ${rutsch}.`;
  let komfort = "Auf Tragekomfort fuer lange Arbeitstage ausgelegt.";
  if (innenfutter) komfort = `Das ${innenfutter} sorgt fuer ein angenehmes Fussklima ueber lange Arbeitstage.`;
  let material = "Hochwertige, strapazierfaehige Materialien.";
  if (obermaterial) material = `Obermaterial aus ${obermaterial}.`;
  if (laufsohle) material += ` Laufsohle: ${laufsohle}.`;
  const pflege = `Regelmaessige Pflege erhaelt Funktion und Lebensdauer. Konformitaet gemaess ${normTxt}.`;
  return (
    `<h2>${brand} ${modell}` + (klasse ? ` – Sicherheitsschuh der Klasse ${klasse}` : "") + "</h2>\n" +
    `<p>Der ${brand} ${modell} ist ein Sicherheitsschuh für anspruchsvolle Arbeitsumgebungen.</p>\n` +
    `<h3>Schutz &amp; Normen</h3>\n<p>${schutz}</p>\n` +
    `<h3>Komfort &amp; Passform</h3>\n<p>${komfort}</p>\n` +
    `<h3>Material</h3>\n<p>${material}</p>\n` +
    `<h3>Pflege &amp; Hinweise</h3>\n<p>${pflege}</p>\n<p>${usp}</p>`
  );
}

export function buildSeo(
  brand: string,
  modell: string,
  klasse: string | null,
  kappe: string | null,
  durchtritt: string | null,
  esd: boolean,
  rutsch: string | null,
): [string, string] {
  const kl = klasse ? `${klasse} ` : "";
  const title = clip(`${brand} ${modell} ${kl}Sicherheitsschuh` + (esd ? " ESD" : "") + " | workXperts", 60);
  const feats: string[] = [];
  if (kappe) feats.push(`${kappe}kappe`);
  if (durchtritt === "Ja") feats.push("Durchtrittschutz");
  if (esd) feats.push("ESD");
  if (rutsch) feats.push(rutsch);
  const fl = feats.join(", ");
  const desc = clip(
    `${brand} ${modell}: ${klasse || ""}-Sicherheitsschuh mit ${fl}. Robust und komfortabel. ` +
      `Jetzt bei workXperts bestellen.`.replace("  ", " "),
    155,
  );
  return [title, desc];
}
