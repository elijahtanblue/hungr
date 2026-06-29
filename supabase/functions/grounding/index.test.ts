import { shapeGrounded } from "./index.ts";

Deno.test("shapeGrounded keeps the answer and required source links", () => {
  const raw = {
    candidates: [{ content: { parts: [{ text: "Known for mapo tofu." }] } }],
    groundingMetadata: { sourceLinks: ["https://maps.google.com/?cid=1"] },
  };
  const out = shapeGrounded(raw);
  if (!out.text.includes("mapo tofu")) throw new Error("answer missing");
  if (out.sources.length !== 1) throw new Error("source links are required and must pass through");
});
