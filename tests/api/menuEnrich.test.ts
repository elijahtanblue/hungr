import { enqueueMenuEnrich } from "../../src/api/menuEnrich";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) } },
}));

beforeEach(() => jest.clearAllMocks());

function place(id: string, lng?: number): Place {
  return { placeId: id, name: id, lat: 0, lng: lng as number, cuisines: [] };
}

test("enqueues surfaced places with their longitude", () => {
  enqueueMenuEnrich([place("ChIJ_a_111111", 151.2), place("ChIJ_b_222222", 151.3)]);
  expect(supabase.functions.invoke).toHaveBeenCalledWith("menu-enqueue", {
    body: { places: [{ placeId: "ChIJ_a_111111", lng: 151.2 }, { placeId: "ChIJ_b_222222", lng: 151.3 }] },
  });
});

test("skips places without a longitude and caps at 10", () => {
  const many = Array.from({ length: 15 }, (_, i) => place(`ChIJ_p_${i}00000`, 100));
  many.push({ placeId: "ChIJ_nolng", name: "x", lat: 0, lng: undefined as unknown as number, cuisines: [] });
  enqueueMenuEnrich(many);
  const arg = (supabase.functions.invoke as jest.Mock).mock.calls[0][1].body.places;
  expect(arg.length).toBe(10);
});

test("does nothing when there are no places with a longitude", () => {
  enqueueMenuEnrich([{ placeId: "x", name: "x", lat: 0, lng: undefined as unknown as number, cuisines: [] }]);
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
