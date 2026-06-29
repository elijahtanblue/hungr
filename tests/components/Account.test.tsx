import { render, screen, fireEvent } from "@testing-library/react-native";
import Account from "../../app/(tabs)/account";
import { supabase } from "../../src/lib/supabase";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
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
