import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { parseImportText } from "../src/domain/importList";
import { importPlacesToWantToGo, type ImportResult } from "../src/api/importPlaces";
import { colors, radius, space } from "../src/theme";

// Best-effort location bias for resolving pasted names. Falls back to the map's default region
// (Sydney) when location is unavailable, so import still works without a permission prompt here.
async function currentBias(): Promise<{ lat: number; lng: number }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    }
  } catch { /* fall through */ }
  return { lat: -33.87, lng: 151.21 };
}

export default function Import() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    const rows = parseImportText(text);
    if (rows.length === 0) { setResult({ added: [], missed: [] }); return; }
    setResult(null);
    setRunning(true);
    setProgress({ done: 0, total: rows.length });
    const bias = await currentBias();
    const res = await importPlacesToWantToGo(rows, bias, (done, total) => setProgress({ done, total }));
    setRunning(false);
    setResult(res);
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Import a list</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={s.help}>
          Paste places from your Google Maps saved list (open the Takeout CSV), a spreadsheet, or
          your notes: one place per line, or a "Name, Address" per line. We will find each one and
          add it to Want to go.
        </Text>

        <TextInput
          style={s.input}
          placeholder={"Mr Wong, Bridge St\nGumshara Ramen\n..."}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={(t) => { setText(t); setResult(null); }}
          multiline
          autoCapitalize="none"
          editable={!running}
        />

        <Pressable
          style={[s.run, (running || !text.trim()) && s.runDisabled]}
          onPress={run}
          disabled={running || !text.trim()}
          accessibilityRole="button"
        >
          {running ? (
            <>
              <ActivityIndicator color={colors.onAccent} />
              <Text style={s.runTxt}>Adding {progress.done}/{progress.total}</Text>
            </>
          ) : (
            <Text style={s.runTxt}>Find and add to Want to go</Text>
          )}
        </Pressable>

        {result && (
          <View style={s.result}>
            {result.added.length === 0 && result.missed.length === 0 ? (
              <Text style={s.resultMeta}>Nothing to import. Paste some places above.</Text>
            ) : (
              <>
                <Text style={s.resultTitle}>Added {result.added.length} to Want to go</Text>
                {result.added.map((n) => (
                  <View key={`a-${n}`} style={s.line}>
                    <Ionicons name="bookmark" size={14} color={colors.accentPress} />
                    <Text style={s.lineTxt} numberOfLines={1}>{n}</Text>
                  </View>
                ))}
                {result.missed.length > 0 && (
                  <>
                    <Text style={[s.resultTitle, s.missedTitle]}>Could not find {result.missed.length}</Text>
                    {result.missed.map((n) => (
                      <View key={`m-${n}`} style={s.line}>
                        <Ionicons name="help-circle-outline" size={14} color={colors.muted} />
                        <Text style={[s.lineTxt, s.missedTxt]} numberOfLines={1}>{n}</Text>
                      </View>
                    ))}
                    <Text style={s.resultMeta}>Try adding a suburb or city to the ones we missed, then import again.</Text>
                  </>
                )}
              </>
            )}
          </View>
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
  content: { padding: space.xl, gap: space.md },
  help: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  input: {
    minHeight: 160, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md,
    color: colors.ink, textAlignVertical: "top", backgroundColor: colors.surface, fontSize: 15, lineHeight: 22,
  },
  run: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, minHeight: 50,
  },
  runDisabled: { backgroundColor: colors.hair },
  runTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  result: { gap: space.xs, marginTop: space.sm },
  resultTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: space.sm },
  missedTitle: { color: colors.muted },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 3 },
  lineTxt: { flex: 1, fontSize: 14, color: colors.ink },
  missedTxt: { color: colors.muted },
  resultMeta: { fontSize: 13, color: colors.muted, marginTop: space.sm, lineHeight: 19 },
});
