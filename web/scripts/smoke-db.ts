import { query } from "../src/lib/db";

async function main() {
  const facilities = await query(
    "SELECT facility_id, facility_name, state, tribal FROM facilities ORDER BY facility_id LIMIT 5",
  );
  console.log("FACILITIES:", facilities);

  const quality = await query(
    "SELECT facility_id, measure_id, score FROM quality WHERE facility_id = ?",
    ["DEMO-CAH-001"],
  );
  console.log("QUALITY:", quality);

  const readm = await query(
    "SELECT facility_id, drg, excess_readmission_ratio FROM readmissions WHERE excess_readmission_ratio > 1.0 ORDER BY excess_readmission_ratio DESC LIMIT 5",
  );
  console.log("HIGH READMISSIONS:", readm);
}

main();
