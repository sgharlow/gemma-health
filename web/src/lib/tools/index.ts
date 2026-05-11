import type { ToolDefinition } from "../ollama";
import { facilityBenchmark, facilityBenchmarkDefinition } from "./facility-benchmark";
import { qualityMonitor, qualityMonitorDefinition } from "./quality-monitor";
import { careGapFinder, careGapFinderDefinition } from "./care-gap-finder";
import { equityDetector, equityDetectorDefinition } from "./equity-detector";
import { stateRanking, stateRankingDefinition } from "./state-ranking";
import { crossCuttingAnalysis, crossCuttingAnalysisDefinition } from "./cross-cutting-analysis";

type ToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

interface RegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

function bind<TArgs, TResult>(fn: (args: TArgs) => TResult): ToolHandler {
  return (args) => fn(args as unknown as TArgs);
}

const registry: Record<string, RegistryEntry> = {
  facility_benchmark: { definition: facilityBenchmarkDefinition, handler: bind(facilityBenchmark) },
  quality_monitor: { definition: qualityMonitorDefinition, handler: bind(qualityMonitor) },
  care_gap_finder: { definition: careGapFinderDefinition, handler: bind(careGapFinder) },
  equity_detector: { definition: equityDetectorDefinition, handler: bind(equityDetector) },
  state_ranking: { definition: stateRankingDefinition, handler: bind(stateRanking) },
  cross_cutting_analysis: { definition: crossCuttingAnalysisDefinition, handler: bind(crossCuttingAnalysis) },
};

export function listTools(): ToolDefinition[] {
  return Object.values(registry).map((r) => r.definition);
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const entry = registry[name];
  if (!entry) throw new Error(`Unknown tool: ${name}`);
  return await entry.handler(args);
}
