import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useAppFonts } from "../src/hooks/useAppFonts";
import { colors } from "../src/theme";

// Hold the splash screen until the brand fonts are ready, so text never flashes
// in a fallback face on first paint.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // SafeAreaProvider powers useSafeAreaInsets app-wide (it was never mounted, so screens
  // had no way to keep content out from under the notch / Dynamic Island).
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </SafeAreaProvider>
  );
}
