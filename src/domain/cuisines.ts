// The app's food vocabulary, split into two groups for the preferences UI:
//   - CUISINES: national / regional kitchens ("choose a cuisine")
//   - FOODS:    dishes, formats, and drinks ("choose a food")
//
// Auto-tagging: Google's place-type taxonomy is finite. Labels with a matching Google type
// (see supabase/functions/places-proxy: TYPE_TO_CUISINE) are derived automatically. The rest
// (e.g. Nepalese, Malaysian, Filipino, Dim Sum, Bubble Tea) have NO Google type and are
// first-party categories: still selectable here and tagged by hand. Keep this in sync with
// the server map.

export const CUISINES: string[] = [
  "Afghan",
  "African",
  "American",
  "Argentinian",
  "Asian",
  "Brazilian",
  "British",
  "Cambodian",
  "Caribbean",
  "Chinese",
  "Cuban",
  "Egyptian",
  "Ethiopian",
  "Filipino",
  "French",
  "German",
  "Greek",
  "Hawaiian",
  "Indian",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Laotian",
  "Lebanese",
  "Malaysian",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Mongolian",
  "Moroccan",
  "Nepalese",
  "Pakistani",
  "Persian",
  "Peruvian",
  "Polish",
  "Portuguese",
  "Russian",
  "Singaporean",
  "Spanish",
  "Sri Lankan",
  "Taiwanese",
  "Thai",
  "Tibetan",
  "Turkish",
  "Vietnamese",
];

export const FOODS: string[] = [
  "Bakery",
  "Bar",
  "BBQ",
  "Breakfast",
  "Brunch",
  "Bubble Tea",
  "Burgers",
  "Cafe",
  "Deli",
  "Dessert",
  "Dim Sum",
  "Dumplings",
  "Fast Food",
  "Fine Dining",
  "Fried Chicken",
  "Hot Pot",
  "Ice Cream",
  "Juice",
  "Noodles",
  "Pizza",
  "Pub",
  "Ramen",
  "Salad",
  "Sandwiches",
  "Seafood",
  "Steakhouse",
  "Sushi",
  "Tacos",
  "Tea",
  "Vegan",
  "Vegetarian",
  "Wine Bar",
];

// Combined list, kept for any consumer that wants every label in one array.
export const ALL_CUISINES: string[] = [...CUISINES, ...FOODS];

export const CUISINE_GROUPS: { label: string; items: string[] }[] = [
  { label: "Cuisine", items: CUISINES },
  { label: "Food", items: FOODS },
];
