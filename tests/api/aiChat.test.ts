import { askAiChat } from "../../src/api/aiChat";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

beforeEach(() => jest.clearAllMocks());

test("askAiChat invokes the backend chat function and shapes the response", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { answer: "Try two reliable ramen spots.", followUpQuestion: "Which area?", memoriesUpdated: 2 },
    error: null,
  });

  await expect(askAiChat("date night ramen")).resolves.toEqual({
    answer: "Try two reliable ramen spots.",
    followUpQuestion: "Which area?",
    memoriesUpdated: 2,
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("ai-chat", {
    body: { message: "date night ramen" },
  });
});

test("askAiChat can send recent in-session messages for follow-up context", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { answer: "Shortlist adventurous Asian restaurants in Sydney CBD.", followUpQuestion: null, memoriesUpdated: 0 },
    error: null,
  });

  await askAiChat("Sydney CBD, under $200pp, adventurous", [
    { role: "user", text: "Looking for a date night anniversary dinner" },
    { role: "assistant", text: "Tell me the area, budget, and whether you want reliable or adventurous." },
  ]);

  expect(supabase.functions.invoke).toHaveBeenCalledWith("ai-chat", {
    body: {
      message: "Sydney CBD, under $200pp, adventurous",
      recentMessages: [
        { role: "user", text: "Looking for a date night anniversary dinner" },
        { role: "assistant", text: "Tell me the area, budget, and whether you want reliable or adventurous." },
      ],
    },
  });
});

test("askAiChat rejects malformed backend responses", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { answer: 123 }, error: null });
  await expect(askAiChat("dinner")).rejects.toThrow("Invalid AI chat response");
});
