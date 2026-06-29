type JsonObject = Record<string, unknown>;

type JsonObjectResult =
  | { ok: true; value: JsonObject }
  | { ok: false; response: Response };

export async function readJsonObject(req: Request): Promise<JsonObjectResult> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    return { ok: false, response: new Response("Invalid JSON", { status: 400 }) };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, response: new Response("Invalid request body", { status: 400 }) };
  }

  return { ok: true, value: value as JsonObject };
}
