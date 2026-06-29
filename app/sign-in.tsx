import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../src/lib/supabase";
import { colors, radius, space, fonts } from "../src/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function emailLink() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (!error) setSent(true);
  }

  // Expo OAuth: open the provider URL in a browser session, then set the session from
  // the returned redirect. signInWithOAuth alone does not complete auth on native.
  async function google() {
    const redirectTo = makeRedirectUri({ scheme: "hungr" });
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (!data?.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return;
    const fragment = result.url.split("#")[1] ?? "";
    const params = new URLSearchParams(fragment);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>hungr</Text>
      <Text style={s.tag}>Find food worth the trip.</Text>
      <TextInput
        style={s.input}
        placeholder="you@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={colors.muted}
      />
      <Pressable style={s.primary} onPress={emailLink}>
        <Text style={s.primaryTxt}>{sent ? "Check your inbox" : "Email me a link"}</Text>
      </Pressable>
      <Pressable style={s.ghost} onPress={google}>
        <Text style={s.ghostTxt}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: space.xl, backgroundColor: colors.canvas, gap: space.md },
  brand: { fontSize: 44, color: colors.ink, fontFamily: fonts.brand },
  tag: { fontSize: 16, color: colors.muted, marginBottom: space.lg },
  input: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, minHeight: 48 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48 },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  ghost: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48 },
  ghostTxt: { color: colors.ink, fontWeight: "600" },
});
