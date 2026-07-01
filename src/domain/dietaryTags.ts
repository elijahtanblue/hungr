// Derive first-party dietary flags from a place NAME only (never from Google review content).
// This mirrors the proxy's NAME_TO_CUISINES approach: a place literally named "X Vegetarian"
// is a vegetarian place. Word boundaries stop "Vegas" matching "vegan".
const DIETARY_PATTERNS: { tag: string; pattern: RegExp }[] = [
  { tag: "vegan", pattern: /\bvegan\b/ },
  { tag: "vegetarian", pattern: /\bvegetarian\b/ },
];

export function dietaryTagsFromName(name: string): string[] {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tags: string[] = [];
  for (const { tag, pattern } of DIETARY_PATTERNS) {
    if (pattern.test(normalized)) tags.push(tag);
  }
  return tags;
}
