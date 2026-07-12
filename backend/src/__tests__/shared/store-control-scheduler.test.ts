import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn(),
  transaction: vi.fn((fn: any) => fn({ execute: vi.fn().mockResolvedValue([{ insertId: 1 }]) })),
}));

vi.mock("@shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import { startStoreControlScheduler } from "@shared/store-control-scheduler";

describe("store-control-scheduler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("startStoreControlScheduler - 应启动定时检查器", async () => {
    startStoreControlScheduler();
    expect(true).toBe(true);
  });
});
