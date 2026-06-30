// Mirrors DESIGN.md. Update both together.
export const colors = {
  canvas: "#FCF6DF",
  surface: "#FFFDF4",
  ink: "#1C1A17",
  muted: "#8C8266",
  hair: "#EFE6CE",
  accent: "#FBBF24",
  accentPress: "#E8A50C",
  onAccent: "#241A06",
  been: "#5C8A5A",
  avoid: "#C0563D",
  loved: "#DB5A92",
  slate: "#3E6B7A",
} as const;

export const radius = { sm: 10, md: 14, lg: 18, pill: 9999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const fonts = {
  brand: "Fraunces_600SemiBold",
  heading: "CabinetGrotesk_700Bold",
  body: "GeneralSans_400Regular",
  bodyMedium: "GeneralSans_500Medium",
} as const;
