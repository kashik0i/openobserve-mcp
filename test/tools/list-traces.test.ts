import { expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { msw } from "../setup.js";
import { InstancePool } from "../../src/client/pool.js";
import { createListTracesHandler } from "../../src/tools/list-traces.js";

const fakeInstance = {
  id: "prod",
  name: "Prod",
  url: "http://o2.test",
  capabilities: ["traces"],
  tags: [],
  authToken: "dGVzdA==",
  defaults: { org: "default", timeout: 5000 },
};

test("returns errored traces sorted by start desc when status=error", async () => {
  msw.use(
    http.post("http://o2.test/api/default/_search", () =>
      HttpResponse.json({
        hits: [
          { trace_id: "t1", root_service: "backend", root_operation: "GET /x", start_time: 1776001000000000, duration: 50000, span_count: 3, status: "error" },
          { trace_id: "t2", root_service: "backend", root_operation: "POST /y", start_time: 1776000500000000, duration: 30000, span_count: 2, status: "error" },
        ],
      }),
    ),
  );
  const pool = new InstancePool([fakeInstance as any]);
  const handler = createListTracesHandler(pool);
  const result = await handler({ instances: ["prod"], status: "error" });

  expect(result.results[0].traces).toHaveLength(2);
  expect(result.results[0].traces[0].traceId).toBe("t1");
  expect(result.results[0].traces[0].status).toBe("error");
});
