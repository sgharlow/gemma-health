/**
 * Snapshot a marketing-image route → assets/*.png.
 *
 * Supports /cover (Media Gallery hero), /cover-thumb (Kaggle Card/Thumbnail),
 * and /youtube-thumb (YouTube thumbnail).
 *
 * Targets either a local dev/prod server (default) OR a remote URL — handy
 * for re-snapping all three marketing images from Vercel prod without needing
 * a local dev server up:
 *
 *   # Local (npm run dev or npm run start on :3000):
 *   node scripts/snapshot-cover.cjs                                  # /cover → 2400×1260
 *   COVER_PATH=/cover-thumb node scripts/snapshot-cover.cjs          # /cover-thumb → 560×280
 *   COVER_PATH=/youtube-thumb node scripts/snapshot-cover.cjs        # /youtube-thumb → 2560×1440
 *
 *   # Remote (Vercel prod):
 *   SNAPSHOT_HOST=https://gemma-health.vercel.app node scripts/snapshot-cover.cjs
 *   SNAPSHOT_HOST=https://gemma-health.vercel.app COVER_PATH=/cover-thumb node scripts/snapshot-cover.cjs
 *   SNAPSHOT_HOST=https://gemma-health.vercel.app COVER_PATH=/youtube-thumb node scripts/snapshot-cover.cjs
 *
 * /cover-thumb is snapped at deviceScaleFactor=1 — Kaggle's Card/Thumbnail
 * field requires the exact 560×280 dimensions and rejects upscaled retina
 * variants. The other two routes use deviceScaleFactor=2 for retina sharpness.
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
  const coverPath = process.env.COVER_PATH || "/cover";
  const host = process.env.SNAPSHOT_HOST || `http://localhost:${port}`;

  const ROUTE_CONFIG = {
    "/cover": { viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, outFile: "cover.png" },
    "/cover-thumb": { viewport: { width: 560, height: 280 }, deviceScaleFactor: 1, outFile: "cover-thumb.png" },
    "/youtube-thumb": { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, outFile: "youtube-thumb.png" },
  };
  const cfg = ROUTE_CONFIG[coverPath];
  if (!cfg) {
    console.error(`Unknown COVER_PATH '${coverPath}'. Supported: ${Object.keys(ROUTE_CONFIG).join(", ")}`);
    process.exit(1);
  }

  const url = `${host}${coverPath}`;
  const outPath = path.resolve(__dirname, "..", "..", "assets", cfg.outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath, omitBackground: false });
  await browser.close();
  console.log(`wrote ${outPath} from ${url} (${cfg.viewport.width * cfg.deviceScaleFactor}×${cfg.viewport.height * cfg.deviceScaleFactor})`);
})();
