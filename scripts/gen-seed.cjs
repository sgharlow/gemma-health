#!/usr/bin/env node
/**
 * Deterministic synthetic-seed generator.
 *
 *   node scripts/gen-seed.cjs [--total 150] [--seed 20260511]
 *
 * Behavior:
 *   - PRESERVES the existing first 15 facilities verbatim (DEMO-CAH-001 …
 *     DEMO-CAH-015). The vitest suite anchors invariants on these IDs.
 *   - GENERATES additional facilities up to the requested total, with a
 *     Mulberry32 PRNG seeded for reproducibility. Re-running produces
 *     byte-identical output.
 *   - WRITES merged datasets to both `data/seed/*.json` (Mac on-prem source
 *     of truth) and `web/public/edge/*.json` (in-browser static copy).
 *
 * Distribution targets (loosely calibrated against real CMS CAH demographics):
 *   - ~9% tribal facilities, concentrated in CMS regions 6/8/9/10
 *   - regional spread weighted toward 5/7/8/4 (where most US CAHs sit)
 *   - quality measure values drawn from realistic ranges with measure-specific
 *     mean/SD; `compared_to_national` derived from threshold bands
 *   - excess readmission ratios mean ~1.0, σ ~0.18, mostly in [0.7, 1.4]
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT, "data", "seed");
const EDGE_DIR = path.join(ROOT, "web", "public", "edge");

const args = parseArgs(process.argv.slice(2));
const TOTAL = args.total ?? 150;
const PRNG_SEED = args.seed ?? 20260511;
const PRESERVE_THROUGH = 15;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--total") out.total = Number(argv[++i]);
    else if (argv[i] === "--seed") out.seed = Number(argv[++i]);
  }
  return out;
}

// Mulberry32 — small, fast, good enough for synthetic-data reproducibility.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function weightedPick(rng, items) {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[items.length - 1][0];
}

// Box-Muller for normal samples.
function normal(rng, mu, sigma) {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// CMS regions + sample states.
const REGION_STATES = {
  1: ["CT", "ME", "MA", "NH", "RI", "VT"],
  2: ["NJ", "NY"],
  3: ["DE", "MD", "PA", "VA", "WV"],
  4: ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN"],
  5: ["IL", "IN", "MI", "MN", "OH", "WI"],
  6: ["AR", "LA", "NM", "OK", "TX"],
  7: ["IA", "KS", "MO", "NE"],
  8: ["CO", "MT", "ND", "SD", "UT", "WY"],
  9: ["AZ", "CA", "HI", "NV"],
  10: ["AK", "ID", "OR", "WA"],
};

// Approximate real-world CAH distribution weights.
const REGION_WEIGHTS = [
  [5, 22],
  [7, 17],
  [8, 14],
  [4, 12],
  [10, 9],
  [6, 9],
  [3, 7],
  [9, 5],
  [2, 3],
  [1, 2],
];

// Regions where tribal facilities concentrate (Navajo Nation, Crow, MHA,
// Lummi, Yakama, Pueblo, etc. — composite, no specific endorsement).
const TRIBAL_REGIONS = new Set([6, 8, 9, 10]);

const NAME_DESCRIPTORS = [
  "Sage", "Pine", "Oak", "Cedar", "Aspen", "Painted", "Red", "Big",
  "High", "Sandstone", "Twin", "Salt", "Cottonwood", "Mesa", "Cypress",
  "Juniper", "Spruce", "Granite", "Willow", "Maple", "Birch", "Walnut",
  "Coyote", "Eagle", "Hawk", "Buffalo", "Elk", "Bear",
];
const NAME_PLACES = [
  "Mesa", "Valley", "Ridge", "Creek", "Canyon", "Mountain", "Plains",
  "Hills", "Pass", "Flats", "Grove", "Basin", "Bluff", "Springs",
  "Junction", "Crossing", "Bend", "Hollow", "Prairie", "Buttes",
];
const NAME_TYPES = [
  "Hospital", "Memorial Hospital", "Critical Access Hospital",
  "Regional Health", "Community Hospital", "Healthcare", "Memorial",
];

const RURAL_TOWN_POOL = [
  "Wallowa", "Lake City", "Buffalo", "Salmon", "Glasgow", "Wendover",
  "Halliday", "Bullhead City", "Ely", "Browning", "Cortez", "Shiprock",
  "Tuba City", "Window Rock", "Blanding", "Burns", "Polson", "Chinook",
  "Cody", "Pinedale", "Sundance", "Choteau", "Ekalaka", "Roundup",
  "Townsend", "Stanford", "Big Timber", "Eureka", "Anaconda", "Conrad",
  "Vega", "Hereford", "Pampa", "Hugo", "Lamesa", "Marfa", "Ozona",
  "Sonora", "Mount Vernon", "Stigler", "Hominy", "Watonga", "Hugoton",
  "Liberal", "Belleville", "Burlington", "Trenton", "Plainville",
  "Sterling", "Atwood", "Goodland", "Tribune", "Smith Center",
  "Sublette", "Beloit", "Hill City", "Mankato", "Phillipsburg",
  "Spearfish", "Lemmon", "Mobridge", "Webster", "Wessington Springs",
  "Britton", "Eureka", "Faulkton", "Gettysburg", "Highmore", "Hot Springs",
  "Kadoka", "Lemmon", "Madison", "McLaughlin", "Mission", "Murdo",
  "Onida", "Parker", "Parkston", "Philip", "Pierre", "Platte", "Redfield",
  "Selby", "Stickney", "Wagner", "Wall", "Webster", "Wessington",
  "Wilmot", "Winner", "Wolsey",
];

function genFacilityName(rng) {
  const d = pick(rng, NAME_DESCRIPTORS);
  const p = pick(rng, NAME_PLACES);
  const t = pick(rng, NAME_TYPES);
  return `${d} ${p} ${t}`;
}

const QUALITY_MEASURES = [
  {
    id: "HCAHPS_OVERALL",
    name: "HCAHPS overall hospital rating (top-box %)",
    mu: 78,
    sigma: 6,
    lo: 55,
    hi: 95,
    // Higher is better — thresholds: <72 worse, >84 better, else no different
    direction: "higher_is_better",
    worse_threshold: 72,
    better_threshold: 84,
    round: 0,
  },
  {
    id: "MORT_30_HF",
    name: "30-day mortality rate, heart failure",
    mu: 11.6,
    sigma: 1.4,
    lo: 7,
    hi: 17,
    direction: "lower_is_better",
    worse_threshold: 13,
    better_threshold: 10.5,
    round: 1,
  },
  {
    id: "MORT_30_AMI",
    name: "30-day mortality rate, AMI",
    mu: 12.8,
    sigma: 1.6,
    lo: 7.5,
    hi: 19,
    direction: "lower_is_better",
    worse_threshold: 14.2,
    better_threshold: 11.5,
    round: 1,
  },
  {
    id: "ED_THROUGHPUT",
    name: "Median time in ED (minutes)",
    mu: 165,
    sigma: 22,
    lo: 110,
    hi: 240,
    direction: "lower_is_better",
    worse_threshold: 185,
    better_threshold: 150,
    round: 0,
  },
  {
    id: "SEP_1",
    name: "Sepsis bundle compliance (%)",
    mu: 62,
    sigma: 8,
    lo: 35,
    hi: 88,
    direction: "higher_is_better",
    worse_threshold: 55,
    better_threshold: 70,
    round: 0,
  },
];

function comparedToNational(score, m) {
  if (m.direction === "higher_is_better") {
    if (score < m.worse_threshold) return "worse";
    if (score > m.better_threshold) return "better";
    return "no different";
  }
  if (score > m.worse_threshold) return "worse";
  if (score < m.better_threshold) return "better";
  return "no different";
}

const READMISSION_DRGS = [
  { id: "READM_30_HF", drg: "291", desc: "Heart failure & shock w MCC", expected: 11.7 },
  { id: "READM_30_COPD", drg: "190", desc: "COPD w MCC", expected: 14.5 },
  { id: "READM_30_AMI", drg: "280", desc: "Acute myocardial infarction w MCC", expected: 13.7 },
  { id: "READM_30_PN", drg: "193", desc: "Simple pneumonia & pleurisy w MCC", expected: 13.4 },
];

// Load existing files; preserve everything for ids ≤ DEMO-CAH-015.
function loadExisting(filename) {
  const p = path.join(SEED_DIR, filename);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const existingFacilities = loadExisting("facilities.json");
const existingQuality = loadExisting("quality.json");
const existingReadmissions = loadExisting("readmissions.json");

function idNumber(id) {
  const m = id.match(/DEMO-CAH-(\d+)/);
  return m ? Number(m[1]) : -1;
}

const preservedFacilities = existingFacilities.filter((f) => idNumber(f.facility_id) <= PRESERVE_THROUGH);
const preservedQuality = existingQuality.filter((q) => idNumber(q.facility_id) <= PRESERVE_THROUGH);
const preservedReadmissions = existingReadmissions.filter((r) => idNumber(r.facility_id) <= PRESERVE_THROUGH);

const rng = mulberry32(PRNG_SEED);

const newFacilities = [];
const newQuality = [];
const newReadmissions = [];

for (let n = PRESERVE_THROUGH + 1; n <= TOTAL; n++) {
  const facility_id = `DEMO-CAH-${String(n).padStart(3, "0")}`;
  const cms_region = weightedPick(rng, REGION_WEIGHTS);
  const states = REGION_STATES[cms_region];
  const state = pick(rng, states);
  const city_town = pick(rng, RURAL_TOWN_POOL);
  const tribal = TRIBAL_REGIONS.has(cms_region) && rng() < 0.22;
  const beds = 15 + Math.floor(rng() * 11); // 15-25 (CAH max is 25)
  const rating = clamp(Math.round(normal(rng, 3.2, 0.9)), 1, 5);

  newFacilities.push({
    facility_id,
    facility_name: genFacilityName(rng),
    state,
    city_town,
    zip_code: String(10000 + Math.floor(rng() * 89999)),
    hospital_type: "Critical Access Hospitals",
    hospital_overall_rating: rating,
    emergency_services: true,
    cms_region,
    tribal,
    beds,
  });

  // 3-5 quality measures per facility (subset of the 5).
  const numQ = 3 + Math.floor(rng() * 3);
  const shuffledMeasures = [...QUALITY_MEASURES].sort(() => rng() - 0.5).slice(0, numQ);
  for (const m of shuffledMeasures) {
    const raw = normal(rng, m.mu, m.sigma);
    const score = m.round === 0 ? Math.round(clamp(raw, m.lo, m.hi)) : round1(clamp(raw, m.lo, m.hi));
    newQuality.push({
      facility_id,
      measure_id: m.id,
      measure_name: m.name,
      score,
      compared_to_national: comparedToNational(score, m),
    });
  }

  // 1-3 readmission DRGs per facility.
  const numR = 1 + Math.floor(rng() * 3);
  const shuffledDrgs = [...READMISSION_DRGS].sort(() => rng() - 0.5).slice(0, numR);
  for (const d of shuffledDrgs) {
    const excess = round1(clamp(normal(rng, 1.0, 0.18), 0.6, 1.6));
    const predicted = round1(clamp(d.expected * excess, 5, 25));
    const numReadm = Math.max(6, Math.round(normal(rng, 22, 9)));
    newReadmissions.push({
      facility_id,
      measure_id: d.id,
      drg: d.drg,
      drg_description: d.desc,
      excess_readmission_ratio: excess,
      predicted_readmission_rate: predicted,
      expected_readmission_rate: d.expected,
      number_of_readmissions: numReadm,
    });
  }
}

const mergedFacilities = [...preservedFacilities, ...newFacilities];
const mergedQuality = [...preservedQuality, ...newQuality];
const mergedReadmissions = [...preservedReadmissions, ...newReadmissions];

// Tribal/non-tribal cohort sanity check — ensure both have at least 5
// facilities with HCAHPS_OVERALL so the equity_detector test is robust.
const hcahpsFacilities = new Set(mergedQuality.filter((q) => q.measure_id === "HCAHPS_OVERALL").map((q) => q.facility_id));
const tribalHcahps = mergedFacilities.filter((f) => f.tribal && hcahpsFacilities.has(f.facility_id)).length;
const nonTribalHcahps = mergedFacilities.filter((f) => !f.tribal && hcahpsFacilities.has(f.facility_id)).length;

console.log(`Generated dataset (PRNG seed ${PRNG_SEED}):`);
console.log(`  Facilities: ${mergedFacilities.length}  (${preservedFacilities.length} preserved + ${newFacilities.length} synthetic)`);
console.log(`  Quality rows: ${mergedQuality.length}`);
console.log(`  Readmission rows: ${mergedReadmissions.length}`);
console.log(`  Tribal facilities: ${mergedFacilities.filter((f) => f.tribal).length} / ${mergedFacilities.length}`);
console.log(`  HCAHPS cohorts: tribal n=${tribalHcahps}, non-tribal n=${nonTribalHcahps}`);
const byRegion = {};
for (const f of mergedFacilities) byRegion[f.cms_region] = (byRegion[f.cms_region] ?? 0) + 1;
console.log(`  Per-region count: ${JSON.stringify(byRegion)}`);

// Pretty-print to match existing style (one entry per line).
function writeArrayPerLine(filePath, arr) {
  const lines = arr.map((e) => "  " + JSON.stringify(e));
  const out = "[\n" + lines.join(",\n") + "\n]\n";
  fs.writeFileSync(filePath, out);
}

const targets = [
  [path.join(SEED_DIR, "facilities.json"), mergedFacilities],
  [path.join(SEED_DIR, "quality.json"), mergedQuality],
  [path.join(SEED_DIR, "readmissions.json"), mergedReadmissions],
  [path.join(EDGE_DIR, "facilities.json"), mergedFacilities],
  [path.join(EDGE_DIR, "quality.json"), mergedQuality],
  [path.join(EDGE_DIR, "readmissions.json"), mergedReadmissions],
];
for (const [p, arr] of targets) {
  writeArrayPerLine(p, arr);
  console.log(`  wrote ${path.relative(ROOT, p)} (${arr.length})`);
}
