/**
 * Pre-submit verification — run before clicking Submit on Kaggle.
 *
 *   node scripts/verify-submission.cjs
 *
 * Checks (each prints PASS/FAIL/SKIP):
 *   1. WRITEUP.md prose word count under 1,500
 *   2. Required submission files exist (WRITEUP, README, LICENSE, NOTICE,
 *      docs/SUBMIT-CHECKLIST, assets/cover.png)
 *   3. WRITEUP.md does not still contain placeholder "_replace with YouTube link_"
 *   4. Live demo URLs return 200
 *   5. Vitest tests pass
 *
 * Exits 0 if everything's PASS or SKIP, 1 if any FAIL.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
let failed = 0;

function pass(name, msg) { console.log(`  ✓ ${name}${msg ? "  " + msg : ""}`); }
function fail(name, msg) { console.log(`  ✗ ${name}${msg ? "  " + msg : ""}`); failed++; }
function skip(name, msg) { console.log(`  · ${name} (skipped)${msg ? "  " + msg : ""}`); }

console.log("\n[1/5] WRITEUP word count under 1,500 prose-words");
{
  try {
    const text = fs.readFileSync(path.join(ROOT, "WRITEUP.md"), "utf8");
    const prose = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^\|.*\|.*$/gm, "")
      .replace(/^---$/gm, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[#>*_\-]/g, " ");
    const words = prose.split(/\s+/).filter(Boolean).length;
    if (words <= 1500) pass("word count", `${words}/1500`);
    else fail("word count", `${words}/1500 — OVER LIMIT`);
  } catch (e) { fail("word count", e.message); }
}

console.log("\n[2/5] Required submission files exist");
{
  const required = [
    "WRITEUP.md",
    "README.md",
    "LICENSE",
    "NOTICE",
    "BRIEF.md",
    "STATUS.md",
    "docs/STORY.md",
    "docs/SUBMIT-CHECKLIST.md",
    "assets/cover.png",
    "assets/screenshot-onprem-home.png",
    "assets/screenshot-edge.png",
    "assets/screenshot-sovereignty-block.png",
    "assets/demo.vtt",
  ];
  for (const f of required) {
    if (fs.existsSync(path.join(ROOT, f))) pass(f);
    else fail(f, "MISSING");
  }
}

console.log("\n[3/5] WRITEUP placeholders cleared");
{
  try {
    const text = fs.readFileSync(path.join(ROOT, "WRITEUP.md"), "utf8");
    const placeholders = ["_replace with YouTube link_", "TODO", "TBD"];
    let any = false;
    for (const p of placeholders) {
      if (text.includes(p)) {
        if (p.startsWith("_replace")) {
          fail("video URL placeholder", `still says '${p}' — paste the YouTube URL before submitting`);
        } else {
          fail(p, `WRITEUP.md still contains '${p}'`);
        }
        any = true;
      }
    }
    if (!any) pass("placeholders cleared");
  } catch (e) { fail("placeholder check", e.message); }
}

console.log("\n[4/5] Live demo URLs reachable");
{
  const targets = [
    "https://gemma-health.vercel.app/",
    "https://gemma-health.vercel.app/edge",
    "https://gemma-health.vercel.app/api/health",
    "https://gemma-health.vercel.app/api/ledger",
    "https://gemma-health.vercel.app/cover",
  ];
  (async () => {
    for (const url of targets) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (r.status === 200) pass(url);
        else fail(url, `HTTP ${r.status}`);
      } catch (e) { fail(url, e.message); }
    }
    finalReport();
  })();
}

console.log("\n[5/5] Tests still green");
{
  try {
    execSync("npm run test --silent", {
      cwd: path.join(ROOT, "web"),
      stdio: "pipe",
      env: { ...process.env, STUB_LLM_REDACTION: "true" },
      timeout: 120000,
    });
    pass("vitest run");
  } catch (e) {
    fail("vitest run", "tests failed — see `cd web && npm run test`");
  }
}

function finalReport() {
  console.log();
  if (failed > 0) {
    console.log(`✗ ${failed} check(s) failed. Fix before submitting.`);
    process.exit(1);
  } else {
    console.log("✓ All checks passed. Submission is ready.");
    process.exit(0);
  }
}
