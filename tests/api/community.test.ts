import { getCommunity } from "../../src/api/community";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

test("getCommunity rejects when any community query fails", async () => {
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("reviews blocked") }),
        }),
      }),
    })
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

  await expect(getCommunity("p1")).rejects.toThrow("reviews blocked");
});
