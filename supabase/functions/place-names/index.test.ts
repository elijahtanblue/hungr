import { safeIds } from "./index.ts";

Deno.test("safeIds keeps valid place_id tokens and drops the rest", () => {
  const out = safeIds(["ChIJ_abc-123", "bad id!", 42, "", "ChIJxyz"]);
  if (out.length !== 2) throw new Error("expected two valid ids");
  if (!out.includes("ChIJ_abc-123") || !out.includes("ChIJxyz")) throw new Error("valid ids dropped");
});

Deno.test("safeIds caps the batch and tolerates non-arrays", () => {
  if (safeIds("nope").length !== 0) throw new Error("non-array must yield empty");
  const many = Array.from({ length: 50 }, (_, i) => `id${i}`);
  if (safeIds(many).length !== 30) throw new Error("batch must cap at 30");
});
