import type { ToolDefinition } from "../ollama";
import { facilityBenchmark, facilityBenchmarkDefinition } from "./facility-benchmark";

type ToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

interface RegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const registry: Record<string, RegistryEntry> = {
  facility_benchmark: {
    definition: facilityBenchmarkDefinition,
    handler: (args) => facilityBenchmark(args as Parameters<typeof facilityBenchmark>[0]),
  },
};

export function listTools(): ToolDefinition[] {
  return Object.values(registry).map((r) => r.definition);
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const entry = registry[name];
  if (!entry) throw new Error(`Unknown tool: ${name}`);
  return await entry.handler(args);
}
