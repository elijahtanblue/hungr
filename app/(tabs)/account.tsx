import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { getMyProfile, setUsername, setShareActivity } from "../../src/api/social";
import { colors, radius, space } from "../../src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [savedHandle, setSavedHandle] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [shares, setShares] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    getMyProfile().then((p) => {
      if (!p) return;
      if (p.username) { setSavedHandle(p.username); setHandle(p.username); }
      setShares(p.sharesActivity);
    });
  }, []);

  function toggleShares(next: boolean) {
    setShares(next);
    setShareActivity(next).then((ok) => { if (!ok) setShares(!next); });
  }

  async function saveHandle() {
    setStatus(null);
    const res = await setUsername(handle);
    if (res.ok) {
      setSavedHandle(handle.trim().toLowerCase());
      setStatus({ ok: true, msg: "Handle saved. Friends can find you now." });
    } else {
      setStatus({ ok: false, msg: res.error });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  const dirty = handle.trim().toLowerCase() !== (savedHandle ?? "");

  return (
    <View testID="account-screen" style={[s.wrap, { paddingTop: insets.top + space.lg }]}>
      <Text style={s.h1}>Account</Text>
      <View style={s.card}>
        <View style={s.avatar}>
          <Ionicons name="person-outline" size={24} color={colors.accentPress} />
        </View>
        <Text style={s.email}>{email ?? "Signed in"}</Text>
      </View>

      <Text style={s.label}>Your handle</Text>
      <Text style={s.help}>This is how friends find you. Lowercase letters, numbers, underscores.</Text>
      <View style={s.handleRow}>
        <View style={s.handleInput}>
          <Text style={s.at}>@</Text>
          <TextInput
            style={s.input}
            placeholder="yourname"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={handle}
            onChangeText={(t) => { setHandle(t); setStatus(null); }}
          />
        </View>
        <Pressable
          style={[s.save, !dirty && s.saveDisabled]}
          onPress={saveHandle}
          disabled={!dirty}
          accessibilityRole="button"
        >
          <Text style={[s.saveTxt, !dirty && s.saveDisabledTxt]}>Save</Text>
        </Pressable>
      </View>
      {status && <Text style={status.ok ? s.ok : s.err}>{status.msg}</Text>}

      <View style={s.toggleRow}>
        <View style={s.toggleText}>
          <Text style={s.toggleTitle}>Share where you've been</Text>
          <Text style={s.toggleHelp}>When on, the people who follow you can see places you've marked as been.</Text>
        </View>
        <Switch
          value={shares}
          onValueChange={toggleShares}
          trackColor={{ true: colors.accent, false: colors.hair }}
          thumbColor={colors.surface}
        />
      </View>

      <Pressable style={s.importRow} onPress={() => router.push("/my-places")} accessibilityRole="button">
        <Ionicons name="bookmark-outline" size={18} color={colors.accentPress} />
        <View style={s.toggleText}>
          <Text style={s.toggleTitle}>My places</Text>
          <Text style={s.toggleHelp}>Review your Want to go, Been, and Avoid spots.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Pressable style={s.importRow} onPress={() => router.push("/import")} accessibilityRole="button">
        <Ionicons name="cloud-upload-outline" size={18} color={colors.accentPress} />
        <View style={s.toggleText}>
          <Text style={s.toggleTitle}>Import a list</Text>
          <Text style={s.toggleHelp}>Bring in your Google Maps saved places, a spreadsheet, or notes.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Pressable style={s.signOut} onPress={signOut} accessibilityRole="button">
        <Text style={s.signOutTxt}>Sign out</Text>
      </Pressable>

      <Pressable style={s.privacy} onPress={() => router.push("/privacy")} accessibilityRole="button">
        <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
        <Text style={s.privacyTxt}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.xl },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: space.xl },
  card: {
    flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.xl,
  },
  avatar: {
    width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1,
  },
  email: { fontSize: 16, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  help: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: space.sm },
  handleRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  handleInput: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  at: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md, marginLeft: 2 },
  save: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 48, alignItems: "center", justifyContent: "center" },
  saveDisabled: { backgroundColor: colors.hair },
  saveTxt: { color: colors.onAccent, fontWeight: "700" },
  saveDisabledTxt: { color: colors.muted },
  ok: { color: colors.been, fontSize: 13, marginTop: space.sm, fontWeight: "600" },
  err: { color: colors.avoid, fontSize: 13, marginTop: space.sm, fontWeight: "600" },
  importRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, paddingTop: space.lg, borderTopColor: colors.hair, borderTopWidth: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, paddingTop: space.lg, borderTopColor: colors.hair, borderTopWidth: 1 },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  toggleHelp: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  signOut: { borderColor: colors.avoid, borderWidth: 1, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: space.xl },
  signOutTxt: { color: colors.avoid, fontWeight: "700" },
  privacy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, marginTop: space.lg, padding: space.sm },
  privacyTxt: { color: colors.muted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
});
