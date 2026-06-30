import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { MapCanvas } from "../../src/components/MapCanvas";
import { SearchBar } from "../../src/components/SearchBar";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { PlaceSheet } from "../../src/components/PlaceSheet";
import { PreferencesSheet } from "../../src/components/PreferencesSheet";
import { FindFoodPopup } from "../../src/components/FindFoodPopup";
import { PlacesListSheet } from "../../src/components/PlacesListSheet";
import { PlaceFeedbackPrompt } from "../../src/components/PlaceFeedbackPrompt";
import { searchNearby, withFirstPartyCuisines, withUserPlaceStates, applyFilters, mergePlaces } from "../../src/api/places";
import { loadSuppressedCuisines } from "../../src/api/preferences";
import { setUserPlaceState, savePlaceFeedback } from "../../src/api/userPlaces";
import { saveCommunityReview } from "../../src/api/community";
import { checkIn, getVisitCount } from "../../src/api/checkins";
import { friendBeens } from "../../src/api/social";
import { useFilters } from "../../src/store/useFilters";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { CUISINE_GROUPS } from "../../src/domain/cuisines";
import { colors, space } from "../../src/theme";
import type { Place, PlaceState } from "../../src/domain/types";

export default function Map() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState({ latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showList, setShowList] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [searchOverride, setSearchOverride] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ place: Place; state: "been" | "avoid" } | null>(null);
  const [friendsBeen, setFriendsBeen] = useState<Set<string>>(new Set());
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const { selected: sel, suppressed, setSuppressed } = useFilters();

  // Debounce the query so we do not hit the Places proxy on every keystroke.
  const debouncedQuery = useDebouncedValue(query, 300);
  // Monotonic request id so a slow earlier response cannot overwrite a newer one.
  const reqId = useRef(0);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion((r) => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
      }
      // graceful denial: keep the default Sydney region
    })();
  }, []);

  // Load the saved avoid list so the map reflects the user's taste from the first render.
  useEffect(() => {
    loadSuppressedCuisines().then(setSuppressed).catch(() => {});
  }, [setSuppressed]);

  // Places friends (and people you follow) have been, to power the "Friends Been" filter.
  useEffect(() => {
    friendBeens().then((b) => setFriendsBeen(new Set(b.map((x) => x.placeId)))).catch(() => {});
  }, []);

  // The signed-in user's private visit count for the open place (never shown to anyone else).
  useEffect(() => {
    if (!selected) { setVisitCount(0); return; }
    let active = true;
    getVisitCount(selected.placeId).then((n) => { if (active) setVisitCount(n); }).catch(() => {});
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    const id = ++reqId.current;
    const searchText = searchOverride ?? (debouncedQuery || "food");
    searchNearby(region.latitude, region.longitude, searchText)
      .then(withFirstPartyCuisines)
      .then(withUserPlaceStates)
      .then((result) => {
        if (id === reqId.current) setPlaces((prev) => mergePlaces(prev, result)); // ignore stale responses
      })
      .catch(() => {});
  }, [region.latitude, region.longitude, debouncedQuery, searchOverride, refresh]);

  function submitSearch() {
    setSelected(null);
    setShowList(false);
    setSearchOverride(query.trim() || "food");
    setRefresh((n) => n + 1);
    setShowFind(true);
  }

  async function setState(placeId: string, state: PlaceState) {
    const place = places.find((p) => p.placeId === placeId) ?? selected;
    try {
      const saved = await setUserPlaceState(placeId, state);
      if (!saved) return;
      setPlaces((ps) => ps.map((p) => (p.placeId === placeId ? { ...p, state } : p)));
      setSelected(null);
      if ((state === "been" || state === "avoid") && place) {
        setFeedback({ place: { ...place, state }, state });
      }
    } catch {
      return;
    }
  }

  const filtered = applyFilters(places, { selected: sel, suppressed });
  const visible = friendsOnly ? filtered.filter((p) => friendsBeen.has(p.placeId)) : filtered;
  const currentSelected = selected ? places.find((p) => p.placeId === selected.placeId) ?? selected : null;

  return (
    <View style={s.wrap}>
      <MapCanvas
        region={region}
        places={visible}
        selectedId={selected?.placeId}
        onSelect={(p) => { setShowFind(false); setSelected(p); }}
        onRegionChange={(r) =>
          setRegion((prev) => {
            // Only follow the viewport once it has moved a meaningful distance (~80m), so
            // search refires when the user pans but not on every tiny camera jitter.
            const moved =
              Math.abs(prev.latitude - r.latitude) > 0.0008 ||
              Math.abs(prev.longitude - r.longitude) > 0.0008;
            return moved ? r : prev;
          })
        }
      />
      {/* Cream strip so the full-bleed map does not run under the status bar / Dynamic Island. */}
      <View style={[s.statusStrip, { height: insets.top }]} pointerEvents="none" />
      <View style={[s.top, { top: insets.top + space.xs }]}>
        <SearchBar
          value={query}
          onChange={(text) => { setQuery(text); setSearchOverride(null); }}
          onPreferences={() => setShowPrefs(true)}
          onSubmit={submitSearch}
        />
        <CuisineFilter />
        {(friendsBeen.size > 0 || friendsOnly) && (
          <Pressable
            onPress={() => setFriendsOnly((v) => !v)}
            style={[s.friendsChip, friendsOnly && s.friendsChipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: friendsOnly }}
            accessibilityLabel="Show only places friends have been"
          >
            <Ionicons name="people" size={14} color={friendsOnly ? colors.onAccent : colors.been} />
            <Text style={[s.friendsChipTxt, friendsOnly && s.friendsChipOnTxt]}>Friends Been</Text>
          </Pressable>
        )}
      </View>
      {currentSelected && (
        <PlaceSheet
          place={currentSelected}
          onSetState={setState}
          onOpenDetail={(placeId) => router.push({ pathname: "/place/[placeId]", params: { placeId } })}
          visitCount={visitCount}
          onCheckIn={() => {
            checkIn(currentSelected.placeId).then((n) => { if (n !== null) setVisitCount(n); }).catch(() => {});
          }}
        />
      )}
      {showPrefs && <PreferencesSheet groups={CUISINE_GROUPS} onClose={() => setShowPrefs(false)} />}
      {!selected && !showPrefs && !showFind && !showList && (
        <Pressable
          style={s.findBtn}
          onPress={submitSearch}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={16} color={colors.onAccent} />
          <Text style={s.findTxt}>Find food near me</Text>
        </Pressable>
      )}
      {!selected && showFind && (
        <FindFoodPopup
          count={visible.length}
          onShowList={() => { setShowFind(false); setShowList(true); }}
          onClose={() => setShowFind(false)}
        />
      )}
      {showList && (
        <PlacesListSheet
          places={visible}
          onSelect={(p) => { setShowList(false); setSelected(p); }}
          onClose={() => setShowList(false)}
        />
      )}
      {feedback && (
        <PlaceFeedbackPrompt
          placeName={feedback.place.name}
          state={feedback.state}
          onClose={() => setFeedback(null)}
          onSubmit={(r) => {
            savePlaceFeedback(feedback.place.placeId, {
              rating: feedback.state === "been" ? r.rating : null,
              avoidReason: feedback.state === "avoid" ? r.reason : null,
              note: r.note.trim() || null,
            }).catch(() => {});
            if (feedback.state === "been" && r.note.trim()) {
              saveCommunityReview(feedback.place.placeId, { body: r.note, rating: r.rating }).catch(() => {});
            }
          }}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.canvas, zIndex: 1 },
  top: { position: "absolute", left: space.sm, right: space.sm, gap: space.xs, zIndex: 2 },
  findBtn: {
    position: "absolute", bottom: space.xxl, alignSelf: "center", flexDirection: "row", alignItems: "center",
    gap: space.xs, backgroundColor: colors.accent, borderRadius: 9999, paddingHorizontal: space.lg,
    paddingVertical: space.sm, minHeight: 44, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  findTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
  friendsChip: {
    flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start",
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: 9999,
    paddingHorizontal: space.md, paddingVertical: 8,
  },
  friendsChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  friendsChipTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  friendsChipOnTxt: { color: colors.onAccent },
});
