import { cleanTranslationText, isSupportedTargetLanguage } from "./index.ts";

Deno.test("isSupportedTargetLanguage accepts compact language tags only", () => {
  if (!isSupportedTargetLanguage("en")) throw new Error("en rejected");
  if (!isSupportedTargetLanguage("zh-CN")) throw new Error("zh-CN rejected");
  if (isSupportedTargetLanguage("../en")) throw new Error("path-looking language accepted");
  if (isSupportedTargetLanguage("english please")) throw new Error("sentence accepted as language");
});

Deno.test("cleanTranslationText trims and caps Google review text", () => {
  if (cleanTranslationText("  hello  ") !== "hello") throw new Error("text not trimmed");
  if (cleanTranslationText("x".repeat(5001)).length !== 5000) throw new Error("text cap missing");
  if (cleanTranslationText("   ") !== "") throw new Error("blank text should clean to empty");
});
