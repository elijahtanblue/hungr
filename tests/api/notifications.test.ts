import { getNotifications, markNotificationsRead } from "../../src/api/notifications";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test("getNotifications maps rows to camelCase and fails soft", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "n1", type: "follow", read: false, created_at: "2026-06-30T00:00:00Z", actor_username: "jenny", actor_name: "Jenny" }],
    error: null,
  });
  await expect(getNotifications()).resolves.toEqual([
    { id: "n1", type: "follow", read: false, createdAt: "2026-06-30T00:00:00Z", actorUsername: "jenny", actorName: "Jenny" },
  ]);

  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("down") });
  await expect(getNotifications()).resolves.toEqual([]);
});

test("markNotificationsRead calls the RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await markNotificationsRead();
  expect(supabase.rpc).toHaveBeenCalledWith("mark_notifications_read");
});
