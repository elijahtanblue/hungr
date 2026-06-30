import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space } from "../theme";

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function iconName(value: number | null, star: number): keyof typeof Ionicons.glyphMap {
  if ((value ?? 0) >= star) return "star";
  if ((value ?? 0) >= star - 0.5) return "star-half";
  return "star-outline";
}

function label(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} stars`;
}

export function StarRatingInput({
  value,
  onChange,
  style,
}: {
  value: number | null;
  onChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.wrap, style]}>
      <View pointerEvents="none" style={s.icons}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={iconName(value, star)}
            size={28}
            color={colors.accentPress}
          />
        ))}
      </View>
      <View style={s.hitRow}>
        {STEPS.map((step) => (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityLabel={label(step)}
            accessibilityState={{ selected: value === step }}
            onPress={() => onChange(step)}
            style={s.hit}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: 164, height: 36, justifyContent: "center" },
  icons: { flexDirection: "row", gap: space.xs },
  hitRow: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row" },
  hit: { width: 16.4, height: 36 },
});
