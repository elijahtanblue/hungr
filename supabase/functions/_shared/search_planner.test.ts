import { planPlaceSearch } from "./search_planner.ts";

Deno.test("hot pot typed search starts with a local type-aware strategy", () => {
  const plan = planPlaceSearch("Hot pot", "typed");

  if (plan[0].locationMode !== "restriction") throw new Error("first strategy should stay local");
  if (plan[0].includedType !== "hot_pot_restaurant") throw new Error("hot pot type missing");
  if (!plan[0].textQuery.toLowerCase().includes("hot pot")) throw new Error("query should keep user intent");
});

Deno.test("partial branch search tries the visible area before a broad biased fallback", () => {
  const plan = planPlaceSearch("Nan Hot pot", "typed");

  if (plan[0].locationMode !== "restriction") throw new Error("first branch strategy should be local");
  if (plan.at(-1)?.locationMode !== "bias") throw new Error("last branch strategy should be broad fallback");
});

Deno.test("nearby food uses area browse strategies instead of the typed query", () => {
  const plan = planPlaceSearch("Sandoitchi Cafe Sydney", "nearby");
  const joined = plan.map((s) => s.textQuery).join(" ");

  if (!joined.includes("food")) throw new Error("nearby browse should search for food");
  if (joined.includes("Sandoitchi")) throw new Error("nearby browse must not reuse typed text");
});
