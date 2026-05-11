/**
 * Browser-side data layer. Reads static JSON from /edge/*.json and caches
 * in memory for the page lifetime. No server, no DB.
 */

interface Facility {
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

interface Quality {
  facility_id: string;
  measure_id: string;
  measure_name: string;
  score: number;
  compared_to_national: string;
}

interface Readmission {
  facility_id: string;
  measure_id: string;
  drg: string;
  drg_description: string;
  excess_readmission_ratio: number;
  predicted_readmission_rate: number;
  expected_readmission_rate: number;
  number_of_readmissions: number;
}

let cached: { facilities: Facility[]; quality: Quality[]; readmissions: Readmission[] } | null = null;

async function loadAll() {
  if (cached) return cached;
  const [facilities, quality, readmissions] = await Promise.all([
    fetch("/edge/facilities.json").then((r) => r.json() as Promise<Facility[]>),
    fetch("/edge/quality.json").then((r) => r.json() as Promise<Quality[]>),
    fetch("/edge/readmissions.json").then((r) => r.json() as Promise<Readmission[]>),
  ]);
  cached = { facilities, quality, readmissions };
  return cached;
}

export async function getFacilities(): Promise<Facility[]> {
  return (await loadAll()).facilities;
}
export async function getQuality(): Promise<Quality[]> {
  return (await loadAll()).quality;
}
export async function getReadmissions(): Promise<Readmission[]> {
  return (await loadAll()).readmissions;
}
