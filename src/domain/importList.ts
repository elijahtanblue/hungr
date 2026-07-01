// Parses a pasted list of places into rows we can resolve against Google. Tolerant of the common
// shapes people paste: a Google Takeout saved-list CSV (header with "Title"/"URL"), a spreadsheet
// copy (tab or comma separated), or plain notes (one place per line, optionally "Name, Address").
//
// Everything becomes a { name, query } pair: name is what we show, query is what we search for.
// We do not try to infer "been" vs "want to go" here (Takeout has no such signal) - the caller
// decides the destination state.

// lat/lng are present only for the GeoJSON Takeout export, which carries each place's coordinates;
// the resolver uses them to bias that row's search to the exact spot.
export type ImportRow = { name: string; query: string; lat?: number; lng?: number };

// Caps how many rows we hand back, so a giant paste cannot kick off thousands of lookups.
export const MAX_IMPORT_ROWS = 50;

// Google Takeout can export a saved list as GeoJSON (a .json file), which is the richest shape: it
// carries the Title, the full Address, and the exact coordinates. Parse those when we see them.
function parseGeoJson(text: string): ImportRow[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: any;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) return null;

  const rows: ImportRow[] = [];
  for (const feature of parsed.features) {
    const props = feature?.properties ?? {};
    const name = (props.Title ?? props.title ?? props.name ?? "").toString().trim();
    if (!name) continue;
    const address = (props.Location?.Address ?? props.Address ?? "").toString().trim();
    const coords = feature?.geometry?.coordinates;
    // GeoJSON is [longitude, latitude].
    const lng = Array.isArray(coords) && Number.isFinite(coords[0]) ? Number(coords[0]) : undefined;
    const lat = Array.isArray(coords) && Number.isFinite(coords[1]) ? Number(coords[1]) : undefined;
    rows.push({ name, query: address ? `${name} ${address}` : name, lat, lng });
  }
  return dedupe(rows).slice(0, MAX_IMPORT_ROWS);
}

// Splits one CSV line into fields, honouring "quoted, fields" and "" escaped quotes.
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function dedupe(rows: ImportRow[]): ImportRow[] {
  const seen = new Set<string>();
  const out: ImportRow[] = [];
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); out.push(row); }
  }
  return out;
}

export function parseImportText(text: string): ImportRow[] {
  // A GeoJSON Takeout export is the richest source, so try it before falling back to line parsing.
  const geo = parseGeoJson(text);
  if (geo) return geo;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // CSV/spreadsheet with a header? Look for a "Title" (Takeout) or "Name" column.
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase());
  const titleCol = header.findIndex((h) => h === "title" || h === "name");
  if (titleCol !== -1) {
    const addrCol = header.findIndex((h) => h === "address" || h === "note" || h === "comment");
    const rows = lines.slice(1).map((line) => {
      const cells = splitCsv(line);
      const name = (cells[titleCol] ?? "").trim();
      const addr = addrCol !== -1 ? (cells[addrCol] ?? "").trim() : "";
      return { name, query: addr ? `${name} ${addr}` : name };
    }).filter((r) => r.name);
    return dedupe(rows).slice(0, MAX_IMPORT_ROWS);
  }

  // Plain notes: one place per line. "Name, Address" -> show the name, search the whole line.
  const rows = lines.map((line) => {
    const name = line.split(",")[0].trim();
    return { name: name || line, query: line };
  });
  return dedupe(rows).slice(0, MAX_IMPORT_ROWS);
}
