/**
 * Populate the "morning batch" narrative state before recording.
 *
 * Uses a PERSISTENT Chromium profile (USER_DATA_DIR below) so localStorage
 * survives between this script and the recording-time Playwright run. Runs
 * headless and:
 *   1. Loads localhost:3000 (which triggers the chat-empty-bootstrap noop)
 *   2. Types Scene 2's prompt, clicks Send, waits for chat completion
 *   3. Closes — leaving chat history in localStorage AND ledger entries
 *      on disk
 *
 * The recording-time driver (record-take.cjs) launches the SAME persistent
 * profile so the on-screen page loads with chat already showing yesterday's
 * conversation. Scene 2 of the recording dwells on this state; no typing,
 * no waiting on inference.
 */

const path = require("node:path");
const { chromium } = require("playwright");

const HOST = process.env.HOST || "http://localhost:3000";
const USER_DATA_DIR = process.env.HPE_PROFILE_DIR || "/tmp/hpe-record-profile";
const SCENE2_PROMPT =
  "For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ledgerCount() {
  const r = await fetch(HOST + "/api/ledger?limit=1");
  if (!r.ok) throw new Error(`ledger HTTP ${r.status}`);
  return (await r.json()).count;
}

(async () => {
  console.log(`populate-narrative → profile: ${USER_DATA_DIR}`);
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ["--use-fake-ui-for-media-stream"],
  });
  const page = await context.newPage();
  await page.goto(HOST, { waitUntil: "domcontentloaded" });

  // Clear any prior chat state in localStorage so we start fresh
  await page.evaluate(() => window.localStorage.removeItem("hpe.chat.v1"));
  await page.reload({ waitUntil: "networkidle" });

  // Wait for React hydration: the chat-input becomes editable and the Send
  // button transitions from disabled (initial render, controlled input is
  // empty + busy could be true) to disabled-but-onchange-ready. We trigger
  // hydration by typing through the keyboard (real input events) rather than
  // page.fill, which sets value directly and can race the React handler.
  await page.waitForSelector("#chat-input", { state: "visible" });
  await page.locator("#chat-input").click();
  await page.locator("#chat-input").press("End");

  const before = await ledgerCount();
  console.log(`  baseline ledger=${before}; typing Scene 2 prompt`);
  await page.locator("#chat-input").type(SCENE2_PROMPT, { delay: 10 });
  // Wait for the Send button to become enabled (React saw the input change)
  const sendBtn = page.locator('button[type="submit"]:has-text("Send")');
  await sendBtn.waitFor({ state: "visible" });
  for (let i = 0; i < 30; i++) {
    if (await sendBtn.isEnabled()) break;
    await sleep(200);
  }
  if (!(await sendBtn.isEnabled())) {
    console.error("  ! Send button never enabled — React may not be hydrating");
    await context.close();
    process.exit(4);
  }
  await sendBtn.click();

  // Wait for the assistant turn to land (>= 3 ledger entries: user + tool_call(s) + assistant)
  const deadline = Date.now() + 360_000;
  let last = before;
  while (Date.now() < deadline) {
    const c = await ledgerCount();
    if (c !== last) {
      console.log(`  ledger: ${last} → ${c}`);
      last = c;
    }
    if (c >= before + 3) break;
    await sleep(1000);
  }
  if (last < before + 3) {
    console.error("  ! chat did not complete within 6 min; aborting");
    await context.close();
    process.exit(2);
  }

  // Give the page a tick to commit the assistant turn to localStorage
  await sleep(2000);

  // Verify localStorage has the chat history
  const stored = await page.evaluate(() => window.localStorage.getItem("hpe.chat.v1"));
  if (!stored) {
    console.error("  ! localStorage chat history not populated; demo will start empty");
    await context.close();
    process.exit(3);
  }
  const parsed = JSON.parse(stored);
  console.log(`  ✓ localStorage chat saved: ${parsed.length} messages`);

  await context.close();
  console.log("populate-narrative done");
})().catch((e) => {
  console.error("!! populate-narrative FAILED:", e.message);
  process.exit(1);
});
