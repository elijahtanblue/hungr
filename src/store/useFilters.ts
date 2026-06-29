import { create } from "zustand";

export type Preference = "prioritise" | "avoid" | "neutral";

type FilterState = {
  selected: string[];      // cuisines the user is filtering to (empty = all)
  suppressed: string[];    // cuisines to hide (the avoid list)
  toggleSelected: (c: string) => void;
  toggleSuppressed: (c: string) => void;
  // Mutually exclusive preference, used by the Preferences sheet: a cuisine is either
  // prioritised, avoided, or neutral, never both at once.
  setPreference: (c: string, pref: Preference) => void;
  // Replace the avoid list wholesale, used when loading saved preferences on startup.
  setSuppressed: (list: string[]) => void;
};

export const useFilters = create<FilterState>((set) => ({
  selected: [],
  suppressed: [],
  toggleSelected: (c) =>
    set((s) => ({ selected: s.selected.includes(c) ? s.selected.filter((x) => x !== c) : [...s.selected, c] })),
  toggleSuppressed: (c) =>
    set((s) => ({ suppressed: s.suppressed.includes(c) ? s.suppressed.filter((x) => x !== c) : [...s.suppressed, c] })),
  setPreference: (c, pref) =>
    set((s) => ({
      selected: pref === "prioritise" ? Array.from(new Set([...s.selected, c])) : s.selected.filter((x) => x !== c),
      suppressed: pref === "avoid" ? Array.from(new Set([...s.suppressed, c])) : s.suppressed.filter((x) => x !== c),
    })),
  setSuppressed: (list) => set(() => ({ suppressed: list })),
}));
