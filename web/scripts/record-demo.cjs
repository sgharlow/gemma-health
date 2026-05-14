/**
 * Rough-cut demo video recorder — Playwright-driven walkthrough.
 *
 * Records a ~90-second silent visual reference of the recordable scenes
 * (sovereignty block / signed envelope on /, then the /edge offline live demo)
 * so Steve has a storyboard to follow when recording the real submission on
 * the Mac.
 *
 * Skipped scenes: scene 2 (chat → tool calls) needs Ollama, scene 3 (webcam
 * capture) needs a real camera + Gemma vision. Steve covers those on the Mac.
 *
 * Captions on-screen quote VIDEO-SCRIPT.md voiceover text so the silent reel
 * still reads as a narrative reference, not a raw screen capture.
 *
 * Usage:
 *   # Make sure server is up with STUBs:
 *   PORT=3001 STUB_LLM_REDACTION=true STUB_VISION=true npm run start &
 *   node scripts/record-demo.cjs
 *   # output: assets/recordings/demo-rough-cut.webm
 */

const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const { chromium } = require("playwright");

const HOST = process.env.RECORD_HOST || "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "..", "..", "assets", "recordings");
const FINAL_NAME = "demo-rough-cut.webm";
const VIEWPORT = { width: 1280, height: 720 };

async function injectCaption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      el.style.cssText = `
        position: fixed; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.78); color: white;
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        font-size: 20px; font-weight: 500; line-height: 1.4;
        padding: 18px 40px; z-index: 99999;
        text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        border-top: 2px solid #a3e635;
      `;
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function clearCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById("__demo_caption");
    if (el) el.remove();
  });
}

async function injectTitleCard(page, lines) {
  await page.evaluate((ls) => {
    let el = document.getElementById("__demo_title_card");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_title_card";
      el.style.cssText = `
        position: fixed; inset: 0; background:
        linear-gradient(135deg, #0a0a0a 0%, #14182a 50%, #1f2937 100%);
        color: #e5e7eb; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        z-index: 100000; gap: 18px; padding: 60px;
      `;
      document.body.appendChild(el);
    }
    el.innerHTML = ls
      .map((l, i) => {
        if (i === 0) return `<div style="font-size:72px; font-weight:800; letter-spacing:-2px;">${l}</div>`;
        if (i === 1) return `<div style="font-size:22px; color:#a3e635; text-transform:uppercase; letter-spacing:3px; font-weight:600;">${l}</div>`;
        return `<div style="font-size:20px; color:#cbd5e1;">${l}</div>`;
      })
      .join("");
  }, lines);
}

async function clearTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById("__demo_title_card");
    if (el) el.remove();
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  const page = await ctx.newPage();

  // ===== TITLE CARD (3s) =====
  await page.goto(`${HOST}/`, { waitUntil: "networkidle" });
  await injectTitleCard(page, [
    "HealthPulse Edge",
    "Gemma 4 Good Hackathon · Digital Equity & Inclusivity · Ollama",
    "A ~90-second rough cut — Mac recording is the final submission",
  ]);
  await page.waitForTimeout(3000);
  await clearTitleCard(page);

  // ===== SCENE 1 — Cold open: the problem (12s) =====
  await page.goto(`${HOST}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await injectCaption(
    page,
    "1,350 hospitals in the US have the same CMS reporting obligations as Mayo Clinic, with no IT department and a tribal council policy forbidding patient data from leaving the reservation.",
  );
  await page.waitForTimeout(7000);
  await injectCaption(
    page,
    "This is HealthPulse Edge — runs entirely on a $400 mini-PC. Sage Mesa Critical Access Hospital, Window Rock, Arizona.",
  );
  await page.waitForTimeout(5000);

  // ===== Toggle airplane mode visual (3s) =====
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await injectCaption(page, "Airplane mode on. Gemma 4 runs locally — no network connection.");
  await page.waitForTimeout(3000);
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // ===== SCENE 4 — Egress / Sovereignty block (~30s) =====
  await injectCaption(page, "Quarter-end. CMS reporting is due. She clicks Submit.");
  await page.waitForTimeout(2500);

  // Scroll the egress panel into view
  await page.locator("#egress-destination").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Click Submit Q2 to CMS with blank signature → BLOCKED
  await page.getByRole("button", { name: "Submit Q2 to CMS" }).click();
  await injectCaption(
    page,
    "Sovereignty Mode evaluates the policy. CMS requires a tribal council co-signature key — request is blocked.",
  );
  await page.getByText(/REQUIRES SIGNATURE/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(5000);

  // Enter signature key
  await injectCaption(page, "Marlene pastes the tribal council signature key tc-2026-q2…");
  await page.locator("#egress-signature").fill("tc-2026-q2");
  await page.waitForTimeout(2000);

  // Submit again → signed envelope
  await injectCaption(
    page,
    "Now the gate opens. Defense-in-depth redaction runs: regex floor plus Gemma E2B semantic pass.",
  );
  await page.getByRole("button", { name: "Submit Q2 to CMS" }).click();
  await page.getByText(/fields stripped/i).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);

  await injectCaption(
    page,
    "Over a hundred PHI fields stripped. Differential privacy on five aggregates, ε = 5.0 spent. SHA-256-signed envelope.",
  );
  await page.waitForTimeout(6500);

  // ===== SCENE 5 — /edge in-browser proof (~30s) =====
  await clearCaption(page);
  await page.goto(`${HOST}/edge`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await injectCaption(
    page,
    "The /edge page runs Gemma 4 entirely in your browser tab — no server, no API key.",
  );
  await page.waitForTimeout(3500);

  // Toggle simulated mode and load
  const simBtn = page.getByRole("button", { name: /simulated narrative/i });
  if (await simBtn.count()) {
    await simBtn.first().click();
    await page.waitForTimeout(500);
  }
  await injectCaption(page, "Load model. (Real Gemma 4 E2B on Mac; simulated path for the rough cut.)");
  await page.getByRole("button", { name: "Load Gemma 4 E2B", exact: true }).click();
  await page.getByRole("button", { name: "Run care-gap scan" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  // Pick first facility
  await page.locator("#facility-select").selectOption({ index: 1 });
  await page.waitForTimeout(500);

  await injectCaption(page, "One function call. Gemma streams a 2-sentence executive summary, locally.");
  await page.getByRole("button", { name: "Run care-gap scan" }).click();
  await page.getByText(/streaming locally|simulated/i).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(4500);

  // Chain verification
  await injectCaption(page, "Click Verify chain integrity — every SHA-256 link is recomputed from scratch.");
  await page.getByRole("button", { name: "Verify chain integrity" }).click();
  await page.getByText(/Chain valid|entries verified/i).waitFor({ timeout: 10000 });
  await page.waitForTimeout(3500);

  // THE OFFLINE PROOF SHOT
  await ctx.setOffline(true);
  await injectCaption(page, "Toggle browser to OFFLINE. No network. At all.");
  await page.waitForTimeout(2500);

  await injectCaption(page, "Run the scan again. Still works. Inference is in the tab.");
  await page.getByRole("button", { name: "Run care-gap scan" }).click();
  await page.waitForTimeout(4000);
  await ctx.setOffline(false);

  // ===== CLOSING TITLE CARD (~8s) =====
  await clearCaption(page);
  await injectTitleCard(page, [
    "HealthPulse Edge",
    "Built on Gemma 4 · Ollama · WebGPU",
    "gemma-health.vercel.app/edge · github.com/sgharlow/gemma-health",
  ]);
  await page.waitForTimeout(8000);

  // Finalize video
  await ctx.close();
  const videoSrc = await page.video().path();
  await browser.close();

  const finalWebm = path.join(OUT_DIR, FINAL_NAME);
  fs.renameSync(videoSrc, finalWebm);
  console.log(`\n✓ Wrote ${finalWebm}`);

  // ffmpeg WebM → MP4 (H.264 + AAC) so it's YouTube-ready out of the box.
  try {
    const finalMp4 = path.join(OUT_DIR, "demo-rough-cut.mp4");
    execSync(
      `ffmpeg -y -i "${finalWebm}" -c:v libx264 -crf 22 -preset medium -pix_fmt yuv420p -movflags +faststart "${finalMp4}"`,
      { stdio: "inherit" },
    );
    console.log(`✓ Wrote ${finalMp4}`);
  } catch (e) {
    console.warn(`(ffmpeg conversion skipped: ${e.message})`);
  }
})();
