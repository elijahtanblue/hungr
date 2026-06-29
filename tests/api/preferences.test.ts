import { loadSuppressedCuisines, saveSuppressedCuisines } from "../../src/api/preferences";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("loadSuppressedCuisines rejects when the profile query fails", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: new Error("profile blocked") }),
      }),
    }),
  });

  await expect(loadSuppressedCuisines()).rejects.toThrow("profile blocked");
});

test("saveSuppressedCuisines rejects when the profile update fails", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: new Error("update blocked") }),
    }),
  });

  await expect(saveSuppressedCuisines(["Thai"])).rejects.toThrow("update blocked");
});
