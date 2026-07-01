import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import { useFilters } from "../store/useFilters";
import { saveSuppressedCuisines } from "../api/preferences";

const BUDGET_OPTIONS = [
  { label: "Any", value: null },
  { label: "$", value: 1 },
  { label: "$$", value: 2 },
  { label: "$$$", value: 3 },
  { label: "$$$$", value: 4 },
] as const;
const WITHIN_OPTIONS = [2, 5, 10, 25, 50] as const;
const MIN_RATING_OPTIONS = [
  { label: "Any", value: null },
  { label: "3.0+", value: 3 },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
] as const;
const SORT_OPTIONS = [
  { label: "Rating", value: "rating" },
  { label: "Price", value: "price" },
  { label: "Distance", value: "distance" },
] as const;
const SHOW_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Saved", value: "go" },
  { label: "Liked", value: "liked" },
  { label: "Loved", value: "loved" },
  { label: "Disliked", value: "disliked" },
] as const;

// State 3 from DESIGN.md: a bottom sheet to set taste. Prioritise (golden) floats results to
// the top, Avoid (clay) hides them on the map. The avoid list persists to the user's profile.
// The list is split into Cuisine / Food groups via a toggle so the long list is browsable.
export function PreferencesSheet({ groups, onClose }: { groups: { label: string; items: string[] }[]; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const [openMenu, setOpenMenu] = useState<"budget" | "within" | "rating" | "sort" | "show" | null>(null);
  const selected = useFilters((s) => s.selected);
  const suppressed = useFilters((s) => s.suppressed);
  const budgetMax = useFilters((s) => s.budgetMax);
  const withinKm = useFilters((s) => s.withinKm);
  const minRating = useFilters((s) => s.minRating);
  const openNow = useFilters((s) => s.openNow);
  const sortBy = useFilters((s) => s.sortBy);
  const showState = useFilters((s) => s.showState);
  const setPreference = useFilters((s) => s.setPreference);
  const setBudgetMax = useFilters((s) => s.setBudgetMax);
  const setWithinKm = useFilters((s) => s.setWithinKm);
  const setMinRating = useFilters((s) => s.setMinRating);
  const setOpenNow = useFilters((s) => s.setOpenNow);
  const setSortBy = useFilters((s) => s.setSortBy);
  const setShowState = useFilters((s) => s.setShowState);

  function choose(c: string, isOn: boolean, target: "prioritise" | "avoid") {
    setPreference(c, isOn ? "neutral" : target);
    // Persist the avoid list from the freshly updated store state.
    saveSuppressedCuisines(useFilters.getState().suppressed).catch(() => {});
  }

  const items = groups[tab]?.items ?? [];
  const budgetLabel = BUDGET_OPTIONS.find((o) => o.value === budgetMax)?.label ?? "Any";
  const ratingLabel = MIN_RATING_OPTIONS.find((o) => o.value === minRating)?.label ?? "Any";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Rating";
  const showLabel = SHOW_OPTIONS.find((o) => o.value === showState)?.label ?? "All";

  return (
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close preferences" />
      <View style={s.sheet}>
        <View style={s.grab} />
        <View style={s.header}>
          <Text style={s.title}>Your taste</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={s.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView style={s.body} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={s.bodyContent}>
        <Text style={s.help}>Prioritise what you love. Skip what you're not in the mood for.</Text>
        <View style={s.filterGrid}>
          <View style={s.filterCell}>
            <Text style={s.filterLabel}>Budget</Text>
            <Pressable style={s.filterBtn} onPress={() => setOpenMenu(openMenu === "budget" ? null : "budget")} accessibilityRole="button">
              <Text style={s.filterBtnTxt}>{budgetLabel}</Text>
            </Pressable>
          </View>
          <View style={s.filterCell}>
            <Text style={s.filterLabel}>Within</Text>
            <Pressable style={s.filterBtn} onPress={() => setOpenMenu(openMenu === "within" ? null : "within")} accessibilityRole="button">
              <Text style={s.filterBtnTxt}>{withinKm}km</Text>
            </Pressable>
          </View>
          <View style={s.filterCell}>
            <Text style={s.filterLabel}>Min rating</Text>
            <Pressable style={s.filterBtn} onPress={() => setOpenMenu(openMenu === "rating" ? null : "rating")} accessibilityRole="button">
              <Text style={s.filterBtnTxt}>{ratingLabel === "Any" ? "Any" : `★ ${ratingLabel}`}</Text>
            </Pressable>
          </View>
          <View style={s.filterCell}>
            <Text style={s.filterLabel}>Sort by</Text>
            <Pressable style={s.filterBtn} onPress={() => setOpenMenu(openMenu === "sort" ? null : "sort")} accessibilityRole="button">
              <Text style={s.filterBtnTxt}>{sortLabel}</Text>
            </Pressable>
          </View>
          <View style={s.filterCell}>
            <Text style={s.filterLabel}>Show</Text>
            <Pressable style={s.filterBtn} onPress={() => setOpenMenu(openMenu === "show" ? null : "show")} accessibilityRole="button">
              <Text style={s.filterBtnTxt}>{showLabel}</Text>
            </Pressable>
          </View>
        </View>
        {openMenu === "budget" && (
          <View style={s.menu}>
            {BUDGET_OPTIONS.map((o) => (
              <Pressable key={o.label} onPress={() => { setBudgetMax(o.value); setOpenMenu(null); }} style={s.menuItem} accessibilityRole="button">
                <Text style={s.menuTxt}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {openMenu === "within" && (
          <View style={s.menu}>
            {WITHIN_OPTIONS.map((km) => (
              <Pressable key={km} onPress={() => { setWithinKm(km); setOpenMenu(null); }} style={s.menuItem} accessibilityRole="button">
                <Text style={s.menuTxt}>{km}km</Text>
              </Pressable>
            ))}
          </View>
        )}
        {openMenu === "rating" && (
          <View style={s.menu}>
            {MIN_RATING_OPTIONS.map((o) => (
              <Pressable key={o.label} onPress={() => { setMinRating(o.value); setOpenMenu(null); }} style={s.menuItem} accessibilityRole="button">
                <Text style={s.menuTxt}>{o.label === "Any" ? "Any" : `★ ${o.label}`}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {openMenu === "sort" && (
          <View style={s.menu}>
            {SORT_OPTIONS.map((o) => (
              <Pressable key={o.value} onPress={() => { setSortBy(o.value); setOpenMenu(null); }} style={s.menuItem} accessibilityRole="button">
                <Text style={s.menuTxt}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {openMenu === "show" && (
          <View style={s.menu}>
            {SHOW_OPTIONS.map((o) => (
              <Pressable key={o.value} onPress={() => { setShowState(o.value); setOpenMenu(null); }} style={s.menuItem} accessibilityRole="button">
                <Text style={s.menuTxt}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          style={[s.openNowRow, openNow && s.openNowRowOn]}
          onPress={() => setOpenNow(!openNow)}
          accessibilityRole="switch"
          accessibilityState={{ checked: openNow }}
        >
          <Text style={[s.openNowTxt, openNow && s.openNowTxtOn]}>Open now</Text>
          <View style={[s.toggle, openNow && s.toggleOn]}>
            <View style={[s.knob, openNow && s.knobOn]} />
          </View>
        </Pressable>
        <View style={s.tabs}>
          {groups.map((g, i) => (
            <Pressable
              key={g.label}
              onPress={() => setTab(i)}
              style={[s.tab, i === tab && s.tabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: i === tab }}
            >
              <Text style={[s.tabTxt, i === tab && s.tabOnTxt]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.list}>
          {items.map((c) => {
            const isP = selected.includes(c);
            const isA = suppressed.includes(c);
            return (
              <View key={c} style={s.row}>
                <Text style={s.name}>{c}</Text>
                <View style={s.actions}>
                  <Pressable onPress={() => choose(c, isP, "prioritise")} style={[s.pill, isP && s.pillP]}>
                    <Text style={[s.pillTxt, isP && s.pillPTxt]}>Prioritise</Text>
                  </Pressable>
                  <Pressable onPress={() => choose(c, isA, "avoid")} style={[s.pill, isA && s.pillA]}>
                    <Text style={[s.pillTxt, isA && s.pillATxt]}>Avoid</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(28,26,23,0.25)" },
  // Half view: opens tall enough for the filters (budget, within, rating, sort, show, open now) but
  // stops well below the search bar instead of melting into it. The cuisine / food list sits below
  // the fold, revealed by scrolling, so opening preferences does not dump the whole long list.
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xl, maxHeight: "58%",
    shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: space.md },
  grab: { width: 34, height: 4, borderRadius: 99, backgroundColor: colors.hair, alignSelf: "center", marginBottom: space.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  done: { fontSize: 16, fontWeight: "700", color: colors.accentPress },
  help: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: space.md },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  filterCell: { width: "48%", gap: 4 },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  filterBtn: { minHeight: 40, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.canvas, justifyContent: "center", paddingHorizontal: space.md },
  filterBtnTxt: { color: colors.ink, fontWeight: "800" },
  menu: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginBottom: space.sm },
  menuItem: { borderColor: colors.hair, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7 },
  menuTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  openNowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
  openNowRowOn: { borderColor: colors.been, backgroundColor: "#E7F0E5" },
  openNowTxt: { fontSize: 14, fontWeight: "800", color: colors.ink },
  openNowTxtOn: { color: colors.been },
  toggle: { width: 42, height: 24, borderRadius: 12, backgroundColor: colors.hair, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.been },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  knobOn: { alignSelf: "flex-end" },
  tabs: { flexDirection: "row", gap: space.xs, backgroundColor: colors.canvas, borderRadius: radius.pill, padding: 4, marginBottom: space.sm },
  tab: { flex: 1, alignItems: "center", paddingVertical: space.sm, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  tabTxt: { fontSize: 14, fontWeight: "700", color: colors.muted },
  tabOnTxt: { color: colors.ink },
  list: {},
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  name: { fontSize: 16, fontWeight: "600", color: colors.ink },
  actions: { flexDirection: "row", gap: space.sm },
  pill: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  pillP: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillA: { borderColor: colors.avoid },
  pillTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  pillPTxt: { color: colors.onAccent },
  pillATxt: { color: colors.avoid },
});
