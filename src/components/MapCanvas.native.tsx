import { useEffect, useState } from "react";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { StyleSheet } from "react-native";
import { PlacePin } from "./PlacePin";
import { PLAIN_MAP_STYLE } from "./mapStyle";
import type { Place } from "../domain/types";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function MapCanvas({
  region, places, onSelect, onRegionChange, selectedId,
}: {
  region: Region;
  places: Place[];
  onSelect: (p: Place) => void;
  onRegionChange?: (region: Region) => void;
  selectedId?: string;
}) {
  // Custom view markers re-snapshot on every frame unless frozen, which is the main source
  // of map lag. We let them render for a beat (so they rasterise crisply, not blurry) then
  // freeze them. Re-armed whenever the result set or the selected pin changes (so the
  // selected pin can redraw in its darker/larger state before freezing again).
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
  }, [places, selectedId]);

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      // Plain, food-only map: hide Google's business/transit POIs so the only things on the
      // map are our pins. Removes the "wrapping Google" feel (metro stations, hotels, etc.).
      customMapStyle={PLAIN_MAP_STYLE}
      showsPointsOfInterests={false}
      showsUserLocation
      zoomEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      showsCompass={false}
      onRegionChangeComplete={onRegionChange}
    >
      {places.map((p) => (
        <Marker
          key={p.placeId}
          coordinate={{ latitude: p.lat, longitude: p.lng }}
          onPress={() => onSelect(p)}
          tracksViewChanges={tracks}
        >
          <PlacePin state={p.state} rating={p.rating} selected={p.placeId === selectedId} />
        </Marker>
      ))}
    </MapView>
  );
}
