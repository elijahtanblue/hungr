import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";

export function SearchBar({
  value, onChange, onPreferences,
}: { value: string; onChange: (t: string) => void; onPreferences: () => void }) {
  return (
    <View style={s.bar}>
      <Text style={s.icon}>{"⌕"}</Text>
      <TextInput
        style={s.input}
        placeholder='Food near me, or "reviewed by Jenny"'
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
      />
      <Pressable onPress={onPreferences} accessibilityLabel="Taste preferences">
        <Text style={s.note}>{"✎"}</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  icon: { color: colors.muted, fontSize: 18 },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md },
  note: { color: colors.muted, fontSize: 18, padding: space.xs },
});
