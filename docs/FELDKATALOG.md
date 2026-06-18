# Feld-Landkarte & Engine-Scope (verbindlich)

Quelle: `docs/Feldkatalog_und_Import-Template.xlsx` — live aus workxperts.de gezogen
(Stand 2026-06-18). **Die echten Keys/Typen kommen aus dieser Datei — niemals Keys erfinden.**
Entspricht Abschnitt 17 des Übergabe-Prompts.

## Grundprinzip: bewusst „schmale" Engine
Die asx-Anreicherungs-Engine schreibt **ausschließlich** ihre eigenen, asx-/titel-ableitbaren
Felder. Compliance (GPSR), Kanal-/Feed-Felder, Shopify-Taxonomie und Stammdaten werden von
**anderen Apps/Prozessen** gepflegt — die Engine **überschreibt sie nie**. Das ist Absicht,
keine „halbe App". Technisch erzwungen durch die Allow-List `ENGINE_ALLOWED` in
`supabase/functions/_shared/pipeline.ts` (`enforceScope`).

## Was die Engine SCHREIBT (ENRICH + Präsentation + SEO)

| Feld | Typ | Regel | Status im Code |
|---|---|---|---|
| `global.Schutzklasse` | single_line_text_field | **asx gewinnt** (auch überschreibend), Audit | ✅ aktiv |
| `global.Obermaterial` | single_line_text_field | fill-empty | ✅ aktiv |
| `global.Innenfutter` | single_line_text_field | fill-empty | ✅ aktiv |
| `global.Laufsohle` | single_line_text_field | fill-empty (= Decksohle) | ✅ aktiv |
| `global.Farbe` | single_line_text_field | fill-empty, kanonische Grundfarbe | ✅ aktiv |
| `global.Geschlecht` | single_line_text_field | fill-empty, aus Titel (Herren/Damen/Unisex) | ✅ aktiv |
| `custom.normen` | list.single_line_text_field | fill-empty, kanon. Liste (**filterbar**) | ✅ aktiv |
| `custom.din_norm` | multi_line_text_field | fill-empty, Normen als Anzeigetext | ✅ aktiv |
| `custom.schutzkappe` | single_line_text_field | fill-empty (Aluminium/Stahl/Kunststoff) | ✅ aktiv |
| `custom.durchtrittschutz` | single_line_text_field | Ja/Nein (Plausibilität) | ✅ aktiv |
| `custom.rutschhemmung` | single_line_text_field | SRA/SRB/SRC, nur wenn Quelle nennt | ✅ aktiv |
| `custom.weite` | single_line_text_field | aus UNSEREM Titel, nicht asx | ✅ aktiv |
| `custom.warnschutz` | boolean | true nur bei EN ISO 20471 | ✅ aktiv |
| `custom.kurz_usp` | single_line_text_field | regenerierbar (PRES) | ✅ aktiv |
| `custom.bulletpoints_rich` | rich_text_field | regenerierbar, 4–5 Bullets (PRES) | ✅ aktiv |
| `title_tag` / `description_tag` | string (native SEO) | via `productUpdate seo{}` | ✅ aktiv |
| Image Alt Text | (Standardfeld) | optional | ⬜ offen |
| `global.Materialzusammensetzung` | single_line_text_field | fill-empty (Textil) | ⬜ offen* |
| `global.Schuhform` | single_line_text_field | fill-empty (Halbschuh/Stiefel…) | ⬜ offen* |
| `global.Schuhhoehe` | single_line_text_field | fill-empty | ⬜ offen* |
| `custom.materialgewicht` | number_integer | Textil g/m² | ⬜ offen* |
| `custom.pflegehinweise` | list.single_line_text_field | Textil, Mehrfachwerte | ⬜ offen* |

\* Im Scope, aber bewusst noch nicht aktiv — brauchen entweder eine asx-Scrape-Erweiterung
(Textil-Material/Gewicht/Pflege) oder das kanonische Wert-Vokabular (Schuhform/-höhe). Erst
nach Klärung aktivieren, um keine falschen/inkonsistenten Werte zu schreiben.

## Was die Engine NIEMALS anfasst (von anderen Apps gepflegt)

- **Compliance/GPSR:** gesamte `simplecomply.*`-Variantenebene (manufacturer, importer,
  responsible-person, ce-marking, safety-warning, instructions-for-use, …), `custom.gpsr*`,
  Metaobjekte `actor` / `gpsr_hersteller`.
- **Kanal/Feed:** `mm-google-shopping.*`, `custom.var_google_*`, `custom.var_zalando_*`,
  `custom.zalando_*`, `custom.var_otto_*`, `custom.var_m2e_*`.
- **Shopify-Taxonomie/Filter:** alle `shopify.*`-Metaobjekt-Referenzen (shoe-fit, color-pattern,
  footwear-material, target-gender, …).
- **Stammdaten/PIM:** `custom.var_ek`, `custom.var_bestand_*`, SKU, **Barcode** (nur LESEN
  fürs EAN-Gate), `custom.lieferantenartikelnummer` (nur echte Hersteller-Nr, NIE asx-Nr),
  `custom.farbe/geschlecht/weite` auf **Varianten**ebene (PIM), `custom.produkttyp/serie`, …
- **Tote Dubletten:** die `custom`-Kleinbuchstaben-Produktfelder werden nicht (neu) beschrieben.

## Filterbarkeit (Online Store → Search & Discovery)
Nur `boolean` / `single_line_text` / `list.single_line_text` / `number` / `metaobject` sind
filterbar. `custom.din_norm` (multi_line) ist es NICHT — dafür existiert `custom.normen` (list)
als filterbares Pendant. Filter müssen manuell aktiviert werden.
