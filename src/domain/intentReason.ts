import type { IntentResult, StructuredQuery } from "./intentQuery";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One compliant line explaining why a place fits the ask. Built ONLY from structured facets and
// first-party / guide signals plus Google's numeric rating (a metric, not content). Never derived
// from Google review text. Picks the single strongest signal, then appends any keep-and-label
// dietary caveat so "unconfirmed" stays honest.
export function intentReason(result: IntentResult, q: StructuredQuery): string {
  const p = result.place;
  const parts: string[] = [];

  if (p.guideAward) {
    parts.push(p.guideAward);
  } else if (q.prestige?.includes("hidden-gem")) {
    parts.push("Under-the-radar find");
  } else if (q.prestige?.includes("top") && typeof p.rating === "number") {
    parts.push(`Highly rated (${p.rating.toFixed(1)}★)`);
  } else {
    const match = q.cuisines?.find((c) => p.cuisines.includes(c));
    if (match) parts.push(`${cap(match)} spot`);
    else if (q.priceBand && p.priceBand) parts.push("Fits your budget");
    else {
      const diet = q.dietary?.find((d) => (p.dietaryTags ?? []).includes(d));
      if (diet) parts.push(`${cap(diet)}-friendly`);
    }
  }

  if (parts.length === 0) parts.push("Worth a look");
  if (result.unconfirmed.length) parts.push(`${result.unconfirmed.join(", ")} not confirmed`);
  return parts.join(" · ");
}
