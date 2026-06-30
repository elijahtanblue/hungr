import { resolveTikTokLink, saveTikTokCandidate } from "../../src/api/tiktokImport";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    rpc: jest.fn(),
  },
}));

beforeEach(() => jest.clearAllMocks());

const source = {
  url: "https://www.tiktok.com/@creator/video/123",
  videoId: "123",
  creator: "Creator",
  creatorUrl: "https://www.tiktok.com/@creator",
  title: "Best steak night at The Gidley",
};

const candidate = {
  placeId: "place-1",
  name: "The Gidley",
  address: "161 King St, Sydney",
  lat: -33.87,
  lng: 151.21,
  rating: 4.7,
  cuisines: ["Steakhouse"],
  confidence: 0.99,
  recommended: true,
  evidence: "TikTok caption mentions The Gidley.",
};

test("resolveTikTokLink invokes the tiktok import edge function with location bias", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { source, dishTags: ["steak"], candidates: [candidate] },
    error: null,
  });

  const out = await resolveTikTokLink(source.url, { lat: -33.87, lng: 151.21 });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("tiktok-import", {
    body: { url: source.url, lat: -33.87, lng: 151.21 },
  });
  expect(out.candidates[0].name).toBe("The Gidley");
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("resolveTikTokLink rejects malformed function responses", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { nope: true }, error: null });

  await expect(resolveTikTokLink(source.url, { lat: 0, lng: 0 })).rejects.toThrow("Invalid TikTok import response");
});

test("saveTikTokCandidate writes the confirmed place and source context through RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(saveTikTokCandidate(source, candidate, ["steak"])).resolves.toBe(true);

  expect(supabase.rpc).toHaveBeenCalledWith("save_tiktok_source", {
    target_place_id: "place-1",
    input_source_url: source.url,
    input_source_video_id: "123",
    input_creator_handle: "Creator",
    input_caption: "Best steak night at The Gidley",
    input_evidence: "TikTok caption mentions The Gidley.",
    input_dish_tags: ["steak"],
    input_confidence: 0.99,
  });
});
