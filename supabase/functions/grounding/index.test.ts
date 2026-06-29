import { shapeGrounded } from "./index.ts";

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
