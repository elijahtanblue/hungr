import { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askAiChat, type AiChatMessage } from "../src/api/aiChat";
import { colors, radius, space } from "../src/theme";

type Message = { role: "user" | "assistant"; text: string; memories?: number };

const STARTERS = [
  "Somewhere for a date night that isn't too loud",
  "Cheap, delicious lunch near me",
  "Impress a visiting foodie friend",
];

export default function AiChat() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const recentMessages: AiChatMessage[] = messages
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));
    setInput("");
    setFollowUp(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setBusy(true);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    try {
      const res = recentMessages.length > 0 ? await askAiChat(message, recentMessages) : await askAiChat(message);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer, memories: res.memoriesUpdated }]);
      setFollowUp(res.followUpQuestion);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "I could not reach hungrAI just now. Try again in a moment." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.title}>hungrAI</Text>
          <Text style={s.subtitle}>Tell me what you feel like eating</Text>
        </View>
        <Ionicons name="sparkles" size={20} color={colors.accentPress} />
      </View>

      <ScrollView
        ref={scroller}
        style={s.list}
        contentContainerStyle={s.listInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {messages.length === 0 ? (
          <View style={s.intro}>
            <Text style={s.introTitle}>What are you in the mood for?</Text>
            <Text style={s.introSub}>Ask about places to eat, occasions, budgets, or cuisines. hungrAI learns your taste as you chat.</Text>
            {STARTERS.map((q) => (
              <Pressable key={q} style={s.starter} onPress={() => send(q)} accessibilityRole="button">
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.accentPress} />
                <Text style={s.starterTxt}>{q}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          messages.map((m, i) => (
            <View key={i} style={[s.bubbleRow, m.role === "user" ? s.rowRight : s.rowLeft]}>
              <View style={[s.bubble, m.role === "user" ? s.userBubble : s.aiBubble]}>
                <Text style={m.role === "user" ? s.userText : s.aiText}>{m.text}</Text>
                {!!m.memories && m.memories > 0 && (
                  <Text style={s.memoryNote}>Saved {m.memories} to your taste profile</Text>
                )}
              </View>
            </View>
          ))
        )}
        {busy && (
          <View style={[s.bubbleRow, s.rowLeft]}>
            <View style={[s.bubble, s.aiBubble]}><ActivityIndicator color={colors.accentPress} /></View>
          </View>
        )}
        {!!followUp && !busy && (
          <View style={[s.bubbleRow, s.rowLeft]}>
            <View style={[s.bubble, s.aiBubble]}>
              <Text style={s.aiText}>{followUp}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[s.inputBar, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          style={s.input}
          placeholder="Ask hungrAI…"
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!busy}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
          style={[s.sendBtn, (busy || !input.trim()) && s.sendBtnOff]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted },
  list: { flex: 1 },
  listInner: { padding: space.lg, gap: space.sm },
  intro: { gap: space.md, paddingTop: space.lg },
  introTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  introSub: { fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: space.sm },
  starter: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  starterTxt: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "600" },
  bubbleRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "84%", borderRadius: radius.lg, paddingVertical: space.sm, paddingHorizontal: space.md },
  userBubble: { backgroundColor: colors.accent, borderTopRightRadius: 4 },
  aiBubble: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderTopLeftRadius: 4 },
  userText: { fontSize: 15, color: colors.onAccent, lineHeight: 21 },
  aiText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  memoryNote: { fontSize: 12, color: colors.muted, marginTop: 4, fontStyle: "italic" },
  followUp: { alignSelf: "flex-start", backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.pill, paddingVertical: space.sm, paddingHorizontal: space.md, marginTop: space.xs },
  followUpTxt: { fontSize: 14, color: colors.accentPress, fontWeight: "700" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopColor: colors.hair, borderTopWidth: 1, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 44, color: colors.ink, fontSize: 15, backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentPress },
  sendBtnOff: { backgroundColor: colors.muted },
});
