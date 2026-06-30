import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getNotifications, markNotificationsRead, type AppNotification } from "../src/api/notifications";
import { colors, radius, space } from "../src/theme";

function actor(n: AppNotification): string {
  return n.actorUsername ? `@${n.actorUsername}` : n.actorName ?? "Someone";
}
function line(n: AppNotification): string {
  if (n.type === "follow") return `${actor(n)} started following you`;
  return `${actor(n)} sent you an update`;
}
function ago(iso: string): string {
  const day = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (day >= 1) return `${day}d ago`;
  const hr = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hr >= 1) return `${hr}h ago`;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return min >= 1 ? `${min}m ago` : "just now";
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((n) => { if (active) setItems(n); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    // Opening the screen clears the unread badge.
    markNotificationsRead().catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {loading ? (
          <ActivityIndicator color={colors.accentPress} style={s.loader} />
        ) : items.length === 0 ? (
          <Text style={s.empty}>No notifications yet. When people follow you, you'll see it here.</Text>
        ) : (
          items.map((n) => (
            <View key={n.id} style={[s.row, !n.read && s.rowUnread]}>
              <View style={s.dot}>
                <Ionicons name={n.type === "follow" ? "person-add" : "notifications"} size={15} color={colors.accentPress} />
              </View>
              <Text style={s.rowText}>{line(n)}</Text>
              <Text style={s.time}>{ago(n.createdAt)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md,
    paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  content: { padding: space.lg, gap: space.xs },
  loader: { marginTop: space.xxl },
  empty: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: space.xxl, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  rowUnread: { borderColor: colors.accent, backgroundColor: "#FFFBEC" },
  dot: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1 },
  rowText: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: "600" },
  time: { fontSize: 12, color: colors.muted },
});
