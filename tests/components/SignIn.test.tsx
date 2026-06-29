import { render, screen, fireEvent } from "@testing-library/react-native";
import SignIn from "../../app/sign-in";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { signInWithOtp: jest.fn().mockResolvedValue({ error: null }) } },
}));

test("submitting an email requests a magic link", async () => {
  await render(<SignIn />);
  await fireEvent.changeText(screen.getByPlaceholderText("you@email.com"), "test@hungr.app");
  await fireEvent.press(screen.getByText("Email me a link"));
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "test@hungr.app" });
});
