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
  setPreference: (c, pref) =>
    set((s) => ({
      selected: pref === "prioritise" ? Array.from(new Set([...s.selected, c])) : s.selected.filter((x) => x !== c),
      suppressed: pref === "avoid" ? Array.from(new Set([...s.suppressed, c])) : s.suppressed.filter((x) => x !== c),
    })),
  setSuppressed: (list) => set(() => ({ suppressed: list })),
}));
