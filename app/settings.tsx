import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { getMyProfile, setShareActivity } from "../src/api/social";
import { colors, radius, space } from "../src/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [shares, setShares] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    getMyProfile().then((p) => { if (p) setShares(p.sharesActivity); });
  }, []);

  function toggleShares(next: boolean) {
    setShares(next);
    setShareActivity(next).then((ok) => { if (!ok) setShares(!next); });
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={s.card}>
          <View style={s.avatar}>
            <Ionicons name="person-outline" size={24} color={colors.accentPress} />
          </View>
          <Text style={s.email}>{email ?? "Signed in"}</Text>
        </View>

        <Pressable style={s.firstRow} onPress={() => router.push("/profile/edit")} accessibilityRole="button">
          <Ionicons name="person-circle-outline" size={18} color={colors.accentPress} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Edit profile</Text>
            <Text style={s.rowHelp}>Change your handle, photo, and bio.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push("/taste")} accessibilityRole="button">
          <Ionicons name="sparkles-outline" size={18} color={colors.accentPress} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Your taste profile</Text>
            <Text style={s.rowHelp}>See what hungr has learned, and control or delete your taste data.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push("/my-places")} accessibilityRole="button">
          <Ionicons name="bookmark-outline" size={18} color={colors.accentPress} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>My places</Text>
            <Text style={s.rowHelp}>Review your Want to go, Liked, Loved, and Disliked spots.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push("/import")} accessibilityRole="button">
          <Ionicons name="cloud-upload-outline" size={18} color={colors.accentPress} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Import a list</Text>
            <Text style={s.rowHelp}>Bring in your Google Maps saved places, a spreadsheet, or notes.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push("/bug-report")} accessibilityRole="button">
          <Ionicons name="bug-outline" size={18} color={colors.accentPress} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Report a bug</Text>
            <Text style={s.rowHelp}>Something off? Tell us and we'll look into it.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={s.toggleRow}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Share where you've been</Text>
            <Text style={s.rowHelp}>When on, the people who follow you can see places you've liked or loved.</Text>
          </View>
          <Switch value={shares} onValueChange={toggleShares} trackColor={{ true: colors.accent, false: colors.hair }} thumbColor={colors.surface} />
        </View>

        <Pressable style={s.signOut} onPress={signOut} accessibilityRole="button">
          <Text style={s.signOutTxt}>Sign out</Text>
        </Pressable>

        <Pressable style={s.privacy} onPress={() => router.push("/privacy")} accessibilityRole="button">
          <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
          <Text style={s.privacyTxt}>Privacy Policy</Text>
        </Pressable>
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
  content: { padding: space.xl },
  card: {
    flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.xl,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1 },
  email: { fontSize: 16, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  firstRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, paddingTop: space.lg, borderTopColor: colors.hair, borderTopWidth: 1 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, paddingTop: space.lg, borderTopColor: colors.hair, borderTopWidth: 1 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  rowHelp: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  signOut: { borderColor: colors.avoid, borderWidth: 1, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: space.xl },
  signOutTxt: { color: colors.avoid, fontWeight: "700" },
  privacy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, marginTop: space.lg, padding: space.sm },
  privacyTxt: { color: colors.muted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
});
