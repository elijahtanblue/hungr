import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LANGUAGES } from "../src/domain/languages";
import { CUISINES } from "../src/domain/cuisines";
import { saveOnboarding } from "../src/api/onboarding";
import { registerContactIdentity, matchContacts } from "../src/api/contacts";
import { followUser, type UserSummary } from "../src/api/social";
import type { DeviceContact } from "../src/domain/contactKeys";
import { colors, radius, space, fonts } from "../src/theme";

const STEP_COUNT = 4;

// Read the device address book through expo-contacts, loaded lazily so the rest of onboarding
// (and the test suite) never depends on the native module being present.
async function readDeviceContacts(): Promise<DeviceContact[] | "denied"> {
  const Contacts = require("expo-contacts");
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") return "denied";
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
  });
  return (data ?? []).map((c: any) => ({
    emails: (c.emails ?? []).map((e: any) => e.email).filter(Boolean),
    phones: (c.phoneNumbers ?? []).map((p: any) => p.number).filter(Boolean),
  }));
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [languages, setLanguages] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [wantsImport, setWantsImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contactState, setContactState] = useState<"idle" | "denied" | "done">("idle");
  const [matches, setMatches] = useState<UserSummary[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await saveOnboarding(languages, cuisines);
      registerContactIdentity().catch(() => {});
      // Follow only the matches the user kept ticked, never the whole address book.
      await Promise.all(matches.filter((u) => selectedMatches.has(u.id)).map((u) => followUser(u.id).catch(() => {})));
    } catch {
      // Persisting taste should not trap the user on the wizard; continue regardless.
    } finally {
      setBusy(false);
      router.replace(wantsImport ? "/import" : "/map");
    }
  }

  async function connectContacts() {
    if (busy) return;
    setBusy(true);
    try {
      const contacts = await readDeviceContacts();
      if (contacts === "denied") { setContactState("denied"); return; }
      const found = await matchContacts(contacts);
      // Present the matches for the user to confirm; nobody is followed until they finish.
      setMatches(found);
      setSelectedMatches(new Set(found.map((u) => u.id)));
      setContactState("done");
    } catch {
      setContactState("denied");
    } finally {
      setBusy(false);
    }
  }

  function toggleMatch(id: string) {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <View style={[s.wrap, { paddingTop: insets.top + space.lg }]}>
      <View style={s.dots}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotOn]} />
        ))}
      </View>

      {step === 0 && (
        <>
          <Text style={s.h1}>What languages do you speak?</Text>
          <Text style={s.sub}>We use this to suggest kitchens you'll feel at home with. Optional.</Text>
          <ScrollView style={s.scroll} contentContainerStyle={s.chips}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} on={languages.includes(l)} onPress={() => toggle(languages, setLanguages, l)} />
            ))}
          </ScrollView>
          <Pressable style={s.cta} onPress={() => setStep(1)} accessibilityRole="button">
            <Text style={s.ctaTxt}>Continue</Text>
          </Pressable>
        </>
      )}

      {step === 1 && (
        <>
          <Text style={s.h1}>Pick your favourite cuisines</Text>
          <Text style={s.sub}>Choose your top 3, or more if you want.</Text>
          <ScrollView style={s.scroll} contentContainerStyle={s.chips}>
            {CUISINES.map((c) => (
              <Chip key={c} label={c} on={cuisines.includes(c)} onPress={() => toggle(cuisines, setCuisines, c)} />
            ))}
          </ScrollView>
          <Pressable style={s.cta} onPress={() => setStep(2)} accessibilityRole="button">
            <Text style={s.ctaTxt}>Continue</Text>
          </Pressable>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={s.h1}>How do you want to start?</Text>
          <Text style={s.sub}>Bring your own list, or just start exploring the map.</Text>
          <View style={s.cardCol}>
            <Pressable
              style={[s.choice, wantsImport && s.choiceOn]}
              onPress={() => { setWantsImport(true); setStep(3); }}
              accessibilityRole="button"
            >
              <Ionicons name="cloud-upload-outline" size={24} color={colors.accentPress} />
              <Text style={s.choiceTitle}>Start with an imported list</Text>
              <Text style={s.choiceHelp}>Bring in your Google Maps saves, a spreadsheet, or notes.</Text>
            </Pressable>
            <Pressable
              style={s.choice}
              onPress={() => { setWantsImport(false); setStep(3); }}
              accessibilityRole="button"
            >
              <Ionicons name="compass-outline" size={24} color={colors.accentPress} />
              <Text style={s.choiceTitle}>Discover something new</Text>
              <Text style={s.choiceHelp}>Jump straight onto the map and find food near you.</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={s.h1}>Find your friends</Text>
          <Text style={s.sub}>
            Connect your contacts and we'll show you who's already on hungr. We only ever send
            scrambled (hashed) versions of your contacts, never the numbers themselves.
          </Text>
          {contactState === "done" && matches.length > 0 ? (
            <>
              <Text style={s.contactHint}>Tap to choose who to follow.</Text>
              <ScrollView style={s.scroll} contentContainerStyle={s.matchList}>
                {matches.map((u) => {
                  const on = selectedMatches.has(u.id);
                  const name = u.username ? `@${u.username}` : u.displayName ?? "Someone";
                  return (
                    <Pressable key={u.id} style={[s.matchRow, on && s.matchRowOn]} onPress={() => toggleMatch(u.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Text style={s.matchName} numberOfLines={1}>{name}</Text>
                      <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.accentPress : colors.hair} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <View style={s.contactBody}>
              {contactState === "done" ? (
                <Text style={s.contactResult}>No contacts on hungr yet. We'll let you know as they join.</Text>
              ) : contactState === "denied" ? (
                <Text style={s.contactResult}>No problem, you can connect contacts later from your profile.</Text>
              ) : (
                <Pressable style={s.cta} onPress={connectContacts} disabled={busy} accessibilityRole="button">
                  {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.ctaTxt}>Connect contacts</Text>}
                </Pressable>
              )}
            </View>
          )}
          <Pressable style={[s.cta, s.finishCta]} onPress={finish} disabled={busy} accessibilityRole="button">
            {busy && contactState === "done" ? <ActivityIndicator color={colors.onAccent} /> : (
              <Text style={s.ctaTxt}>
                {contactState === "done" && selectedMatches.size > 0
                  ? `Follow ${selectedMatches.size} and ${wantsImport ? "import" : "explore"}`
                  : wantsImport ? "Next: import your list" : "Start exploring"}
              </Text>
            )}
          </Pressable>
        </>
      )}

      {step < 3 && (
        <Pressable style={s.skip} onPress={() => (step === 2 ? setStep(3) : setStep(step + 1))} accessibilityRole="button">
          <Text style={s.skipTxt}>Skip</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.xl, paddingBottom: space.xl },
  dots: { flexDirection: "row", gap: space.xs, marginBottom: space.lg },
  dot: { flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.hair },
  dotOn: { backgroundColor: colors.accent },
  h1: { fontSize: 28, fontFamily: fonts.brand, color: colors.ink, marginBottom: space.xs },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: space.lg },
  scroll: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingBottom: space.lg },
  chip: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { fontSize: 14, fontWeight: "700", color: colors.ink },
  chipTxtOn: { color: colors.onAccent },
  cardCol: { gap: space.md },
  choice: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.surface, gap: space.xs },
  choiceOn: { borderColor: colors.accent },
  choiceTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: space.xs },
  choiceHelp: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  contactBody: { minHeight: 80, justifyContent: "center" },
  contactResult: { fontSize: 15, color: colors.ink, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  contactHint: { fontSize: 13, color: colors.muted, fontWeight: "700", marginBottom: space.sm },
  matchList: { gap: space.sm, paddingBottom: space.sm },
  matchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.surface },
  matchRowOn: { borderColor: colors.accent },
  matchName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: "auto" },
  finishCta: { marginTop: space.md },
  ctaTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 16 },
  skip: { alignItems: "center", paddingVertical: space.md, marginTop: space.sm },
  skipTxt: { color: colors.muted, fontWeight: "700", fontSize: 14 },
});
