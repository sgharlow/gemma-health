/**
 * Snapshot the /cover page at 1200x630 → assets/cover.png.
 * Requires the dev or prod server to be running locally on PORT (default 3000).
 *
 * Usage:
 *   npm run dev          # in another terminal
 *   node scripts/snapshot-cover.cjs
 *   # → assets/cover.png written
 */

const path = require("node:path");
const fs = require("node:fs");

(async () => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("Playwright not installed. Run `npm install -D playwright` then `npx playwright install chromium`.");
    process.exit(1);
  }
  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/cover`;
  const outPath = path.resolve(__dirname, "..", "..", "assets", "cover.png");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath, omitBackground: false });
  await browser.close();
  console.log(`wrote ${outPath}`);
})();
