import { View, Text } from "react-native";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { colors, space } from "../theme";
import { getMapsSdkKey } from "../lib/mapsKey";
import type { Place, PlaceState } from "../domain/types";

// Web map. react-native-maps does not run on web, so the web build uses Google Maps
// JavaScript (required: Google content must display on a Google map). Three state pins
// match the native PlacePin colours. Needs EXPO_PUBLIC_WEB_MAPS_SDK_KEY (a Maps JavaScript
// key), or EXPO_PUBLIC_MAPS_SDK_KEY as a local fallback.
const pinBg: Record<PlaceState, string> = {
  go: colors.accent,
  been: colors.been,
  avoid: colors.avoid,
};

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function MapCanvas({
  region, places, onSelect, onRegionChange,
}: {
  region: Region;
  places: Place[];
  onSelect: (p: Place) => void;
  onRegionChange?: (region: Region) => void;
}) {
  const apiKey = getMapsSdkKey("web");
  // Without a real Maps JavaScript key the Google map renders a blank gray tile with only a
  // console error. Show an explicit message instead (the placeholder starts with "<").
  if (!apiKey || apiKey.startsWith("<")) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: space.xl }}>
        <Text style={{ color: colors.muted, textAlign: "center" }}>
          Map unavailable. Set EXPO_PUBLIC_WEB_MAPS_SDK_KEY to a Google Maps JavaScript key.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: "100%", height: "100%" }}
          defaultCenter={{ lat: region.latitude, lng: region.longitude }}
          defaultZoom={14}
          mapId="hungr-web-map"
          disableDefaultUI
          gestureHandling="greedy"
          onCameraChanged={
            onRegionChange
              ? (ev) => onRegionChange({
                  latitude: ev.detail.center.lat,
                  longitude: ev.detail.center.lng,
                  latitudeDelta: region.latitudeDelta,
                  longitudeDelta: region.longitudeDelta,
                })
              : undefined
          }
        >
          {places.map((p) => (
            <AdvancedMarker key={p.placeId} position={{ lat: p.lat, lng: p.lng }} onClick={() => onSelect(p)}>
              <Pin
                background={p.state ? pinBg[p.state] : colors.accent}
                borderColor={colors.ink}
                glyphColor={colors.onAccent}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}
