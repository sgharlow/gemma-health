/**
 * One-time fixture generator for the Morning Review intake queue.
 *
 * Output:
 *   web/public/intake/sample-survey.png   — rendered "filled-in" survey image
 *   data/intake/extractions.json          — real Gemma 4 vision extraction for
 *                                            that image + 8 fixture summaries
 *
 * The "filled-in" survey is the HTML template rendered through Playwright
 * with handwriting-style answers injected as absolutely-positioned divs.
 * Looks like a scanned form a patient filled out by hand. The real Gemma 4
 * vision call (~2-4 min) runs once during fixture generation; subsequent
 * record-take.sh runs read the cached JSON. To regenerate, delete the JSON
 * and re-run this script with the dev server up.
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const REPO = path.resolve(__dirname, "..", "..");
const SURVEY_HTML = path.join(REPO, "assets", "patient-survey-print.html");
const PNG_OUT = path.join(REPO, "web", "public", "intake", "sample-survey.png");
const JSON_OUT = path.join(REPO, "web", "src", "data", "intake", "extractions.json");
const HOST = process.env.HOST || "http://localhost:3000";

// The featured (real-extraction) survey
const FEATURED = {
  filename: "sample-survey.png",
  patient_initials: "M.Y.",
  visit_date: "2026-04-22",
  department: "Acute Care",
  ratings: { overall: 4, nurse_comm: 5, doctor_comm: 4, clean: 5, recommend: 4 },
  free_text: "Nurse Marlene was very kind. Wait was long but care was good.",
  signature: "MY",
  today_date: "4/22/2026",
};

// Eight more "also processed last night" entries — fixture data the
// IntakeQueue table renders alongside the featured image.
const FIXTURE_ROW_ENTRIES = [
  { initials: "A.B.", visit_date: "2026-04-21", overall: 5, comm: 5, clean: 5, theme: "\"Quick triage, doctor explained everything.\"" },
  { initials: "T.W.", visit_date: "2026-04-21", overall: 3, comm: 3, clean: 4, theme: "\"Long wait in ED. Care was OK once seen.\"" },
  { initials: "R.N.", visit_date: "2026-04-20", overall: 4, comm: 4, clean: 4, theme: "\"Discharge instructions were clear.\"" },
  { initials: "S.B.", visit_date: "2026-04-20", overall: 5, comm: 5, clean: 4, theme: "\"Nurses were wonderful. Felt heard.\"" },
  { initials: "J.C.", visit_date: "2026-04-19", overall: 4, comm: 4, clean: 5, theme: "\"Pain management improved by day two.\"" },
  { initials: "E.T.", visit_date: "2026-04-19", overall: 5, comm: 5, clean: 5, theme: "\"Bilingual staff helped my grandmother.\"" },
  { initials: "K.M.", visit_date: "2026-04-18", overall: 3, comm: 4, clean: 3, theme: "\"Room was cold. Care otherwise fine.\"" },
  { initials: "L.Y.", visit_date: "2026-04-18", overall: 4, comm: 4, clean: 4, theme: "\"Lab results back same day. Appreciated.\"" },
];

async function renderFilledSurvey(outPath) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 1280 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto("file://" + SURVEY_HTML, { waitUntil: "domcontentloaded" });

  // Inject handwriting-style "filled in" answers as overlays on the form
  // using DOM mutation. Coordinates target each .line / .box element.
  await page.evaluate((f) => {
    // Hide the print-hint that's only visible on screen
    document.querySelectorAll(".print-hint").forEach((e) => (e.style.display = "none"));

    // Add a handwriting-ish styling via Google-fonts-free system fallback
    const style = document.createElement("style");
    style.textContent = `
      .hw {
        font-family: "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive;
        color: #1e3a8a;
        font-size: 14pt;
        line-height: 1;
      }
      .hw-meta { padding: 2pt 6pt; }
      .box-check {
        position: relative;
      }
      .box-check::after {
        content: "✓";
        position: absolute;
        left: 1pt; top: -3pt;
        font-family: "Bradley Hand", "Marker Felt", cursive;
        color: #1e3a8a;
        font-size: 18pt;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);

    // Fill metadata fields
    const metaBlocks = document.querySelectorAll(".meta .blk .line");
    if (metaBlocks[0]) metaBlocks[0].innerHTML = `<span class="hw hw-meta">${f.patient_initials}</span>`;
    if (metaBlocks[1]) metaBlocks[1].innerHTML = `<span class="hw hw-meta">${f.visit_date}</span>`;
    if (metaBlocks[2]) metaBlocks[2].innerHTML = `<span class="hw hw-meta">${f.department}</span>`;

    // Check the rating boxes for each question
    const questions = document.querySelectorAll(".q .scale");
    const ratings = [
      f.ratings.overall,
      f.ratings.nurse_comm,
      f.ratings.doctor_comm,
      f.ratings.clean,
      f.ratings.recommend,
    ];
    ratings.forEach((rating, i) => {
      const q = questions[i];
      if (!q) return;
      const boxes = q.querySelectorAll(".box");
      if (boxes[rating - 1]) boxes[rating - 1].classList.add("box-check");
    });

    // Fill the comments area
    const lines = document.querySelector(".free .lines");
    if (lines) lines.innerHTML = `<span class="hw" style="padding:4pt; display:inline-block;">${f.free_text}</span>`;

    // Sign + date
    const sigBlocks = document.querySelectorAll(".footer .sigline");
    if (sigBlocks[0]) sigBlocks[0].innerHTML = `<span class="hw hw-meta">${f.signature}</span>`;
    if (sigBlocks[1]) sigBlocks[1].innerHTML = `<span class="hw hw-meta" style="float:right">${f.today_date}</span>`;

    // Add slight rotation + paper texture to look scanned
    const sheet = document.querySelector(".sheet");
    if (sheet) {
      sheet.style.transform = "rotate(-0.4deg)";
      sheet.style.boxShadow = "0 0 0 0";
      sheet.style.filter = "contrast(1.05)";
    }
    document.body.style.background = "#fbfaf6";
  }, FEATURED);

  await page.waitForTimeout(300);
  await page.locator(".sheet").screenshot({ path: outPath, scale: "device" });
  await browser.close();
  console.log(`  ✓ rendered survey image → ${outPath}`);
}

async function callVision(imagePath) {
  // Shell out to curl with a generous timeout — Node's undici fetch occasionally
  // gives up on multi-minute requests with a non-deterministic "fetch failed".
  const buf = fs.readFileSync(imagePath);
  const b64 = buf.toString("base64");
  const bodyPath = "/tmp/vision-request-body.json";
  const respPath = "/tmp/vision-response.json";
  fs.writeFileSync(bodyPath, JSON.stringify({ image_b64: b64 }));

  console.log(`  calling /api/vision via curl (this is the one slow step, ~1-5 min on Intel CPU)…`);
  const t0 = Date.now();
  const { execFileSync } = require("node:child_process");
  execFileSync("curl", [
    "-s", "--max-time", "600", "-X", "POST",
    "-H", "Content-Type: application/json",
    "--data-binary", "@" + bodyPath,
    "-o", respPath,
    HOST + "/api/vision",
  ], { stdio: ["ignore", "ignore", "inherit"] });
  const ms = Date.now() - t0;
  console.log(`  vision returned in ${(ms / 1000).toFixed(1)}s`);

  const data = JSON.parse(fs.readFileSync(respPath, "utf8"));
  if (data.error) {
    throw new Error(`vision returned error: ${data.error} (${data.detail || ""})`);
  }
  return data.extraction || {};
}

(async () => {
  console.log("generate-intake-fixtures starting");

  if (!fs.existsSync(path.dirname(PNG_OUT))) fs.mkdirSync(path.dirname(PNG_OUT), { recursive: true });
  if (!fs.existsSync(path.dirname(JSON_OUT))) fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });

  // 1. Render the filled survey
  await renderFilledSurvey(PNG_OUT);

  // 2. Run real Gemma 4 vision against it
  let featuredExtraction;
  try {
    featuredExtraction = await callVision(PNG_OUT);
    console.log(`  ✓ extraction:`, JSON.stringify(featuredExtraction).slice(0, 200));
  } catch (e) {
    console.error(`  ! vision call failed: ${e.message}`);
    console.error(`    falling back to seed extraction (will not show real Gemma output)`);
    featuredExtraction = {
      patient_initials: FEATURED.patient_initials,
      visit_date: FEATURED.visit_date,
      rating_overall: FEATURED.ratings.overall * 2, // approximate 1-10 mapping for display
      rating_communication: FEATURED.ratings.nurse_comm * 2,
      rating_pain_management: FEATURED.ratings.recommend * 2,
      free_text_feedback: FEATURED.free_text,
      note: "Real vision call failed during fixture generation; this is a fallback. Re-run with model warm to capture real output.",
    };
  }

  // 3. Compose the fixture
  const fixture = {
    generated_at: new Date().toISOString(),
    batch_started_at: "2026-04-21T22:17:00Z",
    batch_finished_at: "2026-04-22T05:42:00Z",
    job_count: 1 + FIXTURE_ROW_ENTRIES.length,
    error_count: 0,
    featured: {
      filename: FEATURED.filename,
      extraction: featuredExtraction,
    },
    rows: FIXTURE_ROW_ENTRIES,
  };

  fs.writeFileSync(JSON_OUT, JSON.stringify(fixture, null, 2));
  console.log(`  ✓ fixture saved → ${JSON_OUT}`);
  console.log("generate-intake-fixtures done");
})().catch((e) => {
  console.error("!! generate-intake-fixtures FAILED:", e.message);
  process.exit(1);
});
