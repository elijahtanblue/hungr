import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

// Bottom tab bar: Map (core), Friends, Trends, Account. Golden active tint per DESIGN.md.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentPress,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hair },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: "Map", tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Friends", tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="trends"
        options={{ title: "Trends", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
