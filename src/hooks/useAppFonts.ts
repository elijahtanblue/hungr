import { useFonts, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";

// Loads the brand typeface. Fraunces (brand and hero moments) ships as a package, so it
// works out of the box. Cabinet Grotesk (headings) and General Sans (body) are Fontshare
// fonts: download the .otf files into assets/fonts (see assets/fonts/README.md), then
// uncomment the lines below to load them under the family names the theme already uses.
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    // CabinetGrotesk_700Bold: require("../../assets/fonts/CabinetGrotesk-Bold.otf"),
    // GeneralSans_400Regular: require("../../assets/fonts/GeneralSans-Regular.otf"),
    // GeneralSans_500Medium: require("../../assets/fonts/GeneralSans-Medium.otf"),
  });
  return loaded;
}
