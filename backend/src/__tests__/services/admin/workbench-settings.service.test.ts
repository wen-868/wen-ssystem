import { beforeEach, describe, expect, it, vi } from "vitest";

const txState = { auditFails: false };

vi.mock("../../../shared/db", () => {
  const state = { configRow: null as any, auditInserts: [] as any[] };
  const conn = {};
  const connExecute = vi.fn(async (_conn: unknown, sql: string, params?: any[]) => {
    if (sql.includes("INSERT INTO t_audit_log")) {
      if (txState.auditFails) throw new Error("audit write failed");
      state.auditInserts.push({ sql, params });
      return [{ insertId: state.auditInserts.length }, undefined];
    }
    if (sql.includes("INSERT INTO t_sys_config")) {
      const value = params?.[1];
      state.configRow = { configValue: value };
      return [{ affectedRows: 1 }, undefined];
    }
    throw new Error(`unexpected sql: ${sql}`);
  });
  const connQueryOne = vi.fn(async (_conn: unknown, sql: string) => {
    if (sql.includes("FROM t_sys_config")) return state.configRow;
    throw new Error(`unexpected sql: ${sql}`);
  });
  const transaction = vi.fn(async (fn: (c: unknown) => Promise<any>) => fn(conn));
  return { connExecute, connQueryOne, transaction, __state: state };
});

import * as db from "../../../shared/db";
import {
  getWorkbenchSettings,
  resetWorkbenchSettings,
  saveWorkbenchSettings,
  validateSettingsPatch,
} from "../../../services/admin/workbench-settings.service";

const actor = {
  userId: 7,
  userName: "tester",
  role: "STORE_MANAGER",
  ip: "127.0.0.1",
  userAgent: "vitest",
};

describe("workbench-settings.service", () => {
  beforeEach(() => {
    (db as any).__state.configRow = null;
    (db as any).__state.auditInserts = [];
    txState.auditFails = false;
    vi.clearAllMocks();
  });

  it("validateSettingsPatch 拒绝非法键、原型污染键、敏感键和非标量值", () => {
    expect(() => validateSettingsPatch({ "__proto__": 1 })).toThrow();
    expect(() => validateSettingsPatch({ "api_token": "x" })).toThrow();
    expect(() => validateSettingsPatch({ "ok.key": { nested: true } })).toThrow();
    expect(() => validateSettingsPatch({ "ok.key": "x".repeat(5000) })).toThrow();
  });

  it("getWorkbenchSettings 按 tenantId+scope 读取，跨租户键天然隔离", async () => {
    await getWorkbenchSettings({ scope: "tenant", tenantId: "t-a", userId: 1 });
    await getWorkbenchSettings({ scope: "user", tenantId: "t-b", userId: 2 });
    expect((db as any).connQueryOne).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.stringContaining("FROM t_sys_config"),
      ["workbench.settings.tenant", "t-a"],
    );
    expect((db as any).connQueryOne).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.stringContaining("FROM t_sys_config"),
      ["workbench.settings.user.2", "t-b"],
    );
  });

  it("saveWorkbenchSettings upsert 配置并写审计，detail 仅含闭集字段", async () => {
    const result = await saveWorkbenchSettings({
      scope: "tenant",
      tenantId: "t1",
      userId: 7,
      settings: { "ui.density": "compact" },
      baseRevision: 0,
      actor,
    });
    expect(result.values["ui.density"]).toBe("compact");
    expect((db as any).connExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("INSERT INTO t_sys_config"),
      expect.arrayContaining(["workbench.settings.tenant", expect.any(String), "workbench_settings", expect.any(String), "t1"]),
    );
    const audit = (db as any).__state.auditInserts[0];
    expect(audit.params[3]).toBe("WORKBENCH_SETTINGS_SAVE");
    const detail = JSON.parse(audit.params[5]);
    expect(detail).toMatchObject({ scope: "tenant", keys: ["ui.density"], revision: 1, result: "SUCCESS" });
    expect(detail).not.toHaveProperty("values");
    expect(detail).not.toHaveProperty("settings");
  });

  it("revision 冲突返回 409 语义错误", async () => {
    (db as any).__state.configRow = {
      configValue: JSON.stringify({ version: 1, revision: 3, updatedAt: "x", values: { "ui.density": "standard" } }),
    };
    await expect(
      saveWorkbenchSettings({
        scope: "user",
        tenantId: "t1",
        userId: 7,
        settings: { "ui.density": "compact" },
        baseRevision: 1,
        actor,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("resetWorkbenchSettings 恢复默认并写重置审计", async () => {
    (db as any).__state.configRow = {
      configValue: JSON.stringify({ version: 1, revision: 2, updatedAt: "x", values: { "ui.density": "compact", custom: "x" } }),
    };
    const result = await resetWorkbenchSettings({
      scope: "tenant",
      tenantId: "t1",
      userId: 7,
      keys: ["ui.density"],
      baseRevision: 2,
      actor,
    });
    expect(result.values["ui.density"]).toBe("standard");
    const audit = (db as any).__state.auditInserts[0];
    expect(audit.params[3]).toBe("WORKBENCH_SETTINGS_RESET");
  });

  it("审计失败时不静默吞结果（事务抛错）", async () => {
    txState.auditFails = true;
    await expect(
      saveWorkbenchSettings({
        scope: "tenant",
        tenantId: "t1",
        userId: 7,
        settings: { "ui.density": "compact" },
        actor,
      }),
    ).rejects.toThrow("audit write failed");
  });
});
