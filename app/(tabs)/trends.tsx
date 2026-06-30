import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "../../src/theme";

type Scope = "near" | "global";

// Trends. The near/global toggle is here now; the ranked content is a later build.
export default function Trends() {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope>("near");
  return (
    <View testID="trends-screen" style={[s.wrap, { paddingTop: insets.top + space.lg }]}>
      <Text style={s.h1}>Trends</Text>
      <View style={s.toggle}>
        <Pressable
          onPress={() => setScope("near")}
          style={[s.seg, scope === "near" && s.segOn]}
          accessibilityRole="button"
        >
          <Text style={[s.segTxt, scope === "near" && s.segTxtOn]}>Near me</Text>
        </Pressable>
        <Pressable
          onPress={() => setScope("global")}
          style={[s.seg, scope === "global" && s.segOn]}
          accessibilityRole="button"
        >
          <Text style={[s.segTxt, scope === "global" && s.segTxtOn]}>Global</Text>
        </Pressable>
      </View>
      <View style={s.empty}>
        <View style={s.badge}>
          <Ionicons name="trending-up-outline" size={26} color={colors.accentPress} />
        </View>
        <Text style={s.title}>{scope === "near" ? "Nothing trending near you yet" : "Nothing trending globally yet"}</Text>
        <Text style={s.sub}>
          As people save and review places, what is heating up shows here. Check back once the
          community grows.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.xl },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: space.lg },
  toggle: { flexDirection: "row", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, padding: 3, alignSelf: "flex-start" },
  seg: { paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.accent },
  segTxt: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segTxtOn: { color: colors.onAccent },
  empty: { alignItems: "center", gap: space.sm, marginTop: space.xxl, paddingHorizontal: space.md },
  badge: {
    width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, marginBottom: space.sm,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
});
