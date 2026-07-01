import { enrichPlace, type EnrichDeps } from "./index.ts";

// A recording fake for the injected effects, so every branch of enrichPlace is asserted.
function fakeDeps(over: Partial<EnrichDeps> = {}) {
  const calls: string[] = [];
  const deps: EnrichDeps = {
    getWebsiteUri: async () => "https://restaurant.example",
    fetchSite: async () => "<html></html>",
    upsertFacts: async (_id, band, dietary) => { calls.push(`upsert:${band}:${dietary.join(",")}`); },
    markChecked: async () => { calls.push("markChecked"); },
    complete: async () => { calls.push("complete"); },
    fail: async (_id, err) => { calls.push(`fail:${err}`); },
    ...over,
  };
  return { deps, calls };
}

const MENU_HTML = `<script type="application/ld+json">${JSON.stringify({
  "@type": "MenuItem", name: "Vegan Bowl", price: 25, priceCurrency: "AUD", suitableForDiet: "VeganDiet",
})}</script>`;

Deno.test("enrichPlace with no website marks checked and dequeues", async () => {
  const { deps, calls } = fakeDeps({ getWebsiteUri: async () => null });
  if (await enrichPlace(deps, "p1") !== "no-website") throw new Error("expected no-website");
  if (!calls.includes("markChecked") || !calls.includes("complete")) throw new Error("should mark checked + complete");
});

Deno.test("enrichPlace backs off when the site fetch fails", async () => {
  const { deps, calls } = fakeDeps({ fetchSite: async () => null });
  if (await enrichPlace(deps, "p1") !== "failed") throw new Error("expected failed");
  if (!calls.some((c) => c.startsWith("fail:"))) throw new Error("should record a failure for backoff");
  if (calls.includes("complete")) throw new Error("must not dequeue on a transient fetch failure");
});

Deno.test("enrichPlace with a menu upserts derived facts and dequeues", async () => {
  const { deps, calls } = fakeDeps({ fetchSite: async () => MENU_HTML });
  if (await enrichPlace(deps, "p1") !== "enriched") throw new Error("expected enriched");
  if (!calls.includes("upsert:2:vegan")) throw new Error(`expected band 2 + vegan, got ${calls.join("|")}`);
  if (!calls.includes("complete")) throw new Error("should dequeue after enriching");
});

Deno.test("enrichPlace marks checked when the page has no menu markup", async () => {
  const { deps, calls } = fakeDeps({ fetchSite: async () => "<html>no jsonld</html>" });
  if (await enrichPlace(deps, "p1") !== "no-facts") throw new Error("expected no-facts");
  if (!calls.includes("markChecked")) throw new Error("should mark checked so browsing does not re-enqueue");
});

Deno.test("enrichPlace fails (not throws) when the details call throws", async () => {
  const { deps, calls } = fakeDeps({ getWebsiteUri: async () => { throw new Error("boom"); } });
  if (await enrichPlace(deps, "p1") !== "failed") throw new Error("expected failed");
  if (!calls.some((c) => c.startsWith("fail:details"))) throw new Error("should record the details failure");
});
