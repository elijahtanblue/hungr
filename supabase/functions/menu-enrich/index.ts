// Cron-triggered menu enrichment worker. Drains the off-peak-due batch from menu_enrich_queue and,
// per place, fetches the restaurant's OWN website (never Google content), parses its schema.org menu
// markup, and stores a derived price band + dietary flags in first_party_facts. Authenticated by a
// shared cron secret (passed by pg_cron/pg_net, stored in Vault, never in a migration).
//
//   select_due -> [per place] getWebsiteUri -> safeFetch -> parseMenu -> upsert facts -> dequeue
//   any step fails -> fail_menu_enrich (backoff, dead-letter after 5)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeFetch } from "../_shared/safeFetch.ts";
import { extractJsonLd, menuNodesFrom, derivePriceBand, deriveDietaryFlags } from "./parseMenu.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("HUNGR_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("HUNGR_SUPABASE_SERVICE_ROLE")!;
const CRON_SECRET = Deno.env.get("MENU_CRON_SECRET") ?? "";
const BATCH = 50;

export type EnrichResult = "enriched" | "no-website" | "no-facts" | "failed";

export type EnrichDeps = {
  getWebsiteUri: (placeId: string) => Promise<string | null>;
  fetchSite: (url: string) => Promise<string | null>;
  upsertFacts: (placeId: string, band: number | null, dietary: string[]) => Promise<void>;
  markChecked: (placeId: string) => Promise<void>;
  complete: (placeId: string) => Promise<void>;
  fail: (placeId: string, error: string) => Promise<void>;
};

// Enrich one queued place. Pure orchestration over injected effects, so every branch is unit-tested.
export async function enrichPlace(deps: EnrichDeps, placeId: string): Promise<EnrichResult> {
  let websiteUri: string | null;
  try {
    websiteUri = await deps.getWebsiteUri(placeId);
  } catch (e) {
    await deps.fail(placeId, `details: ${e}`);
    return "failed";
  }

  if (!websiteUri) {
    // No website to scrape: mark checked (so browsing does not re-enqueue it) and dequeue.
    await deps.markChecked(placeId);
    await deps.complete(placeId);
    return "no-website";
  }

  const html = await deps.fetchSite(websiteUri);
  if (html === null) {
    // Fetch blocked/failed/oversized: transient, so back off and retry later.
    await deps.fail(placeId, "fetch failed or blocked");
    return "failed";
  }

  const nodes = menuNodesFrom(extractJsonLd(html));
  const band = derivePriceBand(nodes.prices);
  const dietary = deriveDietaryFlags(nodes.diets, nodes.texts);

  if (band === null && dietary.length === 0) {
    // Page had no usable menu markup: mark checked and dequeue (retrying the same page is pointless).
    await deps.markChecked(placeId);
    await deps.complete(placeId);
    return "no-facts";
  }

  await deps.upsertFacts(placeId, band, dietary);
  await deps.complete(placeId);
  return "enriched";
}

async function resolveHost(host: string): Promise<string[]> {
  const out: string[] = [];
  for (const kind of ["A", "AAAA"] as const) {
    try {
      out.push(...(await Deno.resolveDns(host, kind)));
    } catch {
      // A missing record type is fine; the other may resolve.
    }
  }
  return out;
}

function liveDeps(): EnrichDeps {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);
  return {
    getWebsiteUri: async (placeId) => {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "websiteUri" },
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const data = await res.json();
      return typeof data.websiteUri === "string" ? data.websiteUri : null;
    },
    fetchSite: (url) => safeFetch(url, { resolve: resolveHost, fetchImpl: fetch }),
    upsertFacts: async (placeId, band, dietary) => {
      await db.rpc("upsert_menu_facts", { p_place_id: placeId, p_price_band: band, p_dietary: dietary });
    },
    markChecked: async (placeId) => { await db.rpc("mark_menu_checked", { p_place_id: placeId }); },
    complete: async (placeId) => { await db.rpc("complete_menu_enrich", { p_place_id: placeId }); },
    fail: async (placeId, error) => { await db.rpc("fail_menu_enrich", { p_place_id: placeId, p_error: error }); },
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await db.rpc("select_due_menu_enrich", { p_batch: BATCH });
  if (error) return new Response("Queue error", { status: 502 });

  const deps = liveDeps();
  const counts: Record<EnrichResult, number> = { enriched: 0, "no-website": 0, "no-facts": 0, failed: 0 };
  for (const row of (data ?? []) as { place_id: string }[]) {
    try {
      counts[await enrichPlace(deps, row.place_id)]++;
    } catch {
      // A single place must never fail the whole batch.
      counts.failed++;
    }
  }
  return new Response(JSON.stringify(counts), { headers: { "Content-Type": "application/json" } });
}

if (import.meta.main) Deno.serve(handler);
