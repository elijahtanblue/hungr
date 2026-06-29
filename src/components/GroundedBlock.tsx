import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import type { Grounded } from "../api/grounding";

// The grounded AI answer. Its own block, with the required Google source links rendered
// underneath. Slate world (Google sourced), never mixed with community content.
export function GroundedBlock({ grounded }: { grounded: Grounded }) {
  if (!grounded.text) return null;
  return (
    <View style={s.block}>
      <View style={s.headRow}>
        <Ionicons name="sparkles-outline" size={16} color={colors.slate} />
        <Text style={s.heading}>About this place</Text>
      </View>
      <Text style={s.text}>{grounded.text}</Text>
      {grounded.sources.length > 0 && (
        <View style={s.sources}>
          <Text style={s.sourcesLabel}>Sources</Text>
          {grounded.sources.map((url, i) => (
            <Pressable key={i} onPress={() => Linking.openURL(url)} accessibilityRole="link">
              <Text style={s.link} numberOfLines={1}>{url}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={s.attribution}>AI summary grounded in Google Maps</Text>
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderLeftColor: colors.slate, borderLeftWidth: 3, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  heading: { fontSize: 16, fontWeight: "800", color: colors.slate },
  text: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  sources: { gap: 2 },
  sourcesLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 2 },
  link: { fontSize: 12, color: colors.slate, textDecorationLine: "underline" },
  attribution: { fontSize: 12, color: colors.slate, fontWeight: "600" },
});
