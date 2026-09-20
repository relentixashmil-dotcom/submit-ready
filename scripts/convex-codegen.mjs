/**
 * Refreshes the Convex-generated bindings in `src/convex/_generated` as the
 * first step of the production build, so `tsc` and Vite resolve
 * `@/convex/_generated/api` and `./_generated/server` against freshly written
 * code.
 *
 * `convex codegen` always talks to a Convex deployment and only authenticates
 * non-interactively with CONVEX_DEPLOY_KEY, so this step is skipped when no
 * deploy key is present. The generated files are committed to this repository —
 * Convex's own CLI requires that, because the app does not typecheck or bundle
 * without them — which is what lets a checkout with no Convex credentials (a
 * Vercel build, for example) build the app from the checked-in bindings.
 *
 * Set CONVEX_DEPLOY_KEY on the build environment to regenerate them mid-build.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedEntry = path.join(root, "src/convex/_generated/api.js");

function convexBin() {
  const local = ["convex", "convex.cmd"]
    .map((name) => path.join(root, "node_modules/.bin", name))
    .find((candidate) => fs.existsSync(candidate));
  return local ?? "convex";
}

if (!process.env.CONVEX_DEPLOY_KEY) {
  if (!fs.existsSync(generatedEntry)) {
    console.error(
      "✖ src/convex/_generated is missing and CONVEX_DEPLOY_KEY is not set, so it cannot be generated.\n" +
        "  Run `npx convex dev` (or `npm run convex:codegen` with a deployment configured) and commit src/convex/_generated.",
    );
    process.exit(1);
  }
  console.log(
    "• Convex bindings: using the checked-in src/convex/_generated (CONVEX_DEPLOY_KEY is not set).",
  );
  process.exit(0);
}

console.log("• Convex bindings: regenerating with `convex codegen` (CONVEX_DEPLOY_KEY is set).");
const result = spawnSync(convexBin(), ["codegen"], { cwd: root, stdio: "inherit" });
if (result.error) {
  console.error(`✖ Could not run \`convex codegen\`: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
