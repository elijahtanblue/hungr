import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import SignIn from "../../app/sign-in";
import { supabase } from "../../src/lib/supabase";

jest.mock("expo-router", () => ({ Redirect: () => null }));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "hungr://" }));
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: "https://auth.example/authorize" }, error: null }),
      setSession: jest.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
    },
  },
  useSession: jest.fn().mockReturnValue({ session: null, loading: false }),
}));

beforeEach(() => jest.clearAllMocks());

test("submitting an email requests a magic link", async () => {
  await render(<SignIn />);
  await fireEvent.changeText(screen.getByPlaceholderText("you@email.com"), "test@hungr.app");
  await fireEvent.press(screen.getByText("Email me a link"));
  await waitFor(() =>
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "test@hungr.app",
      options: { emailRedirectTo: "hungr://" },
    }),
  );
});

test("brand wordmark includes an amber period", async () => {
  await render(<SignIn />);
  expect(screen.getByText("hungr")).toBeTruthy();
  expect(screen.getByText(".")).toBeTruthy();
});

test("Google sign-in establishes a session from the implicit-flow redirect", async () => {
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: "success",
    url: "hungr://#access_token=AT&refresh_token=RT",
  });
  await render(<SignIn />);
  await fireEvent.press(screen.getByText("Continue with Google"));
  await waitFor(() =>
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: "AT", refresh_token: "RT" }),
  );
});

test("Google sign-in surfaces an error instead of failing silently", async () => {
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "dismiss" });
  await render(<SignIn />);
  await fireEvent.press(screen.getByText("Continue with Google"));
  await waitFor(() => expect(screen.getByText(/browser closed: dismiss/)).toBeTruthy());
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});
