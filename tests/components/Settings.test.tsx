import { render, screen, fireEvent } from "@testing-library/react-native";
import Settings from "../../app/settings";
import { supabase } from "../../src/lib/supabase";

jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
  await render(<Settings />);
  await fireEvent.press(screen.getByText("Sign out"));
  expect(supabase.auth.signOut).toHaveBeenCalled();
});

test("Edit profile navigates to the profile edit screen", async () => {
  const { router } = require("expo-router");
  await render(<Settings />);
  await fireEvent.press(screen.getByText("Edit profile"));
  expect(router.push).toHaveBeenCalledWith("/profile/edit");
});

test("Report a bug navigates to the bug report screen", async () => {
  const { router } = require("expo-router");
  await render(<Settings />);
  await fireEvent.press(screen.getByText("Report a bug"));
  expect(router.push).toHaveBeenCalledWith("/bug-report");
});
