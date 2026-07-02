import { buildGroundingPrompt, shapeGrounded } from "./index.ts";

Deno.test("shapeGrounded reads the answer and candidate-level grounding source links", () => {
  // Real Gemini shape: groundingMetadata is on the candidate, sources in groundingChunks.
  const raw = {
    candidates: [{
      content: { parts: [{ text: "Known for mapo tofu." }] },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: "https://maps.google.com/?cid=1", title: "Spicy World" } },
        ],
      },
    }],
  };
  const out = shapeGrounded(raw);
  if (!out.text.includes("mapo tofu")) throw new Error("answer missing");
  if (out.sources.length !== 1 || out.sources[0] !== "https://maps.google.com/?cid=1") {
    throw new Error("source links are required and must come from candidate groundingChunks");
  }
});

Deno.test("shapeGrounded returns no sources when grounding metadata is absent", () => {
  const out = shapeGrounded({ candidates: [{ content: { parts: [{ text: "x" }] } }] });
  if (out.sources.length !== 0) throw new Error("absent metadata must yield zero sources");
});

Deno.test("shapeGrounded normalizes obvious AI-style artifacts in answer copy", () => {
  const out = shapeGrounded({
    candidates: [{
      content: { parts: [{ text: "Reliable — unlock a seamless dinner option." }] },
      groundingMetadata: {
        groundingChunks: [{ web: { uri: "https://maps.google.com/?cid=1" } }],
      },
    }],
  });
  if (out.text.includes("—")) throw new Error("answer should not include em dashes");
  if (/unlock|seamless/i.test(out.text)) throw new Error("answer should remove common filler phrases");
});

Deno.test("buildGroundingPrompt includes backend AI style guardrails", () => {
  const prompt = buildGroundingPrompt("Spicy World");
  if (!prompt.includes("No em dashes")) throw new Error("prompt should include punctuation guardrails");
  if (!prompt.includes("No X, not Y")) throw new Error("prompt should include contrast-cliche guardrails");
  if (!prompt.includes("restaurant, cafe, bar, or food place")) {
    throw new Error("prompt should keep the model scoped to food discovery");
  }
});
