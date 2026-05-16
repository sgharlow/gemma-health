/**
 * Live recording driver — Playwright walks the headed Chromium through
 * Scenes 1, 2, 4, 5 of docs/VIDEO-SCRIPT.md and PAUSES for the operator to
 * perform Scene 3 manually (real webcam + real paper survey). The script
 * detects Scene 3 completion by polling the Compliance Ledger for new
 * vision_extract_survey entries — the operator's natural action of clicking
 * "Capture + extract (3s)" IS the resume signal.
 *
 * The bash orchestrator (scripts/record-take.sh) handles Wi-Fi and the
 * system-wide screen capture. This script ONLY drives the browser.
 *
 * Modes (env):
 *   REHEARSE=1   skip Scene 3 wait (no manual paper-to-camera), use short hold
 */

const { chromium } = require("playwright");
const fs = require("node:fs");

const HOST = process.env.HOST || "http://localhost:3000";
const LEDGER_URL = HOST + "/api/ledger?limit=1";
const REHEARSE = process.env.REHEARSE === "1";
const USER_DATA_DIR = process.env.HPE_PROFILE_DIR || "/tmp/hpe-record-profile";
// Signal-file handshake with record-take.sh — lets the bash orchestrator
// start the screen recorder ONLY after the browser is open and showing the
// OFFLINE banner. Eliminates head dead air (no Terminal in the recording).
const READY_FILE = process.env.HPE_READY_FILE || "/tmp/hpe-playwright-ready";
const GO_FILE = process.env.HPE_GO_FILE || "/tmp/hpe-playwright-go";

async function ledgerCount() {
  const r = await fetch(LEDGER_URL);
  if (!r.ok) throw new Error(`ledger HTTP ${r.status}`);
  const j = await r.json();
  return j.count;
}

async function waitForLedgerGrowth(baseline, minIncrement, timeoutMs, label) {
  const t0 = Date.now();
  let last = baseline;
  while (Date.now() - t0 < timeoutMs) {
    let c;
    try {
      c = await ledgerCount();
    } catch {
      await sleep(1000);
      continue;
    }
    if (c !== last) {
      console.log(`    ledger: ${last} → ${c}`);
      last = c;
    }
    if (c >= baseline + minIncrement) return c;
    await sleep(1000);
  }
  throw new Error(
    `${label}: ledger did not grow by ${minIncrement} within ${timeoutMs / 1000}s (baseline=${baseline}, last=${last})`,
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function banner(text) {
  const bar = "═".repeat(Math.max(text.length, 60));
  console.log(`\n${bar}\n  ${text}\n${bar}`);
}

// Inject a full-screen title card overlay, hold for durationMs, fade out. The
// resolve() inside page.evaluate waits for the full cycle so callers can `await`
// the full hold time. Returns when the overlay has been removed from the DOM.
async function showTitleCard(page, text, opts = {}) {
  const durationMs = opts.durationMs ?? 1800;
  const fontSize = opts.fontSize ?? "44pt";
  const subtitle = opts.subtitle ?? "";
  await page.evaluate(
    ({ text, subtitle, durationMs, fontSize }) =>
      new Promise((resolve) => {
        const card = document.createElement("div");
        card.style.cssText = `
          position: fixed; inset: 0; z-index: 99999;
          background: linear-gradient(135deg, #0c1322 0%, #111e35 100%);
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 16pt;
          color: white; text-align: center;
          opacity: 0; transition: opacity 280ms ease-in-out;
          font-family: ui-sans-serif, system-ui, -apple-system, "SF Pro", sans-serif;
          padding: 0 60pt;
        `;
        const title = document.createElement("div");
        title.textContent = text;
        title.style.cssText = `
          font-size: ${fontSize}; font-weight: 600; letter-spacing: 0.01em;
          line-height: 1.15;
        `;
        card.appendChild(title);
        if (subtitle) {
          const sub = document.createElement("div");
          sub.textContent = subtitle;
          sub.style.cssText = `
            font-size: 18pt; font-weight: 400; color: #94a3b8;
            margin-top: 8pt; letter-spacing: 0.02em; white-space: pre-line;
            line-height: 1.6;
          `;
          card.appendChild(sub);
        }
        document.body.appendChild(card);
        requestAnimationFrame(() => {
          card.style.opacity = "1";
        });
        setTimeout(() => {
          card.style.opacity = "0";
          setTimeout(() => {
            card.remove();
            resolve();
          }, 320);
        }, durationMs);
      }),
    { text, subtitle, durationMs, fontSize },
  );
}

// Show a fake Terminal window with real `ollama list` output baked in. Acts
// as a "proof of Gemma 4" B-roll inside the main take — no separate clip to
// concatenate in post. Real output captured pre-record; if `ollama list` ever
// changes upstream, regenerate this constant from the actual command.
const OLLAMA_LIST_OUTPUT = `$ ollama list
NAME          ID              SIZE      MODIFIED
gemma4:e4b    c6eb396dbd59    9.6 GB    3 days ago
gemma4:e2b    7fbdbf8f5e45    7.2 GB    3 days ago
$ `;

async function showTerminalBroll(page, durationMs = 4000) {
  await page.evaluate(
    ({ output, durationMs }) =>
      new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position: fixed; inset: 0; z-index: 99999;
          background: #0c1322;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 280ms ease-in-out;
        `;
        const term = document.createElement("div");
        term.style.cssText = `
          width: 75%; max-width: 1100px; border-radius: 10pt;
          background: #1c1c1c; overflow: hidden;
          box-shadow: 0 24pt 60pt rgba(0,0,0,0.6);
          font-family: "SF Mono", Monaco, Menlo, monospace;
        `;
        const titlebar = document.createElement("div");
        titlebar.style.cssText = `
          height: 28pt; background: #2c2c2c; display: flex;
          align-items: center; padding: 0 12pt; gap: 8pt;
        `;
        ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c) => {
          const dot = document.createElement("span");
          dot.style.cssText = `width: 12pt; height: 12pt; border-radius: 50%; background: ${c};`;
          titlebar.appendChild(dot);
        });
        const tt = document.createElement("span");
        tt.textContent = "Terminal — ollama list";
        tt.style.cssText = "color: #aaa; margin-left: 12pt; font-size: 11pt;";
        titlebar.appendChild(tt);
        term.appendChild(titlebar);
        const body = document.createElement("pre");
        body.textContent = output;
        body.style.cssText = `
          color: #e5e7eb; font-size: 18pt; line-height: 1.55;
          white-space: pre; margin: 0; padding: 22pt 28pt;
        `;
        term.appendChild(body);
        overlay.appendChild(term);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
        });
        setTimeout(() => {
          overlay.style.opacity = "0";
          setTimeout(() => {
            overlay.remove();
            resolve();
          }, 320);
        }, durationMs);
      }),
    { output: OLLAMA_LIST_OUTPUT, durationMs },
  );
}

(async () => {
  banner(`record-take starting — mode: ${REHEARSE ? "REHEARSE" : "LIVE"} · profile: ${USER_DATA_DIR}`);

  // Persistent profile so prep's localStorage chat history is already loaded
  // when the page mounts. The audience sees yesterday's conversation without
  // any live model inference during recording.
  // Launched in --app mode so Chromium has NO tab bar / address bar / bookmarks,
  // and full-screen so the dock is hidden too. The full 1600x900 frame is product.
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
    permissions: ["camera"],
    args: [
      "--use-fake-ui-for-media-stream",
      "--window-position=0,0",
      "--window-size=1600,900",
      `--app=${HOST}`,            // strips tab bar, address bar, bookmarks bar
      "--start-fullscreen",       // hides macOS dock + menu bar (on macOS goes into Lion fullscreen)
      "--hide-scrollbars",
      "--disable-features=TranslateUI",
    ],
  });

  // In --app mode Chromium opens the page directly from the --app URL, so we
  // grab whichever page is already open (don't navigate again — that would
  // spawn a second tab in app mode).
  const page = context.pages()[0] || (await context.newPage());
  if (page.url() === "about:blank" || !page.url().startsWith(HOST)) {
    await page.goto(HOST, { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront();
  // Wait for the OFFLINE banner to flip — the active probe in page.tsx polls
  // every 3s, so up to ~5s after Wi-Fi cut the banner becomes emerald OFFLINE.
  // This is what makes the cold open visually true.
  try {
    await page.waitForFunction(
      () => /OFFLINE/.test(document.body.innerText || ""),
      { timeout: 12_000 },
    );
    console.log("    ✓ OFFLINE banner has flipped");
  } catch {
    console.warn("    WARN: OFFLINE banner did not flip within 12s — recording may show ONLINE in cold open");
  }

  // Signal record-take.sh that the browser is on screen with the OFFLINE
  // banner showing. The bash orchestrator now starts the screen recorder
  // (so the recording's first frame is the product, not a Terminal window).
  // Then we wait for it to signal back "go" before running Scene 1.
  try {
    fs.writeFileSync(READY_FILE, String(Date.now()));
    console.log(`    ✓ wrote ready signal → ${READY_FILE}; waiting for ${GO_FILE}`);
    const goDeadline = Date.now() + 30_000;
    while (!fs.existsSync(GO_FILE) && Date.now() < goDeadline) {
      await sleep(150);
    }
    if (fs.existsSync(GO_FILE)) {
      fs.unlinkSync(GO_FILE);
      try { fs.unlinkSync(READY_FILE); } catch {}
      console.log("    ✓ go signal received — beginning Scene 1");
    } else {
      console.warn("    WARN: no go signal in 30s — proceeding anyway (recording may have head dead air)");
    }
  } catch (e) {
    console.warn("    WARN: signal-file handshake failed:", e.message);
  }

  // ───────────────────────────── SCENE 0 — B-ROLL ─────────────────────
  banner("SCENE 0 — Terminal B-roll: ollama list (proof of Gemma 4)");
  await showTerminalBroll(page, 3800);

  // ───────────────────────────── TITLE CARD ──────────────────────────
  await showTitleCard(page, "HealthPulse Edge", {
    subtitle: "Quality intelligence for the smallest hospitals in America",
    durationMs: 2200,
    fontSize: "52pt",
  });

  // ───────────────────────────── SCENE 1 ─────────────────────────────
  banner("SCENE 1 — cold open · hold on OFFLINE banner (8s)");
  // Best-effort verification that the banner says OFFLINE (only true if
  // bash orchestrator already turned Wi-Fi off OR REHEARSE=1).
  try {
    const banner = await page.locator("text=/OFFLINE|ONLINE/").first().textContent({ timeout: 2000 });
    console.log("    banner:", (banner || "").slice(0, 80));
  } catch {
    console.log("    (banner element not found — continuing)");
  }
  await sleep(8000);

  // ───────────────────────────── SCENE 2 ─────────────────────────────
  banner("SCENE 2 — morning report (review existing chat history)");
  // The chat panel is already populated by prep-recording.sh via
  // populate-narrative.cjs (localStorage + ledger). No typing, no inference.
  // Verify the conversation is on screen before dwelling.
  const userMsg = page.locator("text=/find the top 3 care gaps/i").first();
  try {
    await userMsg.scrollIntoViewIfNeeded({ timeout: 3000 });
    console.log("    ✓ prior chat conversation visible");
  } catch {
    console.warn("    WARN: prior chat conversation not found on page");
    console.warn("          did you run scripts/prep-recording.sh first?");
  }
  // Slow scroll across the conversation so editor can pick the dwell.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(2500);
  await userMsg.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(4000);
  // Highlight the assistant's answer by scrolling slightly past it
  await page.evaluate(() => window.scrollBy({ top: 220, behavior: "smooth" }));
  await sleep(7000);

  // ───────────────────────────── SCENE 3 ─────────────────────────────
  banner("SCENE 3 — intake queue · review overnight batch's multimodal results");
  // No manual action, no inference. Scroll to the IntakeQueue panel and
  // dwell on it so the editor can sync the Scene-3 voiceover.
  const intake = page.locator('h2#intake-heading').first();
  try {
    await intake.scrollIntoViewIfNeeded({ timeout: 3000 });
    console.log("    ✓ IntakeQueue panel visible");
  } catch {
    console.warn("    WARN: IntakeQueue panel not found on page");
    console.warn("          did data/intake/extractions.json + the fixture image get generated?");
  }
  // Slow scroll within the panel so the camera lingers on:
  //   (1) the thumbnail + featured extraction (5s)
  //   (2) the 'also processed last night' table (6s)
  await sleep(5000);
  await page.evaluate(() => window.scrollBy({ top: 320, behavior: "smooth" }));
  await sleep(6000);

  // ───────────────────────────── TITLE CARD ──────────────────────────
  await showTitleCard(page, "The policy gate", {
    subtitle: "Sovereignty Mode · redaction · differential privacy · sign",
    durationMs: 1800,
  });

  // ───────────────────────────── SCENE 4 ─────────────────────────────
  banner("SCENE 4 — sovereignty comparison + signed envelope");

  // Show the Sovereignty Mode toggle in the header first (it's at the top).
  // The viewer needs to see WHAT we're toggling before we toggle it.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(1200);
  const sovereigntyToggle = page.locator('input[aria-label="Toggle Sovereignty Mode policy enforcement"]').first();

  // 4PRE — Turn Sovereignty OFF and submit. Envelope sails through with NO
  // policy enforcement — viewer sees "policy off = anything ships, no questions".
  console.log("    4pre · turn Sovereignty Mode OFF, submit (no policy)");
  await sovereigntyToggle.click();
  await sleep(1500); // dwell on "Sovereignty Mode OFF" header text

  const egressCard = page.locator('button:has-text("Submit Q2 to CMS")').first();
  await egressCard.scrollIntoViewIfNeeded();
  await sleep(800);

  const beforeNoPolicy = await ledgerCount();
  await egressCard.click();
  await waitForLedgerGrowth(beforeNoPolicy, 1, 30_000, "4pre no-policy submit").catch((e) => {
    console.warn("    warn:", e.message);
  });
  await sleep(4500); // dwell on result — envelope went through, no BLOCKED card

  // 4a — Turn Sovereignty BACK ON, submit again → BLOCKED.
  console.log("    4a · turn Sovereignty ON, submit → expect REQUIRES SIGNATURE");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(900);
  await sovereigntyToggle.click();
  await sleep(1200); // dwell on "Sovereignty Mode ON" header text
  await egressCard.scrollIntoViewIfNeeded();
  await sleep(600);

  const beforeBlock = await ledgerCount();
  await egressCard.click();
  await waitForLedgerGrowth(beforeBlock, 1, 30_000, "scene 4a egress block").catch((e) => {
    console.warn("    warn:", e.message, "(continuing — blocked card may already be visible)");
  });
  await sleep(5000); // dwell on the red BLOCKED card

  // 4b — Type the tribal council signature key.
  console.log("    4b · type signature key tc-2026-q2");
  await page.fill("#egress-signature", "tc-2026-q2");
  await sleep(1500);

  // 4c — Click Submit again → signed envelope (redaction is the slow part).
  console.log("    4c · click Submit (with key) → expect signed envelope");
  const beforeEgress = await ledgerCount();
  await egressCard.click();
  // Egress success path appends: agg+egress entries + DP epsilon spend.
  // Worst case e2b redaction can take ~60s for a Q-batch.
  await waitForLedgerGrowth(beforeEgress, 1, 360_000, "scene 4c signed envelope");
  await sleep(4500); // dwell on the envelope card (numbers + DP aggregates)

  // 4d — Scroll into the RedactionSample before/after panel that just rendered.
  console.log("    4d · dwell on regex before/after sample");
  await page.locator("#redaction-sample").scrollIntoViewIfNeeded().catch(() => {});
  await sleep(8500); // viewer reads PHI → REDACTED transformation

  // ───────────────────────────── TITLE CARD ──────────────────────────
  await showTitleCard(page, "Cryptographic audit trail", {
    subtitle: "Every action logged to a SHA-256 chain the hospital cannot forge",
    durationMs: 1800,
  });

  // ───────────────────────────── SCENE 5 ─────────────────────────────
  banner("SCENE 5 — Compliance Ledger close-up + chain verification");
  // Scroll the Compliance Ledger heading to the TOP of the viewport so it's
  // visually distinct from Scene 4 (where the ledger heading was already
  // visible at the bottom of the egress card).
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h2, h3"));
    const target = headings.find((el) => /Compliance Ledger/i.test(el.textContent || ""));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => window.scrollBy({ top: -12, behavior: "instant" }), 700);
    }
  });
  await sleep(3000); // dwell on the static ledger so viewer can read entries

  // Click the Verify chain integrity button — pill flashes emerald, viewer
  // sees the cryptographic re-walk happen in front of them.
  console.log("    5b · click Verify chain integrity");
  const verifyBtn = page.locator('#verify-chain-btn').first();
  await verifyBtn.click().catch(() => {
    console.warn("    WARN: verify button not found — page may not have hot-reloaded");
  });
  await sleep(4500); // hold during Verifying → ✓ chain verified pulse animation

  // ───────────────────────────── TITLE CARD ──────────────────────────
  await showTitleCard(page, "Same product, in your browser", {
    subtitle: "Gemma 4 runs in WebGPU · no server · works offline",
    durationMs: 1800,
  });

  // ───────────────────────────── SCENE 6 ─────────────────────────────
  banner("SCENE 6 — /edge cameo (same product, in-browser via WebGPU)");
  // Navigate to /edge to show the second surface. The page mounts MediaPipe
  // + Gemma E2B and shows the live ledger inside this browser tab. The
  // model-load itself is too slow to show live (~30s); the static layout
  // alone is enough to communicate "same product runs in the browser".
  await page.goto(HOST + "/edge", { waitUntil: "domcontentloaded" });
  await sleep(2500); // page hydrates
  // Scroll to top so the OFFLINE banner + intro panel are visible
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(6500); // dwell — judges see the in-browser surface

  // ───────────────────────────── CLOSING TITLE CARD ───────────────────
  await showTitleCard(page, "HealthPulse Edge", {
    subtitle:
      "gemma-health.vercel.app/edge · github.com/sgharlow/gemma-health\nBuilt on Gemma 4 · Submitted to the Gemma 4 Good Hackathon",
    durationMs: 3500,
    fontSize: "48pt",
  });

  banner(`record-take DONE — ${REHEARSE ? "rehearsal complete" : "stop the screen recorder now"}`);
  await sleep(500);
  await context.close();
})().catch((e) => {
  console.error("\n!! record-take FAILED:", e.message);
  console.error(e.stack);
  process.exit(2);
});
