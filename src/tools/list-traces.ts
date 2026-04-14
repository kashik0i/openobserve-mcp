import { z } from "zod";
import type { InstancePool } from "../client/pool.js";
import type { TraceSummary } from "../types.js";

export const ListTracesInputSchema = z.object({
  instances: z.array(z.string()).min(1).describe("Instance IDs to query"),
  service: z.string().optional().describe("Filter by service name"),
  minDurationMs: z.number().optional().describe("Filter: only traces >= this duration"),
  status: z.enum(["ok", "error", "any"]).optional().default("any"),
  limit: z.number().min(1).max(500).optional().default(50),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export type ListTracesInput = z.infer<typeof ListTracesInputSchema>;

interface RawTrace {
  trace_id: string;
  root_service: string;
  root_operation: string;
  start_time: number;
  duration: number;
  span_count: number;
  status: "ok" | "error";
}

interface InstanceTracesResult {
  instanceId: string;
  instanceName: string;
  success: boolean;
  traces: TraceSummary[];
  error?: string;
}

export interface ListTracesResult {
  results: InstanceTracesResult[];
}

export function createListTracesHandler(pool: InstancePool) {
  return async (input: ListTracesInput): Promise<ListTracesResult> => {
    const end = input.endTime ? Number(input.endTime) || Date.parse(input.endTime) : Date.now();
    const start = input.startTime ? Number(input.startTime) || Date.parse(input.startTime) : end - 3600000;
    const limit = input.limit ?? 50;

    const where: string[] = [];
    if (input.service) where.push(`root_service = '${input.service.replace(/'/g, "''")}'`);
    if (input.status === "error") where.push(`status = 'error'`);
    else if (input.status === "ok") where.push(`status = 'ok'`);
    if (input.minDurationMs) where.push(`duration >= ${input.minDurationMs * 1000}`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `SELECT trace_id, root_service, root_operation, start_time, duration, span_count, status ` +
      `FROM "default" ${whereSql} ORDER BY start_time DESC LIMIT ${limit}`;

    const instances = pool.getByIds(input.instances);
    const queries = instances.map(async (inst): Promise<InstanceTracesResult> => {
      try {
        const { hits } = await inst.queryTraces(sql, start, end);
        const traces: TraceSummary[] = (hits as RawTrace[]).map((t) => ({
          traceId: t.trace_id,
          rootService: t.root_service,
          rootOperation: t.root_operation,
          start: Math.round(t.start_time / 1000),
          durationMs: Math.round(t.duration / 1000),
          spanCount: t.span_count,
          status: t.status,
        }));
        return { instanceId: inst.id, instanceName: inst.name, success: true, traces };
      } catch (err) {
        return { instanceId: inst.id, instanceName: inst.name, success: false, traces: [], error: String(err) };
      }
    });

    const settled = await Promise.allSettled(queries);
    const results = settled.map((s) => (s.status === "fulfilled" ? s.value : { instanceId: "unknown", instanceName: "unknown", success: false, traces: [], error: String(s.reason) }));
    return { results };
  };
}
