import { submitBugReport } from "../../src/api/bugReports";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("submitBugReport inserts the trimmed message for the signed-in user", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const insert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock).mockReturnValue({ insert });

  await expect(submitBugReport("  the map froze  ")).resolves.toBe(true);
  expect(insert).toHaveBeenCalledWith({ user_id: "u1", message: "the map froze" });
});

test("submitBugReport rejects empty messages without touching the db", async () => {
  await expect(submitBugReport("   ")).resolves.toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
});
