import { create } from "zustand";
import type { PlaceState } from "../domain/types";

export type Preference = "prioritise" | "avoid" | "neutral";
export type SortBy = "rating" | "price" | "distance";
export type ShowState = "all" | PlaceState;

export type MinRating = 3 | 3.5 | 4 | 4.5 | null;

type FilterState = {
  selected: string[];      // cuisines the user is filtering to (empty = all)
  suppressed: string[];    // cuisines to hide (the avoid list)
  budgetMax: 1 | 2 | 3 | 4 | null;
  withinKm: 2 | 5 | 10 | 25 | 50;
  minRating: MinRating;    // hide places rated below this (null = any)
  openNow: boolean;        // only show places open now (server-side Google filter)
  sortBy: SortBy;
  showState: ShowState;
  toggleSelected: (c: string) => void;
  toggleSuppressed: (c: string) => void;
  setBudgetMax: (value: 1 | 2 | 3 | 4 | null) => void;
  setWithinKm: (value: 2 | 5 | 10 | 25 | 50) => void;
  setMinRating: (value: MinRating) => void;
  setOpenNow: (value: boolean) => void;
  setSortBy: (value: SortBy) => void;
  setShowState: (value: ShowState) => void;
  // Mutually exclusive preference, used by the Preferences sheet: a cuisine is either
  // prioritised, avoided, or neutral, never both at once.
  setPreference: (c: string, pref: Preference) => void;
  // Replace the avoid list wholesale, used when loading saved preferences on startup.
  setSuppressed: (list: string[]) => void;
};

export const useFilters = create<FilterState>((set) => ({
  selected: [],
  suppressed: [],
  budgetMax: null,
  withinKm: 50,
  minRating: null,
  openNow: false,
  sortBy: "rating",
  showState: "all",
  // Selecting and suppressing are mutually exclusive: a cuisine is never in both lists,
  // otherwise suppression would silently hide a cuisine the user explicitly filtered to.
  toggleSelected: (c) =>
    set((s) => {
      const on = s.selected.includes(c);
      return {
        selected: on ? s.selected.filter((x) => x !== c) : [...s.selected, c],
        suppressed: on ? s.suppressed : s.suppressed.filter((x) => x !== c),
      };
    }),
  toggleSuppressed: (c) =>
    set((s) => {
      const off = s.suppressed.includes(c);
      return {
        suppressed: off ? s.suppressed.filter((x) => x !== c) : [...s.suppressed, c],
        selected: off ? s.selected : s.selected.filter((x) => x !== c),
      };
    }),
  setBudgetMax: (budgetMax) => set(() => ({ budgetMax })),
  setWithinKm: (withinKm) => set(() => ({ withinKm })),
  setMinRating: (minRating) => set(() => ({ minRating })),
  setOpenNow: (openNow) => set(() => ({ openNow })),
  setSortBy: (sortBy) => set(() => ({ sortBy })),
  setShowState: (showState) => set(() => ({ showState })),
  setPreference: (c, pref) =>
    set((s) => ({
      selected: pref === "prioritise" ? Array.from(new Set([...s.selected, c])) : s.selected.filter((x) => x !== c),
      suppressed: pref === "avoid" ? Array.from(new Set([...s.suppressed, c])) : s.suppressed.filter((x) => x !== c),
    })),
  setSuppressed: (list) => set(() => ({ suppressed: list })),
}));
