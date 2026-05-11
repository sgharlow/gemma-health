import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd(), "..");
const DB_PATH = process.env.HPE_DB_PATH ?? resolve(REPO_ROOT, "data", "cms", "hospital.duckdb");
const SEED_DIR = process.env.HPE_SEED_DIR ?? resolve(REPO_ROOT, "data", "seed");

interface FacilityRow {
  facility_id: string;
  facility_name: string;
  state: string;
  city_town: string;
  zip_code: string;
  hospital_type: string;
  hospital_overall_rating: number;
  emergency_services: boolean;
  cms_region: number;
  tribal: boolean;
  beds: number;
}

interface QualityRow {
  facility_id: string;
  measure_id: string;
  measure_name: string;
  score: number;
  compared_to_national: string;
}

interface ReadmissionRow {
  facility_id: string;
  measure_id: string;
  drg: string;
  drg_description: string;
  excess_readmission_ratio: number;
  predicted_readmission_rate: number;
  expected_readmission_rate: number;
  number_of_readmissions: number;
}

let cached: { instance: Awaited<ReturnType<typeof DuckDBInstance.create>>; conn: DuckDBConnection } | null = null;

export async function getDb(): Promise<DuckDBConnection> {
  if (cached) return cached.conn;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const fresh = !existsSync(DB_PATH) || statSync(DB_PATH).size === 0;
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();
  cached = { instance, conn };
  if (fresh) {
    await seed(conn);
  }
  return conn;
}

export async function seed(conn: DuckDBConnection): Promise<void> {
  const facilities = JSON.parse(readFileSync(resolve(SEED_DIR, "facilities.json"), "utf8")) as FacilityRow[];
  const quality = JSON.parse(readFileSync(resolve(SEED_DIR, "quality.json"), "utf8")) as QualityRow[];
  const readmissions = JSON.parse(readFileSync(resolve(SEED_DIR, "readmissions.json"), "utf8")) as ReadmissionRow[];

  await conn.run("DROP TABLE IF EXISTS facilities");
  await conn.run("DROP TABLE IF EXISTS quality");
  await conn.run("DROP TABLE IF EXISTS readmissions");

  await conn.run(`
    CREATE TABLE facilities (
      facility_id VARCHAR PRIMARY KEY,
      facility_name VARCHAR,
      state VARCHAR,
      city_town VARCHAR,
      zip_code VARCHAR,
      hospital_type VARCHAR,
      hospital_overall_rating INTEGER,
      emergency_services BOOLEAN,
      cms_region INTEGER,
      tribal BOOLEAN,
      beds INTEGER
    )
  `);
  await conn.run(`
    CREATE TABLE quality (
      facility_id VARCHAR,
      measure_id VARCHAR,
      measure_name VARCHAR,
      score DOUBLE,
      compared_to_national VARCHAR
    )
  `);
  await conn.run(`
    CREATE TABLE readmissions (
      facility_id VARCHAR,
      measure_id VARCHAR,
      drg VARCHAR,
      drg_description VARCHAR,
      excess_readmission_ratio DOUBLE,
      predicted_readmission_rate DOUBLE,
      expected_readmission_rate DOUBLE,
      number_of_readmissions INTEGER
    )
  `);

  for (const f of facilities) {
    await conn.run(
      "INSERT INTO facilities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        f.facility_id,
        f.facility_name,
        f.state,
        f.city_town,
        f.zip_code,
        f.hospital_type,
        f.hospital_overall_rating,
        f.emergency_services,
        f.cms_region,
        f.tribal,
        f.beds,
      ],
    );
  }
  for (const q of quality) {
    await conn.run("INSERT INTO quality VALUES (?, ?, ?, ?, ?)", [
      q.facility_id,
      q.measure_id,
      q.measure_name,
      q.score,
      q.compared_to_national,
    ]);
  }
  for (const r of readmissions) {
    await conn.run("INSERT INTO readmissions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      r.facility_id,
      r.measure_id,
      r.drg,
      r.drg_description,
      r.excess_readmission_ratio,
      r.predicted_readmission_rate,
      r.expected_readmission_rate,
      r.number_of_readmissions,
    ]);
  }
}

export async function query<T = Record<string, unknown>>(sql: string, params?: DuckDBValue[]): Promise<T[]> {
  const conn = await getDb();
  const reader = await conn.runAndReadAll(sql, params);
  return reader.getRowObjectsJson() as T[];
}

export const DB_CONFIG = { DB_PATH, SEED_DIR };
