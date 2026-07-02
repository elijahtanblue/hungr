import {
  deleteMyTasteEvents,
  getTasteFeatureScores,
  getTasteTrackingSettings,
  recordSearchTasteEvent,
  recordReviewTagTaste,
  setTasteTrackingEnabled,
} from "../../src/api/tasteTracking";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("recordReviewTagTaste records a review tag as a taste signal for the tagger", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(recordReviewTagTaste("p1", "  Spicy  ")).resolves.toBe(true);

  expect(supabase.rpc).toHaveBeenCalledWith("record_taste_event", {
    input_event_type: "review_text_tag",
    input_place_id: "p1",
    input_tag: "Spicy",
    input_signal: "review_tag",
    input_weight: 1,
    input_source: "review",
  });
});

test("recordReviewTagTaste ignores an empty tag without calling the server", async () => {
  await expect(recordReviewTagTaste("p1", "   ")).resolves.toBe(false);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("recordSearchTasteEvent sends only structured facets, never raw query text", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 2, error: null });

  await expect(recordSearchTasteEvent({
    cuisines: ["Japanese", "Ramen"],
    dietary: ["vegetarian"],
    priceBand: { min: 2, max: 3 },
    occasion: "date_night",
  })).resolves.toBe(2);

  expect(supabase.rpc).toHaveBeenCalledWith("record_search_taste_event", {
    input_cuisines: ["Japanese", "Ramen"],
    input_dietary: ["vegetarian"],
    input_price_min: 2,
    input_price_max: 3,
    input_occasion: "date_night",
  });
});

test("getTasteFeatureScores maps backend score rows", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ feature: "cuisine:japanese", score: "12.5", evidence_count: 3, last_seen_at: "2026-07-01T00:00:00Z" }],
    error: null,
  });

  await expect(getTasteFeatureScores()).resolves.toEqual([
    { feature: "cuisine:japanese", score: 12.5, evidenceCount: 3, lastSeenAt: "2026-07-01T00:00:00Z" },
  ]);
});

test("taste tracking calls are best effort", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("blocked") });
  await expect(recordSearchTasteEvent({ cuisines: ["Thai"] })).resolves.toBe(0);
  await expect(getTasteFeatureScores()).resolves.toEqual([]);
});

test("getTasteTrackingSettings reads the opt-out setting", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ taste_tracking_enabled: false }],
    error: null,
  });

  await expect(getTasteTrackingSettings()).resolves.toEqual({ tasteTrackingEnabled: false });
  expect(supabase.rpc).toHaveBeenCalledWith("get_taste_tracking_settings");
});

test("setTasteTrackingEnabled saves the opt-out setting", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(setTasteTrackingEnabled(false)).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith("set_taste_tracking_enabled", { enabled: false });
});

test("deleteMyTasteEvents calls the explicit delete RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
  await expect(deleteMyTasteEvents()).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith("delete_my_taste_events");
});
