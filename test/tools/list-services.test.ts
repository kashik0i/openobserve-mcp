import { expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { msw } from "../setup.js";
import { InstancePool } from "../../src/client/pool.js";
import { createListServicesHandler } from "../../src/tools/list-services.js";

const fakeInstance = {
  id: "prod",
  name: "Prod",
  url: "http://o2.test",
  capabilities: ["traces"],
  tags: [],
  authToken: "dGVzdA==",
  defaults: { org: "default", timeout: 5000 },
};

test("aggregates services from trace stream", async () => {
  msw.use(
    http.post("http://o2.test/api/default/_search", () =>
      HttpResponse.json({
        hits: [
          { service_name: "backend", trace_count: 120, error_count: 6, p50: 12, p95: 180 },
          { service_name: "ingestion", trace_count: 40, error_count: 0, p50: 8, p95: 22 },
        ],
      }),
    ),
  );
  const pool = new InstancePool([fakeInstance as any]);
  const handler = createListServicesHandler(pool);
  const result = await handler({ instances: ["prod"] });

  expect(result.results[0].services).toHaveLength(2);
  const backend = result.results[0].services.find((s) => s.service === "backend");
  expect(backend?.traceCount).toBe(120);
  expect(backend?.errorRate).toBeCloseTo(6 / 120);
});
