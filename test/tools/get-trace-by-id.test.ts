import { expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { msw } from "../setup.js";
import { InstancePool } from "../../src/client/pool.js";
import { createGetTraceByIdHandler } from "../../src/tools/get-trace-by-id.js";

const fakeInstance = {
  id: "prod",
  name: "Prod",
  url: "http://o2.test",
  capabilities: ["traces"],
  tags: [],
  authToken: "dGVzdA==",
  defaults: { org: "default", timeout: 5000 },
};

test("returns trace with spans grouped by trace_id", async () => {
  msw.use(
    http.post("http://o2.test/api/default/_search", () =>
      HttpResponse.json({
        hits: [
          { trace_id: "abc", span_id: "s1", service_name: "backend", operation_name: "GET /personnel", start_time: 1776000000000000, duration: 20000, status: "ok" },
          { trace_id: "abc", span_id: "s2", parent_span_id: "s1", service_name: "cerbos", operation_name: "CheckResource", start_time: 1776000005000000, duration: 3000, status: "ok" },
        ],
      }),
    ),
  );
  const pool = new InstancePool([fakeInstance as any]);
  const handler = createGetTraceByIdHandler(pool);
  const result = await handler({ trace_id: "abc", instance: "prod" });

  expect(result.traceId).toBe("abc");
  expect(result.spanCount).toBe(2);
  expect(result.serviceCount).toBe(2);
  expect(result.spans.map((s) => s.service).sort()).toEqual(["backend", "cerbos"]);
});

test("throws when instance not found", async () => {
  const pool = new InstancePool([fakeInstance as any]);
  const handler = createGetTraceByIdHandler(pool);
  await expect(handler({ trace_id: "abc", instance: "ghost" })).rejects.toThrow(/ghost/);
});
