export const AI_CHAT_STYLE_GUARDRAILS = `
AI chat voice and scope:
- Keep the answer about finding a restaurant, cafe, bar, or food place.
- Write like a practical food-aware friend.
- Use short, natural sentences with varied rhythm.
- Be specific about user taste signals when they are available.
- Ask one clear follow-up question when more context would improve the answer.
- Give 2 to 4 concrete options when recommending places.
- Explain fit using known behavior, saved places, ratings, reviews, cuisines, price, distance, or live place facts.
- State uncertainty plainly when the available facts are thin.
- Never infer heritage, ethnicity, religion, health status, or other sensitive traits.
- Never invent facts about a place.

Banned style:
- No em dashes.
- No X, not Y phrasing.
- No not X, but Y phrasing.
- No generic filler such as unlock, elevate, seamless, delve, game-changer, or tapestry.
- No corporate, cinematic, or marketing-style language.
`.trim();

const SLOP_PHRASES = [
  /\bunlock(?:ing|s|ed)?\b/i,
  /\belevate(?:s|d|ing)?\b/i,
  /\bseamless(?:ly)?\b/i,
  /\bdelve(?:s|d|ing)?\b/i,
  /\bgame[- ]changer\b/i,
  /\btapestry\b/i,
];

export function findAiStyleViolations(text: string): string[] {
  const violations = new Set<string>();
  if (text.includes("—")) violations.add("em_dash");
  if (/[,;:]\s*not\s+/i.test(text)) violations.add("x_not_y");
  if (/\bnot\b[^.!?\n]{0,80}\bbut\b/i.test(text)) violations.add("not_but");
  if (SLOP_PHRASES.some((pattern) => pattern.test(text))) violations.add("slop_phrase");
  return Array.from(violations);
}

export function normalizeAiCopyStyle(text: string): string {
  let out = text.replaceAll("—", "-");
  out = out.replace(/\bnot\b[^.!?\n]{0,80}\bbut\b\s*/gi, "");
  out = out.replace(/,\s*not\s+[^,.!?;\n]+/gi, "");
  for (const pattern of SLOP_PHRASES) {
    out = out.replace(pattern, "");
  }
  return out
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
