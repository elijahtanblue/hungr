import {
  cleanTikTokTitle,
  hashtagsFromTitle,
  isSafeTikTokUrl,
  shapeCandidates,
  videoIdFromUrl,
} from "./index.ts";

Deno.test("isSafeTikTokUrl accepts only https TikTok hosts", () => {
  if (!isSafeTikTokUrl("https://www.tiktok.com/@creator/video/123")) throw new Error("expected canonical TikTok URL");
  if (!isSafeTikTokUrl("https://vm.tiktok.com/ZM123/")) throw new Error("expected short TikTok URL");
  if (isSafeTikTokUrl("http://www.tiktok.com/@creator/video/123")) throw new Error("http must be rejected");
  if (isSafeTikTokUrl("https://evil.com/@creator/video/123")) throw new Error("non-TikTok host must be rejected");
  if (isSafeTikTokUrl("not a url")) throw new Error("invalid URL must be rejected");
});

Deno.test("videoIdFromUrl extracts TikTok post ids when present", () => {
  if (videoIdFromUrl("https://www.tiktok.com/@creator/video/1234567890") !== "1234567890") {
    throw new Error("expected video id from canonical URL");
  }
  if (videoIdFromUrl("https://vm.tiktok.com/ZM123/") !== null) {
    throw new Error("short URLs do not expose the video id before redirect");
  }
});

Deno.test("cleanTikTokTitle removes hashtags and collapses whitespace", () => {
  const out = cleanTikTokTitle("Best steak night at The Gidley   #sydneyfood #steak");
  if (out !== "Best steak night at The Gidley") throw new Error(`unexpected title: ${out}`);
});

Deno.test("hashtagsFromTitle extracts clean hashtags as TikTok taste signals", () => {
  const out = hashtagsFromTitle("Best steak night #SydneyFood #steak #steak #ThisTagIsWayTooLongForTasteTracking");
  const expected = JSON.stringify(["sydneyfood", "steak"]);
  if (JSON.stringify(out) !== expected) throw new Error(`unexpected hashtags: ${JSON.stringify(out)}`);
});

Deno.test("shapeCandidates marks exact caption mentions as recommended", () => {
  const out = shapeCandidates(
    [
      {
        id: "p1",
        displayName: { text: "The Gidley" },
        formattedAddress: "Basement, 161 King St, Sydney NSW",
        location: { latitude: -33.87, longitude: 151.21 },
        rating: 4.7,
        primaryType: "steak_house",
        types: ["restaurant", "steak_house"],
      },
    ],
    "Best steak night at The Gidley in Sydney",
  );

  if (out.length !== 1) throw new Error("expected one candidate");
  if (!out[0].recommended) throw new Error("exact mention should be recommended");
  if (out[0].confidence !== 0.99) throw new Error(`unexpected confidence ${out[0].confidence}`);
  if (!out[0].evidence.includes("caption mentions The Gidley")) throw new Error("evidence should cite the title");
});

Deno.test("shapeCandidates returns only top three candidates above threshold", () => {
  const raw = ["A Noodle House", "A Noodle Bar", "A Noodle Kitchen", "A Noodle Express"].map((name, index) => ({
    id: `p${index}`,
    displayName: { text: name },
    formattedAddress: `Address ${index}`,
    location: { latitude: index, longitude: index + 1 },
    types: ["restaurant"],
  }));

  const out = shapeCandidates(raw, "A Noodle House, A Noodle Bar, A Noodle Kitchen, and A Noodle Express");

  if (out.length !== 3) throw new Error(`expected top three, got ${out.length}`);
  if (out[0].placeId !== "p0") throw new Error("best candidate should stay first");
  if (out.some((candidate) => candidate.confidence < 0.9)) throw new Error("low-confidence candidate leaked");
});
