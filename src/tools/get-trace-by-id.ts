import { z } from "zod";
import type { InstancePool } from "../client/pool.js";
import type { TraceSpan } from "../types.js";

export const GetTraceByIdInputSchema = z.object({
  trace_id: z.string().regex(/^[a-f0-9]{16,32}$/i).describe("16- or 32-char hex trace ID"),
  instance: z.string().describe("Instance ID to query"),
});

export type GetTraceByIdInput = z.infer<typeof GetTraceByIdInputSchema>;

export interface GetTraceByIdResult {
  traceId: string;
  durationMs: number;
  serviceCount: number;
  spanCount: number;
  spans: TraceSpan[];
}

interface RawSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  service_name: string;
  operation_name: string;
  start_time: number;  // microseconds
  duration: number;    // microseconds
  status: string;
  [key: string]: unknown;
}

export function createGetTraceByIdHandler(pool: InstancePool) {
  return async (input: GetTraceByIdInput): Promise<GetTraceByIdResult> => {
    const [inst] = pool.getByIds([input.instance]);
    if (!inst) throw new Error(`Instance "${input.instance}" not found`);

    const sql = `SELECT * FROM "default" WHERE trace_id = '${input.trace_id.replace(/'/g, "''")}' ORDER BY start_time ASC LIMIT 5000`;
    const now = Date.now();
    const { hits } = await inst.queryTraces(sql, now - 7 * 86400000, now);
    const rawSpans = hits as RawSpan[];

    const spans: TraceSpan[] = rawSpans.map((s) => ({
      traceId: s.trace_id,
      spanId: s.span_id,
      parentSpanId: s.parent_span_id,
      service: s.service_name,
      operation: s.operation_name,
      start: Math.round(s.start_time / 1000),
      durationMs: Math.round(s.duration / 1000),
      status: s.status === "ok" || s.status === "error" ? s.status : "unset",
      tags: {},
    }));

    const traceStart = Math.min(...spans.map((s) => s.start));
    const traceEnd = Math.max(...spans.map((s) => s.start + s.durationMs));
    const serviceSet = new Set(spans.map((s) => s.service));

    return {
      traceId: input.trace_id,
      durationMs: traceEnd - traceStart,
      serviceCount: serviceSet.size,
      spanCount: spans.length,
      spans,
    };
  };
}
