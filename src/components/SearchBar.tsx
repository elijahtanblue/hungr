import { useRef, useState } from "react";
import { View, TextInput, Pressable, ActivityIndicator, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";

export function SearchBar({
  value, onChange, onPreferences, onSubmit, loading = false, aiMode = false, onToggleAi,
}: {
  value: string;
  onChange: (t: string) => void;
  onPreferences: () => void;
  onSubmit?: () => void;
  loading?: boolean;
  aiMode?: boolean;
  onToggleAi?: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [enticing, setEnticing] = useState(false);

  // Amber "come use me" pulse on the AI icon whenever the field is focused, so people discover the
  // AI search mode. Skipped when AI is already active (no need to entice). Keeps the AI vs basic
  // distinction visible, so a future "daily limit reached, upgrade" message reads as AI-only and
  // does not make people think they can no longer search for food at all.
  function entice() {
    if (aiMode) return;
    setEnticing(true);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => setEnticing(false));
  }

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const aiColor = aiMode || enticing ? colors.accentPress : colors.muted;

  return (
    <View style={[s.bar, aiMode && s.barAi]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.accentPress} style={s.icon} />
      ) : (
        <Ionicons name="search" size={18} color={colors.muted} />
      )}
      <TextInput
        style={s.input}
        placeholder={aiMode ? "Try asking hungrAI where to go for date night" : 'Food near me, or "reviewed by Jenny"'}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        onFocus={entice}
        returnKeyType="search"
      />
      <Pressable
        onPress={onToggleAi}
        accessibilityRole="switch"
        accessibilityState={{ checked: aiMode }}
        accessibilityLabel="AI search"
        hitSlop={8}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="sparkles" size={19} color={aiColor} />
        </Animated.View>
      </Pressable>
      <Pressable onPress={onPreferences} accessibilityLabel="Taste preferences" hitSlop={8}>
        <Ionicons name="options-outline" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  barAi: { borderColor: colors.accent },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md },
  icon: { width: 18, height: 18 },
});
