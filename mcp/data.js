/**
 * Synthetic-seed loader for the MCP server. Reads the same JSON files the
 * web/ on-prem app + /edge in-browser demo use. Single source of truth.
 *
 * Override the data root with HPE_DATA_ROOT — useful for the on-prem
 * operator who wants to swap in a real CMS Hospital Compare extract.
 */

const fs = require("node:fs");
const path = require("node:path");

const DATA_ROOT =
  process.env.HPE_DATA_ROOT ?? path.resolve(__dirname, "..", "data", "seed");

function loadJson(name) {
  const p = path.join(DATA_ROOT, name);
  if (!fs.existsSync(p)) {
    throw new Error(`HealthPulse MCP: data file not found at ${p}. Set HPE_DATA_ROOT to the seed directory.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let cache = null;

function load() {
  if (cache) return cache;
  cache = {
    facilities: loadJson("facilities.json"),
    quality: loadJson("quality.json"),
    readmissions: loadJson("readmissions.json"),
    root: DATA_ROOT,
  };
  return cache;
}

module.exports = { load };
