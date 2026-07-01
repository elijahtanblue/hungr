import { extractJsonLd, menuNodesFrom, derivePriceBand, deriveDietaryFlags } from "./parseMenu.ts";

const SCRIPT = (json: string) => `<html><head><script type="application/ld+json">${json}</script></head></html>`;

Deno.test("extractJsonLd parses each block and skips malformed ones", () => {
  const html = SCRIPT('{"@type":"Menu"}') + `<script type="application/ld+json">{ broken json }</script>` + SCRIPT('{"@type":"Restaurant"}');
  const out = extractJsonLd(html);
  if (out.length !== 2) throw new Error(`expected 2 valid blocks, got ${out.length}`);
});

Deno.test("extractJsonLd returns empty when there is no JSON-LD", () => {
  if (extractJsonLd("<html><body>no data</body></html>").length !== 0) throw new Error("expected no blocks");
});

Deno.test("menuNodesFrom walks Restaurant>Menu>Section>Item>Offer for prices", () => {
  const doc = {
    "@type": "Restaurant",
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: {
        "@type": "MenuSection",
        hasMenuItem: [
          { "@type": "MenuItem", name: "Pasta", offers: { "@type": "Offer", price: "28.00", priceCurrency: "AUD" } },
          { "@type": "MenuItem", name: "Steak", offers: { price: 45, priceCurrency: "AUD" } },
        ],
      },
    },
  };
  const nodes = menuNodesFrom([doc]);
  if (nodes.prices.length !== 2) throw new Error(`expected 2 prices, got ${nodes.prices.length}`);
  if (!nodes.prices.some((p) => p.amount === 28 && p.currency === "AUD")) throw new Error("28 AUD missing");
  if (!nodes.texts.includes("Pasta")) throw new Error("item name should be collected for keyword scan");
});

Deno.test("menuNodesFrom handles a flat @graph array and suitableForDiet", () => {
  const doc = { "@graph": [
    { "@type": "MenuItem", name: "Vegan Bowl", price: 18, priceCurrency: "AUD", suitableForDiet: "https://schema.org/VeganDiet" },
  ] };
  const nodes = menuNodesFrom([doc]);
  if (nodes.prices[0].amount !== 18) throw new Error("graph price missing");
  if (!nodes.diets.some((d) => d.includes("Vegan"))) throw new Error("suitableForDiet missing");
});

Deno.test("derivePriceBand maps the median at each AUD boundary", () => {
  if (derivePriceBand([{ amount: 15 }]) !== 1) throw new Error("15 -> band 1");
  if (derivePriceBand([{ amount: 30 }]) !== 2) throw new Error("30 -> band 2");
  if (derivePriceBand([{ amount: 55 }]) !== 3) throw new Error("55 -> band 3");
  if (derivePriceBand([{ amount: 90 }]) !== 4) throw new Error("90 -> band 4");
});

Deno.test("derivePriceBand uses the median and defaults missing currency to AUD", () => {
  // median of [10, 30, 200] is 30 -> band 2 (a stray high price does not skew a median)
  if (derivePriceBand([{ amount: 10 }, { amount: 30 }, { amount: 200 }]) !== 2) throw new Error("median band wrong");
});

Deno.test("derivePriceBand returns null with no priced items", () => {
  if (derivePriceBand([]) !== null) throw new Error("empty -> null");
});

Deno.test("derivePriceBand ignores a stray foreign-currency price via dominant currency", () => {
  // Two AUD items dominate; the lone USD price is excluded from the median.
  const band = derivePriceBand([{ amount: 25, currency: "AUD" }, { amount: 35, currency: "AUD" }, { amount: 500, currency: "USD" }]);
  if (band !== 2) throw new Error(`expected band 2 from AUD median 30, got ${band}`);
});

Deno.test("deriveDietaryFlags reads suitableForDiet and item-name keywords", () => {
  const flags = deriveDietaryFlags(["https://schema.org/GlutenFreeDiet"], ["Vegan Bowl", "Beef Pie"]);
  if (!flags.includes("gluten-free")) throw new Error("gluten-free from suitableForDiet");
  if (!flags.includes("vegan")) throw new Error("vegan from item name");
  if (flags.includes("vegetarian")) throw new Error("should not invent vegetarian");
});

Deno.test("deriveDietaryFlags returns empty when nothing matches", () => {
  if (deriveDietaryFlags([], ["Beef Pie", "Fish and Chips"]).length !== 0) throw new Error("expected no flags");
});
