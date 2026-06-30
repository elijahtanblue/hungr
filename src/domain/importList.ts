// Parses a pasted list of places into rows we can resolve against Google. Tolerant of the common
// shapes people paste: a Google Takeout saved-list CSV (header with "Title"/"URL"), a spreadsheet
// copy (tab or comma separated), or plain notes (one place per line, optionally "Name, Address").
//
// Everything becomes a { name, query } pair: name is what we show, query is what we search for.
// We do not try to infer "been" vs "want to go" here (Takeout has no such signal) - the caller
// decides the destination state.

export type ImportRow = { name: string; query: string };

// Caps how many rows we hand back, so a giant paste cannot kick off thousands of lookups.
export const MAX_IMPORT_ROWS = 50;

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
