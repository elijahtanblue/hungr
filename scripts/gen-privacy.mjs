// Generates src/content/privacyPolicy.ts from PRIVACY_POLICY.md (the canonical legal source), so the
// in-app policy screen and the repo document never drift. Run: npm run gen:privacy
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const md = fs.readFileSync(path.join(root, "PRIVACY_POLICY.md"), "utf8");

// Escape for a JS template literal: backslashes first, then backticks and ${ interpolation starts.
const escaped = md.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `// Auto-generated from PRIVACY_POLICY.md by scripts/gen-privacy.mjs. Do not edit by hand;
// edit PRIVACY_POLICY.md and run \`npm run gen:privacy\` so the in-app text and the repo file stay in sync.
export const PRIVACY_POLICY_MARKDOWN = \`${escaped}\`;
`;

fs.writeFileSync(path.join(root, "src", "content", "privacyPolicy.ts"), out);
console.log("Wrote src/content/privacyPolicy.ts from PRIVACY_POLICY.md");
