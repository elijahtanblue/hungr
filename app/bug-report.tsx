import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { submitBugReport } from "../src/api/bugReports";
import { colors, radius, space } from "../src/theme";

export default function BugReport() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    const ok = await submitBugReport(text).catch(() => false);
    setBusy(false);
    if (ok) setSent(true);
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Report a bug</Text>
      </View>

      <View style={s.content}>
        {sent ? (
          <View style={s.done}>
            <Ionicons name="checkmark-circle" size={40} color={colors.been} />
            <Text style={s.doneTitle}>Thanks for the report</Text>
            <Text style={s.doneSub}>We read every one. We'll look into it.</Text>
            <Pressable style={s.cta} onPress={() => router.back()} accessibilityRole="button">
              <Text style={s.ctaTxt}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={s.help}>What went wrong, and what were you trying to do? The more detail, the faster we can fix it.</Text>
            <TextInput
              style={s.input}
              placeholder="Describe the bug..."
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              multiline
              editable={!busy}
            />
            <Pressable style={[s.cta, (busy || !text.trim()) && s.ctaDisabled]} onPress={submit} disabled={busy || !text.trim()} accessibilityRole="button">
              <Text style={s.ctaTxt}>{busy ? "Sending..." : "Send report"}</Text>
            </Pressable>
          </>
        )}
      </View>
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
  content: { padding: space.xl, gap: space.md },
  help: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  input: {
    minHeight: 160, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md,
    color: colors.ink, textAlignVertical: "top", backgroundColor: colors.surface, fontSize: 15, lineHeight: 22,
  },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: space.sm },
  ctaDisabled: { backgroundColor: colors.hair },
  ctaTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  done: { alignItems: "center", gap: space.sm, marginTop: space.xxl },
  doneTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  doneSub: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
