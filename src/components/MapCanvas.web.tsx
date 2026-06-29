import { View, Text } from "react-native";
import { colors } from "../theme";
import type { Place } from "../domain/types";

// Web uses Google Maps JavaScript (react-native-maps does not run on web).
// Stubbed for v1 iOS-first. Implemented in the web map task.
export function MapCanvas(_: { region: any; places: Place[]; onSelect: (p: Place) => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <Text style={{ color: colors.muted }}>Map on web is wired in the web task.</Text>
    </View>
  );
}
