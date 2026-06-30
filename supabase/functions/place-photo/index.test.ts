import { isPhotoName, clampWidth } from "./index.ts";

Deno.test("isPhotoName accepts the Google photo resource format and rejects junk", () => {
  if (!isPhotoName("places/ChIJ_abc-123/photos/Aref-XYZ_9")) throw new Error("valid name rejected");
  if (isPhotoName("places/abc/photos/../../secret")) throw new Error("path traversal accepted");
  if (isPhotoName("not-a-photo")) throw new Error("garbage accepted");
  if (isPhotoName(42)) throw new Error("non-string accepted");
});

Deno.test("clampWidth keeps the request within sane bounds", () => {
  if (clampWidth(99999) !== 1200) throw new Error("upper bound not enforced");
  if (clampWidth(1) !== 120) throw new Error("lower bound not enforced");
  if (clampWidth(undefined) !== 600) throw new Error("default missing");
});
