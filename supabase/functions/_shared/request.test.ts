import { readJsonObject } from "./request.ts";

Deno.test("readJsonObject returns a 400 response for invalid JSON", async () => {
  const result = await readJsonObject(new Request("http://local.test", { method: "POST", body: "{" }));
  if (result.ok) throw new Error("invalid JSON should not parse");
  if (result.response.status !== 400) throw new Error("invalid JSON should return 400");
});

Deno.test("readJsonObject returns a 400 response for non-object JSON", async () => {
  const result = await readJsonObject(new Request("http://local.test", { method: "POST", body: "[]" }));
  if (result.ok) throw new Error("arrays should not parse as request objects");
  if (result.response.status !== 400) throw new Error("non-object JSON should return 400");
});
