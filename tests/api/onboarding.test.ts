import { getOnboardingStatus, saveOnboarding } from "../../src/api/onboarding";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

function mockProfileRow(row: any, error: any = null) {
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row, error }) }) }),
  });
}

test("getOnboardingStatus reports an onboarded user", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  mockProfileRow({ onboarded_at: "2026-06-30T00:00:00Z" });
  await expect(getOnboardingStatus()).resolves.toEqual({ onboarded: true });
});

test("getOnboardingStatus reports a fresh user who has not onboarded", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  mockProfileRow({ onboarded_at: null });
  await expect(getOnboardingStatus()).resolves.toEqual({ onboarded: false });
});

test("getOnboardingStatus fails open so a read error never traps the user", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  mockProfileRow(null, new Error("offline"));
  await expect(getOnboardingStatus()).resolves.toEqual({ onboarded: true });
});

test("saveOnboarding persists languages and cuisines through the RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await saveOnboarding(["English", "Mandarin"], ["Chinese", "Thai"]);
  expect(supabase.rpc).toHaveBeenCalledWith("save_onboarding", {
    langs: ["English", "Mandarin"],
    cuisines: ["Chinese", "Thai"],
  });
});
