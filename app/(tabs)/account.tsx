import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, space } from "../../src/theme";

export default function Account() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Account</Text>
      <View style={s.card}>
        <View style={s.avatar}>
          <Ionicons name="person-outline" size={24} color={colors.accentPress} />
        </View>
        <Text style={s.email}>{email ?? "Signed in"}</Text>
      </View>
      <Pressable style={s.signOut} onPress={signOut} accessibilityRole="button">
        <Text style={s.signOutTxt}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.xl, paddingTop: space.xxl },
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
  signOut: { borderColor: colors.avoid, borderWidth: 1, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48, justifyContent: "center" },
  signOutTxt: { color: colors.avoid, fontWeight: "700" },
});
