import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";

export function SearchBar({
  value, onChange, onPreferences, onSubmit,
}: { value: string; onChange: (t: string) => void; onPreferences: () => void; onSubmit?: () => void }) {
  return (
    <View style={s.bar}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        style={s.input}
        placeholder='Food near me, or "reviewed by Jenny"'
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
      />
      <Pressable onPress={onPreferences} accessibilityLabel="Taste preferences" hitSlop={8}>
        <Ionicons name="options-outline" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md },
});
