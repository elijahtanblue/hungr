import {
  AI_CHAT_STYLE_GUARDRAILS,
  findAiStyleViolations,
  normalizeAiCopyStyle,
} from "./ai_style.ts";

Deno.test("AI chat style guardrails ban common artificial phrasing", () => {
  if (!AI_CHAT_STYLE_GUARDRAILS.includes("No em dashes")) {
    throw new Error("guardrails must explicitly ban em dashes");
  }
  if (!AI_CHAT_STYLE_GUARDRAILS.includes("No X, not Y")) {
    throw new Error("guardrails must explicitly ban contrast-cliche phrasing");
  }
  if (!AI_CHAT_STYLE_GUARDRAILS.includes("Ask one clear follow-up question")) {
    throw new Error("guardrails must limit chat follow-up questions");
  }
  if (AI_CHAT_STYLE_GUARDRAILS.includes("—")) {
    throw new Error("guardrail text must not contain the banned punctuation itself");
  }
});

Deno.test("findAiStyleViolations catches em dashes, contrast cliches, and filler phrases", () => {
  const violations = findAiStyleViolations(
    "Safe, not boring, but still polished — unlock a seamless dining experience.",
  );
  for (const expected of ["em_dash", "x_not_y", "not_but", "slop_phrase"]) {
    if (!violations.includes(expected)) {
      throw new Error(`missing violation: ${expected}`);
    }
  }
});

Deno.test("findAiStyleViolations allows direct natural restaurant guidance", () => {
  const violations = findAiStyleViolations(
    "You usually save Japanese and Thai places. For tonight, I would shortlist two reliable options and one adventurous pick.",
  );
  if (violations.length !== 0) {
    throw new Error(`unexpected violations: ${violations.join(", ")}`);
  }
});

Deno.test("normalizeAiCopyStyle removes banned punctuation and common filler phrases", () => {
  const normalized = normalizeAiCopyStyle(
    "This place is cozy — unlock a seamless date night.",
  );
  if (normalized.includes("—")) throw new Error("em dash should be removed");
  if (/unlock|seamless/i.test(normalized)) throw new Error("filler phrase should be removed");
  if (!normalized.includes("This place is cozy")) throw new Error("meaningful copy should remain");
});

Deno.test("normalizeAiCopyStyle removes common contrast-cliche phrasing", () => {
  const normalized = normalizeAiCopyStyle(
    "Reliable, not flashy, but good for a low-risk dinner.",
  );
  if (/, not /i.test(normalized)) throw new Error("X, not Y phrasing should be removed");
  if (/\bnot\b[^.!?\n]{0,80}\bbut\b/i.test(normalized)) {
    throw new Error("not X, but Y phrasing should be removed");
  }
  if (!normalized.includes("Reliable")) throw new Error("leading useful copy should remain");
});
