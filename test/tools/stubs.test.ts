import { expect, test } from "vitest";
import { createStubHandler } from "../../src/tools/stubs.js";

test("stub returns not_implemented with tool name", async () => {
  const handler = createStubHandler("o2_list_alerts");
  const result = await handler({});
  expect(result.error).toBe("not_implemented");
  expect(result.tool).toBe("o2_list_alerts");
  expect(result.message).toMatch(/open an issue/);
});
