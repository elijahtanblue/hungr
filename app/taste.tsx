import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTasteTrackingSettings, setTasteTrackingEnabled, getMyTasteInsights, deleteMyTasteEvents,
} from "../src/api/tasteTracking";
import { colors, radius, space } from "../src/theme";

export default function Taste() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([getTasteTrackingSettings(), getMyTasteInsights()])
      .then(([settings, lines]) => {
        setEnabled(settings.tasteTrackingEnabled);
        setInsights(lines);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(next: boolean) {
    setEnabled(next);
    setTasteTrackingEnabled(next).then((ok) => { if (!ok) setEnabled(!next); });
  }

  function confirmDelete() {
    Alert.alert(
      "Delete taste data?",
      "This permanently removes everything hungr has learned about your taste. Your saved places and reviews are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            deleteMyTasteEvents()
              .then((ok) => { if (ok) setInsights([]); })
              .catch(() => {})
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Your taste profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.toggleRow}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Personalize my recommendations</Text>
            <Text style={s.rowHelp}>When on, hungr learns from your searches and saves to rank places you'll like. When off, we stop collecting new taste signals.</Text>
          </View>
          <Switch value={enabled} onValueChange={toggle} trackColor={{ true: colors.accent, false: colors.hair }} thumbColor={colors.surface} />
        </View>

        <Text style={s.sectionLabel}>What hungr has learned</Text>
        {loading ? (
          <ActivityIndicator color={colors.accentPress} style={s.loading} />
        ) : insights.length === 0 ? (
          <Text style={s.empty}>Nothing yet. As you search, save, and check in, hungr starts to read your taste here.</Text>
        ) : (
          <View style={s.card}>
            {insights.map((line, i) => (
              <View key={line} style={[s.featureRow, i > 0 && s.featureDivider]}>
                <Ionicons name="sparkles" size={16} color={colors.accentPress} style={s.insightIcon} />
                <Text style={s.insightText}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable style={s.delete} onPress={confirmDelete} disabled={deleting} accessibilityRole="button">
          {deleting ? (
            <ActivityIndicator color={colors.avoid} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={colors.avoid} />
              <Text style={s.deleteTxt}>Delete my taste data</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  content: { padding: space.lg, gap: space.lg },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  rowHelp: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 19 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  loading: { paddingVertical: space.lg },
  empty: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: space.md },
  featureDivider: { borderTopColor: colors.hair, borderTopWidth: 1 },
  insightIcon: { marginTop: 2 },
  insightText: { flex: 1, fontSize: 15, color: colors.ink, lineHeight: 21 },
  delete: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.md, borderRadius: radius.md, borderColor: colors.hair, borderWidth: 1, marginTop: space.sm },
  deleteTxt: { fontSize: 15, fontWeight: "700", color: colors.avoid },
});
