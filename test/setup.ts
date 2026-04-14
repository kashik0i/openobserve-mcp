import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

export const msw = setupServer();

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());
