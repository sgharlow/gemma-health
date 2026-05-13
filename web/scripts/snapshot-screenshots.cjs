/**
 * Capture the three Kaggle Media Gallery screenshots that overwrite assets/*.png.
 * Requires playwright (npm i -D playwright; npx playwright install chromium).
 *
 * Captures (full-page, 1280x800 viewport, 2x DPI):
 *   1. screenshot-sovereignty-block.png — from PROD (https://gemma-health.vercel.app)
 *      Egress → CMS, blank signature → "Build envelope" → red REQUIRES SIGNATURE card
 *   2. screenshot-edge.png — from LOCAL (http://localhost:3000/edge)
 *      Use simulated narrative → Load → Run scan → Verify chain → Offline → Run scan again
 *      Final state: green offline banner + populated ledger + streamed summary
 *   3. screenshot-onprem-home.png — from LOCAL (http://localhost:3000)
 *      Just the home page in its fresh state (post-deploy current UI)
 *
 * Usage:
 *   # Make sure `npm run dev` is up at port 3000 (for captures 2 + 3)
 *   node scripts/snapshot-screenshots.cjs
 */

const path = require("node:path");
const fs = require("node:fs");

const ASSETS_DIR = path.resolve(__dirname, "..", "..", "assets");
const PROD_URL = "https://gemma-health.vercel.app";
const LOCAL_URL = process.env.LOCAL_URL || "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };

function out(name) {
  return path.join(ASSETS_DIR, name);
}

async function captureSovereigntyFromProd(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(PROD_URL, { waitUntil: "networkidle", timeout: 30000 });

  // Destination defaults to CMS; signature defaults to blank. Just click Build envelope.
  await page.locator("#egress-destination").selectOption("CMS");
  await page.locator("#egress-signature").fill("");
  await page.getByRole("button", { name: "Build envelope" }).click();

  // Wait for the red REQUIRES SIGNATURE card.
  await page.getByText("Sovereignty Mode REQUIRES SIGNATURE").waitFor({ timeout: 15000 });
  await page.waitForTimeout(400); // let any layout settle

  const file = out("screenshot-sovereignty-block.png");
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

async function captureEdgeOfflineProof(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${LOCAL_URL}/edge`, { waitUntil: "networkidle", timeout: 30000 });

  // Step 1: toggle simulated mode (skip the 1.8 GB WebGPU download)
  await page.getByRole("button", { name: "Use simulated narrative" }).click();

  // Click Load — in simulated mode this completes instantly.
  // Use exact match so we don't also match the disabled "Load the model first" button.
  await page.getByRole("button", { name: "Load Gemma 4 E2B", exact: true }).click();

  // Wait for ready state — button text changes to "Run care-gap scan" or the
  // model-loaded chip appears.
  await page.getByRole("button", { name: "Run care-gap scan" }).waitFor({ timeout: 30000 });

  // Step 2: pick the first facility (DEMO-CAH-001) — use selectOption so the
  // React change handler fires and selectedFacility state updates.
  await page.locator("#facility-select").selectOption({ index: 1 });
  await page.waitForTimeout(200);

  // Run the simulated scan; wait for the "streaming locally" label to appear
  // (rendered as part of the summary section once streaming or summary is non-empty)
  await page.getByRole("button", { name: "Run care-gap scan" }).click();
  await page.getByText(/streaming locally/i).waitFor({ timeout: 45000 });
  // Wait for streaming text to settle (simulated mode streams character-by-character)
  await page.waitForTimeout(2500);

  // Click Verify chain integrity, wait for chain-valid banner
  await page.getByRole("button", { name: "Verify chain integrity" }).click();
  await page.getByText(/Chain valid|entries verified/i).waitFor({ timeout: 10000 });

  // THE PROOF SHOT: go offline, run the scan again, screenshot the result
  await ctx.setOffline(true);
  // The network status indicator flips from amber to emerald when navigator.onLine becomes false
  await page.waitForFunction(() => !navigator.onLine, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Run care-gap scan" }).click();
  // Offline-mode scan still produces output (simulated narrative is local).
  // Give it a beat to populate, then screenshot.
  await page.waitForTimeout(3000);

  const file = out("screenshot-edge.png");
  await page.screenshot({ path: file, fullPage: true });
  await ctx.setOffline(false);
  await ctx.close();
  return file;
}

async function captureOnPremHome(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(LOCAL_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);

  const file = out("screenshot-onprem-home.png");
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

(async () => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("Playwright not installed. Run `npm install -D playwright && npx playwright install chromium` in web/.");
    process.exit(1);
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const captures = [
    ["sovereignty (prod)", captureSovereigntyFromProd],
    ["edge offline proof (local)", captureEdgeOfflineProof],
    ["on-prem home (local)", captureOnPremHome],
  ];

  for (const [label, fn] of captures) {
    process.stdout.write(`[${label}] capturing... `);
    try {
      const file = await fn(browser);
      const stat = fs.statSync(file);
      console.log(`✓ ${path.basename(file)} (${(stat.size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  await browser.close();
})();
