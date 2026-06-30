import { translateGoogleReview } from "../../src/api/googleReviewTranslation";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

beforeEach(() => jest.clearAllMocks());

test("translateGoogleReview calls the translate-review edge function", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { translatedText: "Great noodles", targetLanguage: "en" },
    error: null,
  });

  await expect(translateGoogleReview("Buen fideo", "en")).resolves.toBe("Great noodles");
  expect(supabase.functions.invoke).toHaveBeenCalledWith("translate-review", {
    body: { text: "Buen fideo", targetLanguage: "en" },
  });
});

test("translateGoogleReview returns null for blank or failed translations", async () => {
  await expect(translateGoogleReview("   ")).resolves.toBeNull();
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error("down") });
  await expect(translateGoogleReview("Bonjour")).resolves.toBeNull();
});
