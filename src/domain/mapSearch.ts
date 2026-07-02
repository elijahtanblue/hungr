export type MapSearchMode = "typed" | "nearby";
export type SearchSubmitMode = MapSearchMode | "ai";
export type SearchRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function searchTextForAction(mode: MapSearchMode, typedQuery: string): string {
  if (mode === "nearby") return "food";
  return typedQuery.trim();
}

export function listTitleForSearchMode(mode: MapSearchMode, typedQuery: string): string {
  if (mode === "nearby") return "Food near you";
  const query = typedQuery.trim();
  return query ? `Search results for "${query}"` : "Search results";
}

export function nearbySearchRegion(currentMapRegion: SearchRegion, _deviceRegion?: SearchRegion): SearchRegion {
  return currentMapRegion;
}

export function queryAfterSubmit(mode: SearchSubmitMode, currentQuery: string): string {
  return mode === "ai" ? "" : currentQuery;
}
