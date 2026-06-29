import { rateLimitAllowed } from "./guard.ts";

Deno.test("rateLimitAllowed only allows an explicit true RPC result", () => {
  if (!rateLimitAllowed(true, null)) throw new Error("true should allow the request");
  if (rateLimitAllowed(false, null)) throw new Error("false should block the request");
  if (rateLimitAllowed(null, null)) throw new Error("null should block the request");
  if (rateLimitAllowed(true, new Error("rpc failed"))) throw new Error("rpc errors should block the request");
});
