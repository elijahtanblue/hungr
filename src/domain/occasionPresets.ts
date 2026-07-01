import type { StructuredQuery } from "./intentQuery";

export type Occasion = {
  id: string;
  label: string;      // chip text
  query: StructuredQuery;
};

// Named occasions map to a fixed structured query. queryHint steers Google's ranking (a free
// ambiance proxy); the rest are the deterministic guardrails the rule engine applies.
export const OCCASIONS: Occasion[] = [
  {
    id: "date-night",
    label: "Date night",
    query: { queryHint: "romantic date night dinner", priceBand: { min: 2 }, prestige: ["guide", "top"] },
  },
  {
    id: "anniversary",
    label: "Anniversary",
    query: { queryHint: "romantic fine dining anniversary", priceBand: { min: 3 }, prestige: ["guide", "top"] },
  },
  {
    id: "birthday",
    label: "Birthday",
    query: { queryHint: "birthday group dinner celebration", prestige: ["top"] },
  },
  {
    id: "impress",
    label: "Impress",
    query: { queryHint: "impressive upscale dining", priceBand: { min: 3 }, prestige: ["guide", "top"] },
  },
  {
    id: "classy-simple",
    label: "Classy & simple",
    query: { queryHint: "elegant intimate restaurant", priceBand: { min: 2, max: 3 }, prestige: ["top"] },
  },
  {
    id: "cheap-eats",
    label: "Cheap eats",
    query: { queryHint: "best value cheap eats", priceBand: { max: 2 }, prestige: ["top"] },
  },
  {
    id: "hidden-gem",
    label: "Hidden gem",
    query: { queryHint: "hidden gem underrated restaurant", prestige: ["hidden-gem"] },
  },
];

export function occasionById(id: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.id === id);
}
