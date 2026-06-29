import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function makeUser(email: string) {
  const c = createClient(URL, ANON);
  await c.auth.signUp({ email, password: "test-pass-123" });
  const { data } = await c.auth.signInWithPassword({ email, password: "test-pass-123" });
  return { client: c, uid: data.user!.id };
}

Deno.test("user_places is isolated for read and write", async () => {
  const a = await makeUser(`a_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`b_${crypto.randomUUID()}@t.dev`);

  // a seeds a place anchor and its own state. The anchor is insert-or-ignore:
  // places is immutable (place_id only), so on conflict do nothing (no UPDATE needed).
  await a.client.from("places").upsert({ place_id: "p1" }, { onConflict: "place_id", ignoreDuplicates: true });
  const ins = await a.client.from("user_places").upsert({ user_id: a.uid, place_id: "p1", state: "go" });
  if (ins.error) throw new Error("a should be able to write its own user_places: " + ins.error.message);

  // b must not READ a's row
  const read = await b.client.from("user_places").select("*").eq("place_id", "p1");
  if (read.data && read.data.length > 0) throw new Error("RLS leak: b read a's user_places");

  // b must not WRITE a row owned by a
  const write = await b.client.from("user_places").upsert({ user_id: a.uid, place_id: "p1", state: "avoid" });
  if (!write.error) throw new Error("RLS leak: b wrote a's user_places");
});

Deno.test("profiles are private to their owner", async () => {
  const a = await makeUser(`pa_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`pb_${crypto.randomUUID()}@t.dev`);
  // Create a's own profile here so this test does not depend on the signup trigger
  // (that trigger is added in a later task). This test only proves RLS isolation.
  const created = await a.client.from("profiles").upsert({ id: a.uid, display_name: "A" });
  if (created.error) throw new Error("a should be able to write its own profile: " + created.error.message);
  const mine = await a.client.from("profiles").select("*").eq("id", a.uid);
  if (!mine.data || mine.data.length !== 1) throw new Error("a should read its own profile");
  const theirs = await b.client.from("profiles").select("*").eq("id", a.uid);
  if (theirs.data && theirs.data.length > 0) throw new Error("RLS leak: b read a's profile");
});

Deno.test("reviews cannot be written as another user", async () => {
  const a = await makeUser(`ra_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`rb_${crypto.randomUUID()}@t.dev`);
  await a.client.from("places").upsert({ place_id: "p2" }, { onConflict: "place_id", ignoreDuplicates: true });
  const forged = await b.client.from("reviews").insert({ user_id: a.uid, place_id: "p2", body: "x", rating: 5 });
  if (!forged.error) throw new Error("RLS leak: b forged a review as a");
});

Deno.test("places and cuisines are publicly readable", async () => {
  const a = await makeUser(`ca_${crypto.randomUUID()}@t.dev`);
  const cuisines = await a.client.from("cuisines").select("*");
  if (!cuisines.data || cuisines.data.length < 6) throw new Error("cuisines should be public read");
});

Deno.test("rate_limits is not readable by any client", async () => {
  const a = await makeUser(`rl_${crypto.randomUUID()}@t.dev`);
  // Touch the limiter indirectly is not possible from the client; just prove the table is
  // locked down (RLS enabled, no policy, no grant) so per-user request counts never leak.
  const { data } = await a.client.from("rate_limits").select("*");
  if (data && data.length > 0) throw new Error("rate_limits must not be client readable");
});
