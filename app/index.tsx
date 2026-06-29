import { View, Text, StyleSheet } from "react-native";
import { colors, space } from "../src/theme";

export default function Index() {
  return (
    <View style={s.wrap}>
      <Text style={s.brand}>hungr</Text>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: space.xl },
  brand: { fontSize: 44, color: colors.ink },
});
