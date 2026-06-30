import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_POLICY_MARKDOWN } from "../src/content/privacyPolicy";
import { colors, radius, space } from "../src/theme";

// Renders the bold runs in a single line of markdown (**like this**) as styled spans.
function inline(text: string) {
  const parts = text.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={p.bold}>{part}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

// A deliberately small markdown renderer: this is a static legal document, not arbitrary
// user input, so we only handle the constructs the policy actually uses (headings, bullets,
// table rows, bold) rather than pulling in a full markdown dependency.
function render(markdown: string) {
  return markdown.split("\n").map((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (line === "") return <View key={i} style={p.gap} />;
    if (line.startsWith("### ")) return <Text key={i} style={p.h3}>{inline(line.slice(4))}</Text>;
    if (line.startsWith("## ")) return <Text key={i} style={p.h2}>{inline(line.slice(3))}</Text>;
    if (line.startsWith("# ")) return <Text key={i} style={p.h1}>{inline(line.slice(2))}</Text>;
    if (line.startsWith("- ")) {
      return (
        <View key={i} style={p.bulletRow}>
          <Text style={p.bulletDot}>{"·"}</Text>
          <Text style={p.bullet}>{inline(line.slice(2))}</Text>
        </View>
      );
    }
    // Table rows and separators: show as plain monospace lines so columns stay legible.
    if (line.startsWith("|")) {
      if (/^\|[\s|:-]+\|?$/.test(line)) return <View key={i} style={p.tableRule} />;
      return <Text key={i} style={p.tableRow}>{line.replace(/\s*\|\s*/g, "  ").trim()}</Text>;
    }
    return <Text key={i} style={p.body}>{inline(line)}</Text>;
  });
}

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const content = useMemo(() => render(PRIVACY_POLICY_MARKDOWN), []);

  return (
    <View style={p.wrap}>
      <View style={[p.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={p.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={p.title}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={[p.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {content}
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md,
    paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  content: { padding: space.xl },
  gap: { height: space.sm },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: space.sm },
  h2: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: space.lg, marginBottom: space.xs },
  h3: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: space.md, marginBottom: space.xs },
  body: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  bold: { fontWeight: "700" },
  bulletRow: { flexDirection: "row", gap: space.sm, paddingLeft: space.xs },
  bulletDot: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  bullet: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 21 },
  tableRule: { height: 1, backgroundColor: colors.hair, marginVertical: space.xs },
  tableRow: { fontSize: 12, color: colors.muted, fontFamily: "Courier", lineHeight: 18 },
});
