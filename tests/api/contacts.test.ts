import { matchContacts, registerContactIdentity } from "../../src/api/contacts";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
// Deterministic, native-free hash so we can assert exactly what is sent to the server.
jest.mock("../../src/lib/sha256", () => ({
  sha256Hex: jest.fn((v: string) => Promise.resolve(`h(${v})`)),
}));

beforeEach(() => jest.clearAllMocks());

test("registerContactIdentity calls the RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await registerContactIdentity();
  expect(supabase.rpc).toHaveBeenCalledWith("register_contact_identity");
});

test("matchContacts hashes identifiers and maps the matched users", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "u2", username: "kai", display_name: "Kai" }],
    error: null,
  });

  const out = await matchContacts([{ emails: ["Me@x.com"], phones: ["0412 345 678"] }]);

  // Only hashes are sent, never the raw identifiers.
  const call = (supabase.rpc as jest.Mock).mock.calls[0];
  expect(call[0]).toBe("match_contacts");
  expect(call[1].hashes.sort()).toEqual(["h(0412345678)", "h(me@x.com)"]);
  expect(out).toEqual([{ id: "u2", username: "kai", displayName: "Kai" }]);
});

test("matchContacts skips the server call when there is nothing to match", async () => {
  const out = await matchContacts([{ emails: [], phones: ["12"] }]);
  expect(out).toEqual([]);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("matchContacts surfaces an RPC error", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("denied") });
  await expect(matchContacts([{ emails: ["a@b.com"] }])).rejects.toThrow("denied");
});
