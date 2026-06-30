import { render, screen, fireEvent } from "@testing-library/react-native";
import Account from "../../app/(tabs)/account";
import { supabase } from "../../src/lib/supabase";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../src/api/social", () => ({
  getMyProfile: jest.fn().mockResolvedValue(null),
  setUsername: jest.fn().mockResolvedValue({ ok: true }),
  setShareActivity: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { email: "a@b.com" } } }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

test("tapping Sign out calls supabase signOut", async () => {
  await render(<Account />);
  await fireEvent.press(screen.getByText("Sign out"));
  expect(supabase.auth.signOut).toHaveBeenCalled();
});

test("Account respects the phone safe area at the top", async () => {
  await render(<Account />);
  const screenRoot = screen.getByTestId("account-screen");
  expect(StyleSheet.flatten(screenRoot.props.style).paddingTop).toBeGreaterThan(47);
});

test("Account links to My places", async () => {
  await render(<Account />);
  await fireEvent.press(screen.getByText("My places"));
  expect(router.push).toHaveBeenCalledWith("/my-places");
});
