import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { StyleSheet } from "react-native";
import { PlacePin } from "./PlacePin";
import type { Place } from "../domain/types";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function MapCanvas({
  region, places, onSelect, onRegionChange,
}: {
  region: Region;
  places: Place[];
  onSelect: (p: Place) => void;
  onRegionChange?: (region: Region) => void;
}) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsUserLocation
      onRegionChangeComplete={onRegionChange}
    >
      {places.map((p) => (
        <Marker key={p.placeId} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => onSelect(p)}>
          <PlacePin state={p.state} label={p.state === "avoid" ? "✕" : p.rating ? String(p.rating) : "★"} />
        </Marker>
      ))}
    </MapView>
  );
}
