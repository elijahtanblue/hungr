import { create } from "zustand";

type FilterState = {
  selected: string[];      // cuisines the user is filtering to (empty = all)
  suppressed: string[];    // cuisines to hide (the avoid list)
  toggleSelected: (c: string) => void;
  toggleSuppressed: (c: string) => void;
};

export const useFilters = create<FilterState>((set) => ({
  selected: [],
  suppressed: [],
  toggleSelected: (c) =>
    set((s) => ({ selected: s.selected.includes(c) ? s.selected.filter((x) => x !== c) : [...s.selected, c] })),
  toggleSuppressed: (c) =>
    set((s) => ({ suppressed: s.suppressed.includes(c) ? s.suppressed.filter((x) => x !== c) : [...s.suppressed, c] })),
}));
