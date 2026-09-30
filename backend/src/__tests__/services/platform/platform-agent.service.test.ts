/**
 * R101-C6-3-3：平台代理商档案服务（t_agent，迁移 186）
 *
 * 口径（对应派单卡 §三① / §四 / 验收标准②）：
 * - 状态机：PENDING→ACTIVE；ACTIVE↔FROZEN；ACTIVE/FROZEN→TERMINATED（逐边判定，含非法边与终态）；
 * - agent_code 重复 ⇒ 409（含并发下的 ER_DUP_ENTRY）；未知 levelId ⇒ 400；未知 id ⇒ 404；无变更 ⇒ 400；
 * - 平台级表：SQL 只碰 t_agent / t_agent_level，**不得**出现 t_platform_config；
 * - 零涉钱：本服务的 SQL 语句里不出现任何金额列或计提／结算／提现表。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  AGENT_STATUSES,
  AGENT_STATUS_TRANSITIONS,
  canTransitAgentStatus,
  isAgentStatus,
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  changeAgentStatus,
} from "../../../services/platform/platform-agent.service";

beforeEach(() => {
  vi.resetAllMocks();
});

function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    agentCode: "AG001",
    agentName: "甲代理商",
    levelId: 3,
    levelName: "甲级",
    region: null,
    contactName: null,
    contactPhone: null,
    status: "PENDING",
    remark: null,
    ...overrides,
  };
}

describe("C6-3-3 · 状态机常量（卡 §三① 逐字）", () => {
  it("四态与卡内逐字一致", () => {
    expect([...AGENT_STATUSES]).toEqual(["PENDING", "ACTIVE", "FROZEN", "TERMINATED"]);
  });

  it("状态机逐边判定：PENDING→ACTIVE；ACTIVE↔FROZEN；ACTIVE/FROZEN→TERMINATED", () => {
    expect(AGENT_STATUS_TRANSITIONS).toEqual({
      PENDING: ["ACTIVE"],
      ACTIVE: ["FROZEN", "TERMINATED"],
      FROZEN: ["ACTIVE", "TERMINATED"],
      TERMINATED: [],
    });

    expect(canTransitAgentStatus("PENDING", "ACTIVE")).toBe(true);
    expect(canTransitAgentStatus("ACTIVE", "FROZEN")).toBe(true);
    expect(canTransitAgentStatus("FROZEN", "ACTIVE")).toBe(true);
    expect(canTransitAgentStatus("ACTIVE", "TERMINATED")).toBe(true);
    expect(canTransitAgentStatus("FROZEN", "TERMINATED")).toBe(true);

    // 非法边（卡内未列出的都不能走）
    expect(canTransitAgentStatus("PENDING", "FROZEN")).toBe(false);
    expect(canTransitAgentStatus("PENDING", "TERMINATED")).toBe(false);
    expect(canTransitAgentStatus("FROZEN", "PENDING")).toBe(false);
    expect(canTransitAgentStatus("TERMINATED", "ACTIVE")).toBe(false);
    expect(canTransitAgentStatus("TERMINATED", "FROZEN")).toBe(false);
    // 同值不是合法"流转"
    expect(canTransitAgentStatus("ACTIVE", "ACTIVE")).toBe(false);
    // 未知取值
    expect(canTransitAgentStatus("ACTIVE", "CLOSED")).toBe(false);
    expect(isAgentStatus("CLOSED")).toBe(false);
  });
});

describe("C6-3-3 · listAgents（分页 + 关键词）", () => {
  it("空表 ⇒ items: []、total 0（零预置，不由代码兜出假行）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    const result = await listAgents({});
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    const countSql = String(mocks.query.mock.calls[0][0]);
    expect(countSql).toContain("COUNT(*)");
    expect(countSql).toContain("t_agent");
    expect(countSql).toContain("t_agent_level");
    expect(countSql).not.toContain("t_platform_config");
  });

  it("关键词 ⇒ 五列 LIKE + 五个同名参数（含 % 包裹）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([agentRow()]);
    const result = await listAgents({ page: 2, pageSize: 5, keyword: " 甲 " });
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.items[0].levelName).toBe("甲级");

    const listSql = String(mocks.query.mock.calls[1][0]);
    expect(listSql).toContain("agent_code LIKE ?");
    expect(listSql).toContain("agent_name LIKE ?");
    expect(listSql).toContain("LIMIT ? OFFSET ?");
    expect(mocks.query.mock.calls[1][1]).toEqual(["%甲%", "%甲%", "%甲%", "%甲%", "%甲%", 5, 5]);
  });

  it("DECIMAL/NULL 归一：region 等 NULL 原样透出，不折成空串", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      agentRow({ region: null, contactName: "李四", levelName: null }),
    ]);
    const result = await listAgents({});
    expect(result.items[0]).toMatchObject({ region: null, contactName: "李四", levelName: null });
  });
});

describe("C6-3-3 · getAgent", () => {
  it("未知 id ⇒ 404，且不返回编造对象", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getAgent(42)).rejects.toMatchObject({
      statusCode: 404,
      message: "代理商不存在：42",
    });
  });

  it("存在 ⇒ 逐字段归一（id/levelId 转 number）", async () => {
    mocks.queryOne.mockResolvedValueOnce(agentRow({ id: "9", levelId: "3" }));
    const result = await getAgent(9);
    expect(result).toMatchObject({ id: 9, levelId: 3, agentCode: "AG001", status: "PENDING" });
  });
});

describe("C6-3-3 · createAgent", () => {
  it("未知 levelId ⇒ 400，且不 INSERT、不查重", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 层级不存在
    await expect(
      createAgent({ agentCode: "AG002", agentName: "乙", levelId: 999 })
    ).rejects.toMatchObject({ statusCode: 400, message: "层级不存在：999" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("agentCode 重复 ⇒ 409，且不 INSERT", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 3 }).mockResolvedValueOnce({ id: 8 });
    await expect(
      createAgent({ agentCode: "AG001", agentName: "甲", levelId: 3 })
    ).rejects.toMatchObject({ statusCode: 409, message: "代理商编码已存在：AG001" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("并发撞唯一键（ER_DUP_ENTRY）⇒ 同样 409，不落 500", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 3 }).mockResolvedValueOnce(null);
    mocks.query.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" }));
    await expect(
      createAgent({ agentCode: "AG001", agentName: "甲", levelId: 3 })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("合法 ⇒ INSERT 状态固定 PENDING、空白串归一 NULL，再回读详情", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 3 }) // 层级存在
      .mockResolvedValueOnce(null) // 编码未占用
      .mockResolvedValueOnce(agentRow({ id: 11, region: null, remark: null })); // 回读
    mocks.query.mockResolvedValueOnce({ insertId: 11 });

    const result = await createAgent(
      { agentCode: "AG011", agentName: "丙代理商", levelId: 3, region: "   ", remark: null },
      77
    );
    expect(result.id).toBe(11);

    const insertSql = String(mocks.query.mock.calls[0][0]);
    expect(insertSql).toContain("INSERT INTO t_agent");
    expect(insertSql).toContain("'PENDING'");
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "AG011",
      "丙代理商",
      3,
      null, // region 空白串 ⇒ NULL（不用空串冒充未填写）
      null,
      null,
      null,
      77,
    ]);
  });
});

describe("C6-3-3 · updateAgent", () => {
  it("未知 id ⇒ 404，且不 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(updateAgent(5, { agentName: "新名" })).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("提交值与现值一致 ⇒ 400（不得静默成功），且不 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce(agentRow({ agentName: "甲代理商", region: null }));
    await expect(
      updateAgent(1, { agentName: "甲代理商", region: null })
    ).rejects.toMatchObject({ statusCode: 400, message: "提交内容与当前档案一致，无字段变更" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("改 levelId ⇒ 先校验层级存在（不存在 ⇒ 400）", async () => {
    mocks.queryOne.mockResolvedValueOnce(agentRow()).mockResolvedValueOnce(null);
    await expect(updateAgent(1, { levelId: 999 })).rejects.toMatchObject({
      statusCode: 400,
      message: "层级不存在：999",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("部分更新 ⇒ 只写传了的字段 + updated_by，返回 changedFields", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(agentRow({ agentName: "旧名", region: "华东" }))
      .mockResolvedValueOnce({ id: 4 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    // levelId 由 3 改为 4（与现值不同才会进 changedFields）
    const result = await updateAgent(1, { agentName: "新名", region: "华南", levelId: 4 }, 88);
    expect(result).toEqual({ id: 1, changedFields: ["agentName", "levelId", "region"] });

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("agent_name = ?");
    expect(sql).toContain("level_id = ?");
    expect(sql).toContain("region = ?");
    expect(sql).toContain("updated_by = ?");
    expect(sql).not.toContain("status = ?"); // 状态只能走状态流转端点
    expect(mocks.query.mock.calls[0][1]).toEqual(["新名", 4, "华南", 88, 1]);
  });
});

describe("C6-3-3 · changeAgentStatus", () => {
  it("未知 id ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(changeAgentStatus(4, "ACTIVE")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态未变更 ⇒ 400", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, status: "ACTIVE" });
    await expect(changeAgentStatus(1, "ACTIVE")).rejects.toMatchObject({
      statusCode: 400,
      message: "状态未变更：ACTIVE",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("非法流转（PENDING → FROZEN）⇒ 400，且不 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, status: "PENDING" });
    await expect(changeAgentStatus(1, "FROZEN")).rejects.toMatchObject({
      statusCode: 400,
      message: "非法状态流转：PENDING → FROZEN",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("终态不可出（TERMINATED → ACTIVE）⇒ 400", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, status: "TERMINATED" });
    await expect(changeAgentStatus(1, "ACTIVE")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("合法流转 ⇒ UPDATE status + updated_by", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, status: "PENDING" });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await changeAgentStatus(1, "ACTIVE", 66);
    expect(result).toEqual({ id: 1, status: "ACTIVE" });
    expect(String(mocks.query.mock.calls[0][0])).toContain("UPDATE t_agent SET status = ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["ACTIVE", 66, 1]);
  });
});
