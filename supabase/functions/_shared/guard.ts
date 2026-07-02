// Shared server-side guard for every Edge Function: authenticate the caller from the
// forwarded bearer token, then enforce a durable per-user rate limit. Returns a Response
// to short-circuit on failure (401 or 429), or null when the request may proceed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("HUNGR_SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("HUNGR_SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("HUNGR_SUPABASE_SERVICE_ROLE")!;

export function rateLimitAllowed(allowed: unknown, error: unknown): boolean {
  return !error && allowed === true;
}

// The rate-limit counter is keyed per (user, bucket). We use the function name (the last path
// segment) as the bucket so each function gets its own independent per-minute window, instead of
// sharing one counter where a high-traffic function starves a low-cap one (which is what silently
// 429'd photo moderation during normal browsing).
export function bucketFromRequest(req: Request): string {
  try {
    const name = new URL(req.url).pathname.split("/").filter(Boolean).pop();
    return name && /^[a-z0-9-]+$/.test(name) ? name : "global";
  } catch {
    return "global";
  }
}

export async function guard(req: Request, maxPerMin: number): Promise<Response | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: userData } = await anon.auth.getUser(jwt);
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: allowed, error } = await admin.rpc("bump_rate_limit", {
    uid: userData.user.id,
    bucket: bucketFromRequest(req),
    max_per_min: maxPerMin,
  });
  if (!rateLimitAllowed(allowed, error)) return new Response("Rate limited", { status: 429 });

  return null;
}
