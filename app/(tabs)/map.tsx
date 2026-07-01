import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { MapCanvas } from "../../src/components/MapCanvas";
import { SearchBar } from "../../src/components/SearchBar";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { PlaceSheet } from "../../src/components/PlaceSheet";
import { PreferencesSheet } from "../../src/components/PreferencesSheet";
import { PlacesListSheet } from "../../src/components/PlacesListSheet";
import { PlaceFeedbackPrompt } from "../../src/components/PlaceFeedbackPrompt";
import { searchNearbyPage, withFirstPartyCuisines, withUserPlaceStates, applyFilters, mergePlaces } from "../../src/api/places";
import { getPlaceDetails, type PlaceDetails } from "../../src/api/placeDetails";
import { prefetchPhotoUri } from "../../src/api/placePhotos";
import { getCommunity } from "../../src/api/community";
import { spreadOverlappingPins } from "../../src/domain/spreadPins";
import { getPlaceGuides, annotateGuides, type PlaceGuide } from "../../src/api/guides";
import { getFirstPartyFacts, annotateFacts, type FirstPartyFact } from "../../src/api/firstPartyFacts";
import { enqueueMenuEnrich } from "../../src/api/menuEnrich";
import { loadSuppressedCuisines } from "../../src/api/preferences";
import { setUserPlaceState, clearUserPlaceState } from "../../src/api/userPlaces";
import { saveReviewFeedback } from "../../src/api/reviewFeedback";
import { checkIn, getVisitStatus, type VisitStatus } from "../../src/api/checkins";
import { getSavedPlacePins } from "../../src/api/savedPins";
import { friendBeens, ensureFollowingFounder } from "../../src/api/social";
import { useFilters } from "../../src/store/useFilters";
import { CUISINE_GROUPS } from "../../src/domain/cuisines";
import { nearbySearchRegion, listTitleForSearchMode, searchTextForAction, type MapSearchMode } from "../../src/domain/mapSearch";
import { colors, space } from "../../src/theme";
import type { Place, PlaceState } from "../../src/domain/types";

const BACKGROUND_PLACE_PAGES = 2;
const SEARCH_PHOTO_PREFETCH_LIMIT = 12;

async function hydratePlaces(page: Place[]): Promise<Place[]> {
  return withUserPlaceStates(await withFirstPartyCuisines(page));
}

function warmPlacePhotos(places: Place[]) {
  const seen = new Set<string>();
  for (const place of places) {
    if (!place.photoName || seen.has(place.photoName)) continue;
    seen.add(place.photoName);
    prefetchPhotoUri(place.photoName, 450).catch(() => {});
    if (seen.size >= SEARCH_PHOTO_PREFETCH_LIMIT) return;
  }
}

export default function Map() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState({ latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showList, setShowList] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [activeSearchText, setActiveSearchText] = useState("food");
  const [listMode, setListMode] = useState<MapSearchMode>("nearby");
  const [listQuery, setListQuery] = useState("");
  const [feedback, setFeedback] = useState<{ place: Place; state: "liked" | "loved" | "disliked" } | null>(null);
  const [friendsBeen, setFriendsBeen] = useState<Set<string>>(new Set());
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [visitStatus, setVisitStatus] = useState<VisitStatus>({ count: 0, checkedInRecently: false });
  const [cardPhoto, setCardPhoto] = useState<string | null>(null);
  const [cardAddress, setCardAddress] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<{ openNow?: boolean; nextCloseTime?: string; weekdayDescriptions?: string[]; periods?: PlaceDetails["periods"]; takeout?: boolean; dineIn?: boolean; delivery?: boolean }>({});
  const [cardReview, setCardReview] = useState<{ body: string; rating: number | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [home, setHome] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedPins, setSavedPins] = useState<Place[]>([]);
  const [guides, setGuides] = useState<Record<string, PlaceGuide>>({});
  const [facts, setFacts] = useState<Record<string, FirstPartyFact>>({});
  // Basic vs AI search mode. The occasion presets (date night, etc.) are backend-only now; AI search
  // (Phase 2) will parse free text into a structured query and rank via the intent engine.
  const [aiMode, setAiMode] = useState(false);
  const {
    selected: sel,
    suppressed,
    budgetMax,
    withinKm,
    minRating,
    openNow,
    sortBy,
    showState,
    setSuppressed,
    setOpenNow,
  } = useFilters();

  // Monotonic request id so a slow earlier response cannot overwrite a newer one.
  const reqId = useRef(0);
  // The search text behind the currently shown pins. A new search replaces them; panning the same
  // search merges, so the list always reflects what was actually searched.
  const lastSearchText = useRef<string | null>(null);
  // Set when the user submits a search, so the next batch of results recenters the map on the top
  // match (a one-shot, cleared once consumed).
  const focusOnResults = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setHome(here);
        setRegion((r) => ({ ...r, ...here }));
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

  // The user's own saved / imported places, resolved to pins so they always show on the map,
  // independent of the current search. Reloaded whenever the map regains focus, so a list imported
  // on another screen shows up on return.
  useFocusEffect(
    useCallback(() => {
      getSavedPlacePins().then(setSavedPins).catch(() => {});
    }, []),
  );

  // Make sure the user follows the founder account (idempotent, fail-soft).
  useEffect(() => {
    ensureFollowingFounder().catch(() => {});
  }, []);

  // "Show location" from a place detail routes here with the place's coordinates; center and open
  // it. Guarded by id so it fires once per navigation, not on every render.
  const focusParams = useLocalSearchParams<{ focusId?: string; focusLat?: string; focusLng?: string; focusName?: string }>();
  const focusedId = useRef<string | null>(null);
  useEffect(() => {
    const { focusId, focusLat, focusLng, focusName } = focusParams;
    if (!focusId || !focusLat || !focusLng || focusedId.current === focusId) return;
    const lat = Number(focusLat), lng = Number(focusLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    focusedId.current = focusId;
    focusPlace({ placeId: focusId, name: focusName ?? "", lat, lng, cuisines: [] });
  }, [focusParams]);

  // The signed-in user's private visit count for the open place (never shown to anyone else),
  // plus a photo and the user's own review to show directly on the card.
  useEffect(() => {
    if (!selected) {
      setVisitStatus({ count: 0, checkedInRecently: false });
      setCardPhoto(null);
      setCardAddress(null);
      setCardInfo({});
      setCardReview(null);
      return;
    }
    let active = true;
    const placeId = selected.placeId;
    setCardPhoto(null);
    setCardAddress(null);
    setCardInfo({});
    setCardReview(null);
    let didSetPhoto = false;
    const setFirstPhoto = (uri: string | null) => {
      if (!active || !uri || didSetPhoto) return;
      didSetPhoto = true;
      setCardPhoto(uri);
    };
    getVisitStatus(placeId).then((status) => { if (active) setVisitStatus(status); }).catch(() => {});
    if (selected.photoName) prefetchPhotoUri(selected.photoName, 450).then(setFirstPhoto).catch(() => {});
    // First live Google photo + address + hours/service options for the card (display only). All
    // come from the single details call we already make on tap, so no extra per-search cost.
    getPlaceDetails(placeId)
      .then((d) => {
        if (!active || !d) return;
        if (d.address) setCardAddress(d.address);
        setCardInfo({ openNow: d.openNow, nextCloseTime: d.nextCloseTime, weekdayDescriptions: d.weekdayDescriptions, periods: d.periods, takeout: d.takeout, dineIn: d.dineIn, delivery: d.delivery });
        const name = d.photos?.[0];
        if (name && name !== selected.photoName) {
          // Card image is shown small, so request a narrower width: faster transfer, lower latency.
          prefetchPhotoUri(name, 450).then(setFirstPhoto).catch(() => {});
        }
      })
      .catch(() => {});
    // The user's own review, so a rated place can show why they liked / disliked it.
    if (selected.state) {
      getCommunity(placeId)
        .then((c) => {
          const mine = c.reviews.find((r) => r.isMine);
          if (active && mine && mine.body) setCardReview({ body: mine.body, rating: mine.rating ?? null });
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    const id = ++reqId.current;
    const searchText = activeSearchText || "food";
    setLoading(true);
    searchNearbyPage(region.latitude, region.longitude, searchText, { radiusMeters: withinKm * 1000, openNow })
      .then(async ({ places: page, nextPageToken }) => {
        const result = await hydratePlaces(page);
        if (id !== reqId.current) return; // ignore stale responses
        setPlaces((prev) => (searchText === lastSearchText.current ? mergePlaces(prev, result) : result));
        warmPlacePhotos(result);
        setPageToken(nextPageToken);
        lastSearchText.current = searchText;
        setLoading(false);
        // Auto-zoom onto the best match for a freshly submitted search.
        if (focusOnResults.current && result.length > 0) {
          focusOnResults.current = false;
          const top = result[0];
          setRegion((r) => ({
            ...r,
            latitude: top.lat,
            longitude: top.lng,
            latitudeDelta: Math.min(r.latitudeDelta, 0.018),
            longitudeDelta: Math.min(r.longitudeDelta, 0.018),
          }));
        }
        if (!nextPageToken) return;
        setLoadingMore(true);
        let token: string | undefined = nextPageToken;
        for (let pageIndex = 0; pageIndex < BACKGROUND_PLACE_PAGES && token && id === reqId.current; pageIndex++) {
          try {
            const more = await searchNearbyPage(region.latitude, region.longitude, searchText, { radiusMeters: withinKm * 1000, openNow, pageToken: token });
            const moreResult = await hydratePlaces(more.places);
            if (id !== reqId.current) return;
            setPlaces((prev) => mergePlaces(prev, moreResult));
            warmPlacePhotos(moreResult);
            token = more.nextPageToken;
            setPageToken(token);
          } catch {
            break;
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      });
  }, [region.latitude, region.longitude, activeSearchText, refresh, withinKm, openNow]);

  // Lazily pull the next page of Google results as the user scrolls the list, so the search feels
  // endless without a slow first paint. Guarded so only one page loads at a time.
  function loadMorePlaces() {
    if (!pageToken || loadingMore) return;
    const token = pageToken;
    // Capture the current search generation so a page that resolves after the user starts a new
    // search (pan or type) is discarded instead of merging stale-query pins into fresh results.
    const id = reqId.current;
    setLoadingMore(true);
    searchNearbyPage(region.latitude, region.longitude, activeSearchText || "food", { radiusMeters: withinKm * 1000, openNow, pageToken: token })
      .then(async ({ places: page, nextPageToken }) => {
        const result = await hydratePlaces(page);
        if (id !== reqId.current) return;
        setPlaces((prev) => mergePlaces(prev, result));
        warmPlacePhotos(result);
        setPageToken(nextPageToken);
      })
      .catch(() => {})
      .finally(() => { if (id === reqId.current) setLoadingMore(false); });
  }

  // Curated guide awards (Michelin, hats) for every place currently on the map, fetched in one
  // batch whenever the visible set changes and merged in as display-only badges.
  useEffect(() => {
    const ids = Array.from(new Set([...places, ...savedPins].map((p) => p.placeId)));
    if (ids.length === 0) return;
    let active = true;
    getPlaceGuides(ids).then((g) => { if (active) setGuides(g); }).catch(() => {});
    return () => { active = false; };
  }, [places, savedPins]);

  // First-party facts (curated price band, dietary flags) for the visible set, fetched in one batch
  // and fed into the intent rule engine. Best-effort, exactly like the guide badges above. Also
  // nominates the search results for background menu enrichment (fire-and-forget; the server decides
  // what actually needs work), so coverage grows as people browse.
  useEffect(() => {
    const ids = Array.from(new Set([...places, ...savedPins].map((p) => p.placeId)));
    if (ids.length === 0) return;
    let active = true;
    getFirstPartyFacts(ids).then((f) => { if (active) setFacts(f); }).catch(() => {});
    enqueueMenuEnrich(places);
    return () => { active = false; };
  }, [places, savedPins]);

  // Select a place and ease the camera onto it, so a result the user picked is centered and zoomed.
  function focusPlace(p: Place) {
    setShowList(false);
    setSelected(p);
    setRegion((r) => ({
      ...r,
      latitude: p.lat,
      longitude: p.lng,
      latitudeDelta: Math.min(r.latitudeDelta, 0.014),
      longitudeDelta: Math.min(r.longitudeDelta, 0.014),
    }));
  }

  function submitTypedSearch() {
    setSelected(null);
    const q = searchTextForAction("typed", query);
    if (!q) return;
    setListMode("typed");
    setListQuery(q);
    setActiveSearchText(q);
    setPlaces([]);
    setLoading(true);
    lastSearchText.current = null;
    setRefresh((n) => n + 1);
    focusOnResults.current = true;
    setShowList(true);
  }

  function findFoodNearMe() {
    setSelected(null);
    setListMode("nearby");
    setListQuery("");
    // People tapping "find food near me" want somewhere open right now, so default to open-now.
    setOpenNow(true);
    setActiveSearchText(searchTextForAction("nearby", query));
    setPlaces([]);
    setLoading(true);
    lastSearchText.current = null;
    focusOnResults.current = false;
    setShowList(true);
    setRegion((r) => nearbySearchRegion(r));
    setRefresh((n) => n + 1);
  }

  async function recenterOnUser() {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setHome(here);
      setRegion((r) => ({ ...r, ...here, latitudeDelta: Math.min(r.latitudeDelta, 0.02), longitudeDelta: Math.min(r.longitudeDelta, 0.02) }));
    } catch {
      if (home) setRegion((r) => ({ ...r, latitude: home.latitude, longitude: home.longitude }));
    }
  }

  async function setState(placeId: string, state: PlaceState) {
    const place = places.find((p) => p.placeId === placeId) ?? selected;
    try {
      // Tapping the state a place already has toggles it off (e.g. tap "Saved" to unsave), keeping
      // the sheet open so the change is visible.
      if (place?.state === state) {
        const cleared = await clearUserPlaceState(placeId);
        if (!cleared) return;
        setPlaces((ps) => ps.map((p) => (p.placeId === placeId ? { ...p, state: undefined } : p)));
        setSavedPins((ps) => ps.filter((p) => p.placeId !== placeId));
        setSelected((sel) => (sel && sel.placeId === placeId ? { ...sel, state: undefined } : sel));
        return;
      }
      const saved = await setUserPlaceState(placeId, state);
      if (!saved) return;
      setPlaces((ps) => ps.map((p) => (p.placeId === placeId ? { ...p, state } : p)));
      // Keep the place on the map as a saved pin even after the search that surfaced it changes.
      setSavedPins((ps) =>
        ps.some((p) => p.placeId === placeId)
          ? ps.map((p) => (p.placeId === placeId ? { ...p, state } : p))
          : place ? [...ps, { ...place, state }] : ps,
      );
      setSelected(null);
      if ((state === "liked" || state === "loved" || state === "disliked") && place) {
        setFeedback({ place: { ...place, state }, state });
      }
    } catch {
      return;
    }
  }

  // Enrich BEFORE filtering so the intent engine can see guide awards (prestige override) and
  // first-party facts (price band, dietary tags). Annotating after the fact, as the map used to,
  // would leave the engine blind to those signals.
  const enrich = (list: Place[]) => annotateFacts(annotateGuides(list, guides), facts);
  const filterVisible = (list: Place[]) => {
    const f = applyFilters(enrich(list), { selected: sel, suppressed, budgetMax, withinKm, minRating, sortBy, showState });
    return friendsOnly ? f.filter((p) => friendsBeen.has(p.placeId)) : f;
  };
  // The MAP shows saved pins as a base layer plus the live search results on top. The LIST and
  // popup show only the live search results, so a search returns what you searched for, never your
  // saved places. Co-located pins are fanned out so a stacked restaurant is still tappable.
  const merged = mergePlaces(savedPins, places);
  const mapVisible = spreadOverlappingPins(filterVisible(merged));
  const listVisible = filterVisible(places);
  const currentSelected = selected ? merged.find((p) => p.placeId === selected.placeId) ?? selected : null;

  return (
    <View style={s.wrap}>
      <MapCanvas
        region={region}
        places={mapVisible}
        selectedId={selected?.placeId}
        onSelect={focusPlace}
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
          onChange={setQuery}
          onPreferences={() => setShowPrefs(true)}
          onSubmit={submitTypedSearch}
          loading={loading}
          aiMode={aiMode}
          onToggleAi={() => setAiMode((v) => !v)}
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
        <Pressable
          style={s.cardBackdrop}
          onPress={() => setSelected(null)}
          accessibilityRole="button"
          accessibilityLabel="Close place"
        />
      )}
      {currentSelected && (
        <PlaceSheet
          place={currentSelected}
          onSetState={setState}
          onOpenDetail={(placeId) => router.push({ pathname: "/place/[placeId]", params: { placeId } })}
          visitCount={visitStatus.count}
          checkedInRecently={visitStatus.checkedInRecently}
          photoUri={cardPhoto}
          myReview={cardReview}
          address={cardAddress}
          openNow={cardInfo.openNow}
          nextCloseTime={cardInfo.nextCloseTime}
          weekdayDescriptions={cardInfo.weekdayDescriptions}
          periods={cardInfo.periods}
          takeout={cardInfo.takeout}
          dineIn={cardInfo.dineIn}
          delivery={cardInfo.delivery}
          onCheckIn={() => {
            checkIn(currentSelected.placeId)
              .then((status) => {
                if (status) setVisitStatus({ count: status.count, checkedInRecently: status.checkedInRecently });
              })
              .catch(() => {});
          }}
        />
      )}
      {showPrefs && <PreferencesSheet groups={CUISINE_GROUPS} onClose={() => setShowPrefs(false)} />}
      {home && !selected && !showPrefs && !showList && (
        <Pressable
          style={[s.recenter, { bottom: space.xxl }]}
          onPress={recenterOnUser}
          accessibilityRole="button"
          accessibilityLabel="Recenter on my location"
        >
          <Ionicons name="locate" size={20} color={colors.ink} />
        </Pressable>
      )}
      {!selected && !showPrefs && !showList && (
        <Pressable
          style={s.findBtn}
          onPress={findFoodNearMe}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={16} color={colors.onAccent} />
          <Text style={s.findTxt}>Find food near me</Text>
        </Pressable>
      )}
      {showList && (
        <PlacesListSheet
          places={listVisible}
          loading={loading}
          onSelect={focusPlace}
          onClose={() => setShowList(false)}
          title={listTitleForSearchMode(listMode, listQuery)}
          hasMore={!!pageToken}
          loadingMore={loadingMore}
          onLoadMore={loadMorePlaces}
        />
      )}
      {feedback && (
        <PlaceFeedbackPrompt
          placeName={feedback.place.name}
          state={feedback.state}
          onClose={() => setFeedback(null)}
          onSubmit={(r) => {
            saveReviewFeedback(feedback.place.placeId, feedback.state, r).catch(() => {});
          }}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.canvas, zIndex: 1 },
  // Tap anywhere off the open card to dismiss it. Sits above the map but below the search bar
  // (zIndex 2) and the card itself (rendered after), so both stay interactive.
  cardBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  top: { position: "absolute", left: space.sm, right: space.sm, gap: space.xs, zIndex: 2 },
  findBtn: {
    position: "absolute", bottom: space.xxl, alignSelf: "center", flexDirection: "row", alignItems: "center",
    gap: space.xs, backgroundColor: colors.accent, borderRadius: 9999, paddingHorizontal: space.lg,
    paddingVertical: space.sm, minHeight: 44, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  findTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
  recenter: {
    position: "absolute", right: space.sm, width: 44, height: 44, borderRadius: 22, alignItems: "center",
    justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1,
    shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  friendsChip: {
    flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start",
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: 9999,
    paddingHorizontal: space.md, paddingVertical: 8,
  },
  friendsChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  friendsChipTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  friendsChipOnTxt: { color: colors.onAccent },
});
