// Shared server-side guard for every Edge Function: authenticate the caller from the
// forwarded bearer token, then enforce a durable per-user rate limit. Returns a Response
// to short-circuit on failure (401 or 429), or null when the request may proceed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE")!;

export async function guard(req: Request, maxPerMin: number): Promise<Response | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: userData } = await anon.auth.getUser(jwt);
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: allowed } = await admin.rpc("bump_rate_limit", {
    uid: userData.user.id,
    max_per_min: maxPerMin,
  });
  if (allowed === false) return new Response("Rate limited", { status: 429 });

  return null;
}
