import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase, useSession } from "../src/lib/supabase";
import { colors, radius, space, fonts } from "../src/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  // Surfaces the failing step of any sign-in attempt. Previously every error was
  // swallowed, so a failed OAuth handshake looked identical to "nothing happened".
  const [error, setError] = useState<string | null>(null);
  // Once auth completes (Google, or a restored session), leave the sign-in screen.
  // index.tsx only redirects on mount, so without this a fresh sign-in strands the
  // user here even though the session is set.
  const { session } = useSession();

  async function emailLink() {
    setError(null);
    const redirectTo = makeRedirectUri({ scheme: "hungr" });
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  // Native OAuth: open the provider URL in an auth session, then establish the session
  // from the redirect. Each step reports its own failure so a silent dead-end (the bug
  // we hit repeatedly) is impossible: you always see which step broke.
  async function google() {
    setError(null);
    const redirectTo = makeRedirectUri({ scheme: "hungr" });
    const { data, error: startError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (startError) { setError(`start: ${startError.message}`); return; }
    if (!data?.url) { setError("start: no auth url returned"); return; }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") { setError(`browser closed: ${result.type}`); return; }

    // getQueryParams merges the query string and the # fragment, so this handles both
    // the implicit flow (#access_token, which this project uses) and PKCE (?code).
    const { params, errorCode } = QueryParams.getQueryParams(result.url);
    if (errorCode) { setError(`callback: ${errorCode}`); return; }
    const { access_token, refresh_token, code } = params;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) { setError(`exchange: ${error.message}`); return; }
    } else if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) { setError(`session: ${error.message}`); return; }
    } else {
      setError(`callback returned no tokens: ${result.url.slice(0, 100)}`);
    }
  }

  if (session) return <Redirect href="/map" />;

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
      <Pressable style={s.primary} onPress={emailLink} accessibilityRole="button">
        <Text style={s.primaryTxt}>{sent ? "Check your inbox" : "Email me a link"}</Text>
      </Pressable>
      <Pressable style={s.ghost} onPress={google} accessibilityRole="button">
        <Text style={s.ghostTxt}>Continue with Google</Text>
      </Pressable>
      {error && <Text style={s.error}>{error}</Text>}
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
  error: { color: colors.avoid, fontSize: 13, textAlign: "center" },
});
