import type { ReactElement } from "react";
import type { Place } from "../domain/types";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

// Type surface for the platform-split MapCanvas. The real implementations live in
// MapCanvas.native.tsx and MapCanvas.web.tsx. This only exists so tsc can resolve the
// bare import; the bundler selects the platform file.
export declare function MapCanvas(props: {
  region: Region;
  places: Place[];
  onSelect: (p: Place) => void;
  onRegionChange?: (region: Region) => void;
}): ReactElement;
