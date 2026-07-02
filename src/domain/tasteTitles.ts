// Deterministic taste "traits" shown as golden bubbles on a profile, plus one-line taste insights.
// Everything is derived from the user's own first-party taste vector (get_taste_feature_scores):
// the cuisines they engage with, the tags they leave on reviews, and behavioral signals (go / liked
// / loved / disliked / checked_in). All signals are behavioral and opt-in; nothing derives from a
// protected characteristic (diet is a choice, not a protected trait). Thresholds are named constants.
//
// We intentionally do NOT compute distance or price-tier traits here: those need per-place location
// and price that we deliberately do not store (we keep only place_id plus first-party data).

export type FeatureScore = { feature: string; score: number; evidenceCount: number };

export type TraitMeta = {
  id: string;
  name: string;
  emoji: string;
  how: string; // how you get it, shown in the guide and when a bubble is tapped
  group: "class" | "trait";
};

export type Trait = TraitMeta & {
  earned: boolean;
  detail: string; // evidence when earned, otherwise the same as `how`
};

const CLASS_SHARE = 0.35; // a "class" is a food category that's >=35% of your cuisine signal
const EXPLORER_CUISINES = 6; // distinct cuisines that mark a true explorer
const MIN_CUISINE_EVIDENCE = 3; // need a little history before a cuisine-based trait is meaningful
const VALUE_MIN_EVIDENCE = 2; // repeated value signals, not a one-off
const PICKY_MIN_DISLIKES = 2; // need a couple of dislikes before calling someone picky
const MUNCH_PER_WEEK = 4; // eats out more than this many times in the last week
const FOLLOWER_MIN = 3; // opened this many trending places

// Cuisine keyword sets. Matched as substrings against lowercased cuisine feature names. "boba"
// deliberately avoids the bare token "tea" (it is a substring of "steak").
const CATEGORIES: Record<string, string[]> = {
  meat: ["bbq", "barbecue", "steak", "grill", "burger", "meat", "smokehouse", "churrasc"],
  veg: ["vegan", "vegetarian", "plant"],
  spicy: ["thai", "sichuan", "szechuan", "indian", "curry", "korean", "hunan"],
  noodle: ["ramen", "noodle", "pho", "udon", "soba", "pasta"],
  sweet: ["dessert", "bakery", "patisserie", "ice cream", "gelato", "cake", "pastry"],
  sushi: ["sushi", "sashimi", "omakase", "poke"],
  cafe: ["cafe", "café", "coffee", "espresso", "brunch"],
  boba: ["boba", "bubble tea", "milk tea", "matcha", "teahouse", "tea house"],
};

// Presentational catalog. Single source of truth for names/emojis/how, shared by the account bubbles
// and the "how we give you titles" guide.
export const TRAIT_CATALOG: TraitMeta[] = [
  { id: "brotein", name: "Brotein", emoji: "🥩", how: "Save and review lots of meat-forward spots.", group: "class" },
  { id: "koala", name: "Koala", emoji: "🐨", how: "Save and review lots of vegetarian and vegan spots.", group: "class" },
  { id: "spicy_poops", name: "Spicy Poops", emoji: "🌶️", how: "Chase the heat: Thai, Sichuan, Indian, plus spicy review tags.", group: "class" },
  { id: "send_noodz", name: "Send Noodz", emoji: "🍜", how: "Slurp lots of ramen, pho, and pasta.", group: "class" },
  { id: "sweaty", name: "Sweaty", emoji: "🍰", how: "Live for dessert and bakeries.", group: "class" },
  { id: "raw_deal", name: "Raw", emoji: "🍣", how: "Log lots of sushi, sashimi, and poke.", group: "class" },
  { id: "brunch_girlie", name: "Brunch Girlie", emoji: "🥐", how: "Live in cafes and drink a lot of coffee.", group: "class" },
  { id: "boba_addict", name: "Boba Addict", emoji: "🧋", how: "Frequent bubble tea and tea shops.", group: "class" },
  { id: "explorer", name: "Explorer", emoji: "🗺️", how: "Try six or more different cuisines.", group: "trait" },
  { id: "eater", name: "Eater", emoji: "🍽️", how: "Range widely with no single favourite.", group: "trait" },
  { id: "value_meal", name: "Value Meal", emoji: "🍟", how: "Seek out spots that are cheap and great.", group: "trait" },
  { id: "picky_eater", name: "Picky Eater", emoji: "😖", how: "Rule more places out than you rave about.", group: "trait" },
  { id: "munch", name: "Munch", emoji: "😋", how: "Eat out more than four times a week.", group: "trait" },
  { id: "follower", name: "Follower", emoji: "📈", how: "Open lots of places from Local trends.", group: "trait" },
  { id: "girl_dinner", name: "Girl Dinner", emoji: "💄", how: "Live in cafes, but rarely sit down for a real meal.", group: "trait" },
  { id: "boy_dinner", name: "Boy Dinner", emoji: "💪", how: "Go to sit-down restaurants far more than anything else.", group: "trait" },
];

const META = new Map(TRAIT_CATALOG.map((m) => [m.id, m]));

type Bucket = Map<string, { score: number; ev: number }>;

function bucketFrom(features: FeatureScore[], namespace: string): Bucket {
  const out: Bucket = new Map();
  for (const f of features) {
    const idx = f.feature.indexOf(":");
    if (idx < 0) continue;
    if (f.feature.slice(0, idx) !== namespace) continue;
    const name = f.feature.slice(idx + 1).toLowerCase().trim();
    if (!name) continue;
    const cur = out.get(name) ?? { score: 0, ev: 0 };
    out.set(name, { score: cur.score + f.score, ev: cur.ev + f.evidenceCount });
  }
  return out;
}

function scoreWhere(bucket: Bucket, keys: string[]): number {
  let sum = 0;
  for (const [name, v] of bucket) if (keys.some((k) => name.includes(k))) sum += v.score;
  return sum;
}

type Vector = {
  cuisines: Bucket;
  tags: Bucket;
  signals: Bucket;
  totalCuisine: number;
  totalCuisineEv: number;
  distinctCuisines: number;
  cat: (c: string) => number; // cuisine score for a category, plus matching tag boosts
  savory: number; // real-restaurant cuisine score (everything that is not cafe / sweet / boba)
  sigEv: (name: string) => number; // exact behavioral-signal evidence count
  topCuisine: string | null;
};

function parseVector(features: FeatureScore[]): Vector {
  const cuisines = bucketFrom(features, "cuisine");
  const tags = bucketFrom(features, "tag");
  const signals = bucketFrom(features, "signal");

  const totalCuisine = [...cuisines.values()].reduce((s, v) => s + v.score, 0);
  const totalCuisineEv = [...cuisines.values()].reduce((s, v) => s + v.ev, 0);

  const boosts: Record<string, string[]> = {
    veg: ["veg", "vegan", "vegetarian", "plant"],
    spicy: ["spicy", "chil", "hot", "heat", "curry"],
  };
  const cat = (c: string) => scoreWhere(cuisines, CATEGORIES[c]) + (boosts[c] ? scoreWhere(tags, boosts[c]) : 0);
  const savory = Math.max(0, totalCuisine - scoreWhere(cuisines, CATEGORIES.cafe) - scoreWhere(cuisines, CATEGORIES.sweet) - scoreWhere(cuisines, CATEGORIES.boba));
  const sigEv = (name: string) => signals.get(name)?.ev ?? 0;

  let topCuisine: string | null = null;
  let topScore = 0;
  for (const [name, v] of cuisines) if (v.score > topScore) { topScore = v.score; topCuisine = name; }

  return { cuisines, tags, signals, totalCuisine, totalCuisineEv, distinctCuisines: cuisines.size, cat, savory, sigEv, topCuisine };
}

export function deriveTraits(features: FeatureScore[], opts: { recentCheckIns?: number } = {}): Trait[] {
  const v = parseVector(features);
  const recentCheckIns = opts.recentCheckIns ?? 0;
  const enough = v.totalCuisineEv >= MIN_CUISINE_EVIDENCE;
  const share = (n: number) => (v.totalCuisine > 0 ? n / v.totalCuisine : 0);
  const pct = (n: number) => Math.round(share(n) * 100);

  const cafeShare = share(v.cat("cafe"));
  const savoryShare = share(v.savory);

  const rules: Record<string, { earned: boolean; detail: string }> = {};
  const classRule = (id: string, category: string, noun: string) => {
    const cs = v.cat(category);
    const earned = enough && v.totalCuisine > 0 && cs / v.totalCuisine >= CLASS_SHARE;
    rules[id] = { earned, detail: earned ? `${pct(cs)}% of your food is ${noun}.` : META.get(id)!.how };
  };
  classRule("brotein", "meat", "meat-forward");
  classRule("koala", "veg", "vegetarian or vegan");
  classRule("spicy_poops", "spicy", "fiery and spice-led");
  classRule("send_noodz", "noodle", "noodles and broth");
  classRule("sweaty", "sweet", "dessert and bakeries");
  classRule("raw_deal", "sushi", "sushi and raw bar");
  classRule("brunch_girlie", "cafe", "cafes and coffee");
  classRule("boba_addict", "boba", "boba and tea");

  const anyClass = Object.values(rules).some((r) => r.earned);
  const wide = enough && v.distinctCuisines >= EXPLORER_CUISINES;
  const dislikes = v.sigEv("disliked");
  const likes = v.sigEv("liked") + v.sigEv("loved");

  const simple = (id: string, earned: boolean, detail: string) => {
    rules[id] = { earned, detail: earned ? detail : META.get(id)!.how };
  };
  simple("explorer", wide, `${v.distinctCuisines} different cuisines on your map.`);
  simple("eater", wide && !anyClass, "A bit of everything, no single lane.");
  simple("value_meal", enough && v.sigEv("value") >= VALUE_MIN_EVIDENCE, "You go for great value.");
  simple("picky_eater", dislikes >= PICKY_MIN_DISLIKES && dislikes > likes, "You rule places out more than you rave.");
  simple("munch", recentCheckIns > MUNCH_PER_WEEK, `${recentCheckIns} times out to eat this past week.`);
  simple("follower", v.sigEv("followed_trend") >= FOLLOWER_MIN, "You keep up with what is trending.");
  simple("girl_dinner", enough && cafeShare >= 0.5 && savoryShare <= 0.1, "Cafes, rarely a sit-down meal.");
  simple("boy_dinner", enough && savoryShare >= 0.85, "Sit-down restaurants, and not much else.");

  return TRAIT_CATALOG.map((m) => ({ ...m, earned: rules[m.id]?.earned ?? false, detail: rules[m.id]?.detail ?? m.how }));
}

// Short, human, one-line insights for the account "what hungr has learned" section. Deterministic:
// each sentence only appears when its condition holds. Returns strongest-first, capped.
export function deriveTasteInsights(features: FeatureScore[], opts: { recentCheckIns?: number } = {}): string[] {
  const v = parseVector(features);
  const recentCheckIns = opts.recentCheckIns ?? 0;
  const out: string[] = [];

  const dislikes = v.sigEv("disliked");
  const likes = v.sigEv("liked") + v.sigEv("loved");
  const saved = v.sigEv("go");
  const visited = v.sigEv("checked_in");

  if (dislikes >= PICKY_MIN_DISLIKES && dislikes > likes) {
    out.push("You are a picky eater: you rule places out more than you rave about them.");
  }
  if (v.topCuisine && v.totalCuisineEv >= MIN_CUISINE_EVIDENCE) {
    out.push(`You gravitate toward ${titleCase(v.topCuisine)} more than anything else.`);
  }
  if (recentCheckIns > MUNCH_PER_WEEK) {
    out.push(`You eat out a lot: ${recentCheckIns} visits in the last week.`);
  } else if (saved >= 5 && saved >= visited * 2) {
    out.push("You are a deep planner: plenty saved, fewer visited so far.");
  }
  if (v.distinctCuisines >= EXPLORER_CUISINES) {
    out.push(`You love variety: ${v.distinctCuisines} different cuisines and counting.`);
  }
  if (v.sigEv("value") >= VALUE_MIN_EVIDENCE) {
    out.push("You keep an eye out for good value.");
  }
  if (v.totalCuisine > 0 && v.cat("cafe") / v.totalCuisine >= 0.4) {
    out.push("Cafes are your happy place.");
  }

  return out.slice(0, 4);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
