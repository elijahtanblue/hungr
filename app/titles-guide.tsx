import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TRAIT_CATALOG, type TraitMeta } from "../src/domain/tasteTitles";
import { colors, radius, space } from "../src/theme";

const CLASSES = TRAIT_CATALOG.filter((t) => t.group === "class");
const TRAITS = TRAIT_CATALOG.filter((t) => t.group === "trait");

function Row({ item }: { item: TraitMeta }) {
  return (
    <View style={s.row}>
      <View style={s.bubble}>
        <Text style={s.emoji}>{item.emoji}</Text>
        <Text style={s.name}>{item.name}</Text>
      </View>
      <Text style={s.how}>{item.how}</Text>
    </View>
  );
}

// A read-only guide to how hungr assigns titles. Titles are given, not earned: hungr reads your own
// saves, reviews, tags, and check-ins and assigns whichever fit. You can hold several at once.
export default function TitlesGuide() {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>How titles work</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.intro}>
          hungr reads your own saves, reviews, tags, and check-ins and gives you the titles that fit.
          You can hold several at once, and they update as your taste does.
        </Text>

        <Text style={s.sectionLabel}>Classes · what you eat</Text>
        <View style={s.card}>
          {CLASSES.map((t) => <Row key={t.id} item={t} />)}
        </View>

        <Text style={s.sectionLabel}>Traits · how you eat</Text>
        <View style={s.card}>
          {TRAITS.map((t) => <Row key={t.id} item={t} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  intro: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: space.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderTopColor: colors.hair, borderTopWidth: StyleSheet.hairlineWidth },
  bubble: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7, minWidth: 128 },
  emoji: { fontSize: 13 },
  name: { fontSize: 13, fontWeight: "800", color: colors.ink },
  how: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 19 },
});
