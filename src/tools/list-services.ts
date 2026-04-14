import { z } from "zod";
import type { InstancePool } from "../client/pool.js";
import type { ServiceStats } from "../types.js";

export const ListServicesInputSchema = z.object({
  instances: z.array(z.string()).min(1).describe("Instance IDs to query"),
  startTime: z.string().optional().describe("Start time (ISO 8601 or Unix ms); default 24h ago"),
  endTime: z.string().optional().describe("End time; default now"),
});

export type ListServicesInput = z.infer<typeof ListServicesInputSchema>;

interface InstanceServicesResult {
  instanceId: string;
  instanceName: string;
  success: boolean;
  services: ServiceStats[];
  error?: string;
}

export interface ListServicesResult {
  results: InstanceServicesResult[];
}

interface RawService {
  service_name: string;
  trace_count: number;
  error_count: number;
  p50: number;
  p95: number;
}

export function createListServicesHandler(pool: InstancePool) {
  return async (input: ListServicesInput): Promise<ListServicesResult> => {
    const end = input.endTime ? Number(input.endTime) || Date.parse(input.endTime) : Date.now();
    const start = input.startTime ? Number(input.startTime) || Date.parse(input.startTime) : end - 24 * 3600000;

    const sql = `SELECT service_name, COUNT(DISTINCT trace_id) AS trace_count, ` +
      `SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count, ` +
      `APPROX_PERCENTILE_CONT(duration, 0.5) / 1000 AS p50, ` +
      `APPROX_PERCENTILE_CONT(duration, 0.95) / 1000 AS p95 ` +
      `FROM "default" GROUP BY service_name ORDER BY trace_count DESC LIMIT 100`;

    const instances = pool.getByIds(input.instances);
    const queries = instances.map(async (inst): Promise<InstanceServicesResult> => {
      try {
        const { hits } = await inst.queryTraces(sql, start, end);
        const services: ServiceStats[] = (hits as RawService[]).map((s) => ({
          service: s.service_name,
          traceCount: s.trace_count,
          errorRate: s.trace_count === 0 ? 0 : s.error_count / s.trace_count,
          p50Ms: s.p50,
          p95Ms: s.p95,
        }));
        return { instanceId: inst.id, instanceName: inst.name, success: true, services };
      } catch (err) {
        return { instanceId: inst.id, instanceName: inst.name, success: false, services: [], error: String(err) };
      }
    });

    const settled = await Promise.allSettled(queries);
    const results = settled.map((s) => (s.status === "fulfilled" ? s.value : { instanceId: "unknown", instanceName: "unknown", success: false, services: [], error: String(s.reason) }));
    return { results };
  };
}
