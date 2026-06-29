import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { MapCanvas } from "../../src/components/MapCanvas";
import { SearchBar } from "../../src/components/SearchBar";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { PlaceSheet } from "../../src/components/PlaceSheet";
import { PreferencesSheet } from "../../src/components/PreferencesSheet";
import { FindFoodPopup } from "../../src/components/FindFoodPopup";
import { searchNearby, withFirstPartyCuisines, applyFilters } from "../../src/api/places";
import { loadSuppressedCuisines } from "../../src/api/preferences";
import { setUserPlaceState } from "../../src/api/userPlaces";
import { useFilters } from "../../src/store/useFilters";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { colors, space } from "../../src/theme";
import type { Place, PlaceState } from "../../src/domain/types";

const CUISINES = ["Chinese", "Korean", "Japanese", "Thai", "Vietnamese", "Indian"];

export default function Map() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState({ latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [refresh, setRefresh] = useState(0);
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

  useEffect(() => {
    const id = ++reqId.current;
    searchNearby(region.latitude, region.longitude, debouncedQuery || "food")
      .then(withFirstPartyCuisines)
      .then((result) => {
        if (id === reqId.current) setPlaces(result); // ignore stale responses
      })
      .catch(() => {
        if (id === reqId.current) setPlaces([]);
      });
  }, [region.latitude, region.longitude, debouncedQuery, refresh]);

  async function setState(placeId: string, state: PlaceState) {
    try {
      const saved = await setUserPlaceState(placeId, state);
      if (!saved) return;
      setPlaces((ps) => ps.map((p) => (p.placeId === placeId ? { ...p, state } : p)));
      setSelected(null);
    } catch {
      return;
    }
  }

  const visible = applyFilters(places, { selected: sel, suppressed });

  return (
    <View style={s.wrap}>
      <MapCanvas region={region} places={visible} onSelect={setSelected} />
      <View style={s.top}>
        <SearchBar value={query} onChange={setQuery} onPreferences={() => setShowPrefs(true)} />
        <CuisineFilter cuisines={CUISINES} />
      </View>
      {selected && (
        <PlaceSheet
          place={selected}
          onSetState={setState}
          onOpenDetail={(placeId) => router.push({ pathname: "/place/[placeId]", params: { placeId } })}
        />
      )}
      {showPrefs && <PreferencesSheet cuisines={CUISINES} onClose={() => setShowPrefs(false)} />}
      {!selected && !showPrefs && !showFind && (
        <Pressable
          style={s.findBtn}
          onPress={() => { setRefresh((n) => n + 1); setShowFind(true); }}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={16} color={colors.onAccent} />
          <Text style={s.findTxt}>Find food near me</Text>
        </Pressable>
      )}
      {showFind && <FindFoodPopup count={visible.length} onClose={() => setShowFind(false)} />}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  top: { position: "absolute", top: space.xxl, left: space.sm, right: space.sm, gap: space.xs },
  findBtn: {
    position: "absolute", bottom: space.xxl, alignSelf: "center", flexDirection: "row", alignItems: "center",
    gap: space.xs, backgroundColor: colors.accent, borderRadius: 9999, paddingHorizontal: space.lg,
    paddingVertical: space.sm, minHeight: 44, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  findTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
});
