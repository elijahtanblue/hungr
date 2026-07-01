// Guarded enqueue endpoint for menu enrichment. The client nominates surfaced places; this function
// authenticates + per-user rate-limits (shared guard), validates each candidate, and calls the
// freshness-gating RPC. Routing through the guard is what caps queue-spam from a single user, which
// a bare authenticated RPC grant cannot do.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("HUNGR_SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("HUNGR_SUPABASE_ANON_KEY")!;
const MAX_PLACES = 10;

// Keep only well-formed candidates and cap the batch, so one request cannot enqueue thousands.
export function validPlaces(raw: unknown): { placeId: string; lng: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { placeId: string; lng: number }[] = [];
  for (const p of raw) {
    if (out.length >= MAX_PLACES) break;
    if (!p || typeof p !== "object") continue;
    const placeId = (p as Record<string, unknown>).placeId;
    const lng = (p as Record<string, unknown>).lng;
    if (typeof placeId === "string" && /^[A-Za-z0-9_-]{10,255}$/.test(placeId) &&
        typeof lng === "number" && lng >= -180 && lng <= 180) {
      out.push({ placeId, lng });
    }
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 30);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;

  const places = validPlaces(body.value.places);
  if (places.length > 0) {
    const auth = req.headers.get("Authorization") ?? "";
    const db = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    // The RPC decides per place whether a queue row is actually needed (freshness gate).
    await Promise.all(places.map((p) => db.rpc("enqueue_menu_enrich", { p_place_id: p.placeId, p_lng: p.lng })));
  }
  return new Response(JSON.stringify({ enqueued: places.length }), { headers: { "Content-Type": "application/json" } });
}

if (import.meta.main) Deno.serve(handler);
