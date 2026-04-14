import { z } from "zod";

export const StubInputSchema = z.object({}).passthrough();
export type StubInput = z.infer<typeof StubInputSchema>;

export interface StubResult {
  error: "not_implemented";
  tool: string;
  message: string;
  tracking: string;
}

export function createStubHandler(toolName: string) {
  return async (_input: StubInput): Promise<StubResult> => ({
    error: "not_implemented",
    tool: toolName,
    message: `Tool ${toolName} is stubbed; open an issue at https://github.com/kashik0i/openobserve-mcp/issues to request implementation.`,
    tracking: "https://github.com/kashik0i/openobserve-mcp/issues",
  });
}

export const STUB_TOOLS = [
  { name: "o2_top_operations", description: "List top N operations per service by request rate / duration / errors. (STUB — not implemented)" },
  { name: "o2_recent_errors", description: "Fetch recent 5xx / error-status traces grouped by service. (STUB — not implemented)" },
  { name: "o2_promql_query", description: "Run a PromQL query against metrics streams. (STUB — not implemented)" },
  { name: "o2_list_alerts", description: "List configured alerts per instance. (STUB — not implemented)" },
  { name: "o2_list_alert_history", description: "List alert firing history. (STUB — not implemented)" },
  { name: "o2_get_alert", description: "Get details for a single alert by ID. (STUB — not implemented)" },
] as const;
