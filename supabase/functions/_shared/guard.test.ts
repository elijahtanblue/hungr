import { rateLimitAllowed, bucketFromRequest } from "./guard.ts";

Deno.test("rateLimitAllowed only allows an explicit true RPC result", () => {
  if (!rateLimitAllowed(true, null)) throw new Error("true should allow the request");
  if (rateLimitAllowed(false, null)) throw new Error("false should block the request");
  if (rateLimitAllowed(null, null)) throw new Error("null should block the request");
  if (rateLimitAllowed(true, new Error("rpc failed"))) throw new Error("rpc errors should block the request");
});

Deno.test("bucketFromRequest keys the limiter by function name", () => {
  const bucket = bucketFromRequest(new Request("https://ref.functions.supabase.co/functions/v1/review-photo-moderate"));
  if (bucket !== "review-photo-moderate") throw new Error(`expected function-name bucket, got ${bucket}`);
});

Deno.test("bucketFromRequest isolates different functions", () => {
  const a = bucketFromRequest(new Request("https://ref.supabase.co/functions/v1/place-photo"));
  const b = bucketFromRequest(new Request("https://ref.supabase.co/functions/v1/review-photo-moderate"));
  if (a === b) throw new Error("different functions must not share a bucket");
});

Deno.test("bucketFromRequest falls back to a shared bucket on an unusable url", () => {
  if (bucketFromRequest(new Request("https://ref.supabase.co/")) !== "global") throw new Error("root path should be global");
});
