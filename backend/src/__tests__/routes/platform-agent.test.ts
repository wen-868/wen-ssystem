/**
 * R101-C6-3-3：平台代理商域 8 条新端点的路由级测试
 * （路径 / 方法 / 鉴权 / 校验 400 / 业务码 404·409 / 非法流转 400 / 注册顺序）
 *
 * 范式：src/__tests__/routes/platform-config-c6-3-1.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡 §四 —— 路径由卡逐字钉死，本文件逐条断言，防后续被改名/挪前缀；
 * 另断言「未定义的相邻路径 ⇒ 404」（证明没有自拟宽松路由）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  changeAgentStatus: vi.fn(),
  listAgentLevels: vi.fn(),
  createAgentLevel: vi.fn(),
  updateAgentLevel: vi.fn(),
}));

// 只 mock 需要的导出，并显式提供控制器在模块作用域读取的 AGENT_STATUSES
// （不用 importActual：避免把真实 service → shared/db → mysql 连接池拉进路由测试）
vi.mock("../../services/platform/platform-agent.service", () => ({
  AGENT_STATUSES: ["PENDING", "ACTIVE", "FROZEN", "TERMINATED"],
  listAgents: mocks.listAgents,
  getAgent: mocks.getAgent,
  createAgent: mocks.createAgent,
  updateAgent: mocks.updateAgent,
  changeAgentStatus: mocks.changeAgentStatus,
}));

vi.mock("../../services/platform/platform-agent-level.service", () => ({
  listAgentLevels: mocks.listAgentLevels,
  createAgentLevel: mocks.createAgentLevel,
  updateAgentLevel: mocks.updateAgentLevel,
}));

import { AppError } from "../../shared/app-error";
import { routeConfig } from "../../routes/platform-agent.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: routeConfig.prefix, router: routeConfig.router });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于 8 条新端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流（CodeQL js/missing-rate-limiting 只认注册点上内联出现的 rateLimit(...)）
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(routeConfig.prefix, requirePlatformAuth, routeConfig.router);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("C6-3-3 · 路由声明（前缀 + 全量 requirePlatformAuth）", () => {
  it("前缀与派单卡 §四 逐字一致，且 auth 为 requirePlatformAuth", () => {
    expect(routeConfig.prefix).toBe("/api/platform/agents");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("无令牌访问 8 条新端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/agents"),
      request(guardedApp).post("/api/platform/agents").send({ agentCode: "a1", agentName: "甲", levelId: 1 }),
      request(guardedApp).get("/api/platform/agents/1"),
      request(guardedApp).put("/api/platform/agents/1").send({ agentName: "乙" }),
      request(guardedApp).post("/api/platform/agents/1/status").send({ status: "ACTIVE" }),
      request(guardedApp).get("/api/platform/agents/levels"),
      request(guardedApp).post("/api/platform/agents/levels").send({ levelCode: "l1", levelName: "甲级" }),
      request(guardedApp).put("/api/platform/agents/levels/1").send({ levelName: "乙级" }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listAgents).not.toHaveBeenCalled();
    expect(mocks.createAgent).not.toHaveBeenCalled();
    expect(mocks.changeAgentStatus).not.toHaveBeenCalled();
    expect(mocks.createAgentLevel).not.toHaveBeenCalled();
  });
});

describe("C6-3-3 · GET /api/platform/agents（列表）", () => {
  it("空表 ⇒ items: []、total 0（诚实空态，不由后端预置代理商）", async () => {
    mocks.listAgents.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 10 });
    const res = await request(app).get("/api/platform/agents");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
  });

  it("分页 + 关键词透传（page/pageSize/keyword 原样进 service）", async () => {
    mocks.listAgents.mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 5 });
    const res = await request(app).get("/api/platform/agents?page=2&pageSize=5&keyword=%E7%94%B2");
    expect(res.status).toBe(200);
    expect(mocks.listAgents.mock.calls[0][0]).toEqual({ page: 2, pageSize: 5, keyword: "甲" });
  });

  it("pageSize 超 100 ⇒ 400（不静默夹取）", async () => {
    const res = await request(app).get("/api/platform/agents?pageSize=101");
    expect(res.status).toBe(400);
    expect(mocks.listAgents).not.toHaveBeenCalled();
  });

  it("page=0 ⇒ 400（zod 反射，且不调用 service）", async () => {
    const res = await request(app).get("/api/platform/agents?page=0");
    expect(res.status).toBe(400);
    expect(mocks.listAgents).not.toHaveBeenCalled();
  });
});

describe("C6-3-3 · POST /api/platform/agents（新建）", () => {
  const created = {
    id: 1,
    agentCode: "AG001",
    agentName: "甲代理商",
    levelId: 3,
    levelName: "甲级",
    region: "华东",
    contactName: "张三",
    contactPhone: "13800000000",
    status: "PENDING",
    remark: null,
  };

  it("合法体 ⇒ 200 且回传 PENDING 档案；body 字段原样进 service", async () => {
    mocks.createAgent.mockResolvedValueOnce(created);
    const res = await request(app)
      .post("/api/platform/agents")
      .send({ agentCode: "AG001", agentName: "甲代理商", levelId: 3, region: "华东" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
    expect(mocks.createAgent.mock.calls[0][0]).toMatchObject({
      agentCode: "AG001",
      agentName: "甲代理商",
      levelId: 3,
      region: "华东",
    });
  });

  it("重复 agentCode ⇒ 409（service 抛 AppError，原样透出）", async () => {
    mocks.createAgent.mockRejectedValueOnce(new AppError("代理商编码已存在：AG001", 409));
    const res = await request(app)
      .post("/api/platform/agents")
      .send({ agentCode: "AG001", agentName: "甲代理商", levelId: 3 });
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe("代理商编码已存在：AG001");
  });

  it("未知 levelId ⇒ 400（service 抛 AppError，原样透出）", async () => {
    mocks.createAgent.mockRejectedValueOnce(new AppError("层级不存在：999", 400));
    const res = await request(app)
      .post("/api/platform/agents")
      .send({ agentCode: "AG002", agentName: "乙代理商", levelId: 999 });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("层级不存在：999");
  });

  it("缺 agentCode ⇒ 400（zod，且不调用 service）", async () => {
    const res = await request(app).post("/api/platform/agents").send({ agentName: "甲", levelId: 1 });
    expect(res.status).toBe(400);
    expect(mocks.createAgent).not.toHaveBeenCalled();
  });

  it("给未知字段（自拟）⇒ 400（strict 不认）", async () => {
    const res = await request(app)
      .post("/api/platform/agents")
      .send({ agentCode: "AG003", agentName: "甲", levelId: 1, profitAmount: 100 });
    expect(res.status).toBe(400);
    expect(mocks.createAgent).not.toHaveBeenCalled();
  });
});

describe("C6-3-3 · GET /api/platform/agents/:id（详情）", () => {
  it("存在 ⇒ 200；id 原样透传（数字）", async () => {
    mocks.getAgent.mockResolvedValueOnce({ id: 5, agentCode: "AG005", status: "PENDING" });
    const res = await request(app).get("/api/platform/agents/5");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(5);
    expect(mocks.getAgent.mock.calls[0][0]).toBe(5);
  });

  it("未知 id ⇒ 404", async () => {
    mocks.getAgent.mockRejectedValueOnce(new AppError("代理商不存在：42", 404));
    const res = await request(app).get("/api/platform/agents/42");
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("代理商不存在：42");
  });

  it("id 非正整数 ⇒ 400（zod，且不调用 service）", async () => {
    const res = await request(app).get("/api/platform/agents/0");
    expect(res.status).toBe(400);
    expect(mocks.getAgent).not.toHaveBeenCalled();
  });
});

describe("C6-3-3 · PUT /api/platform/agents/:id（部分更新）", () => {
  it("合法体 ⇒ 200 且回传 changedFields", async () => {
    mocks.updateAgent.mockResolvedValueOnce({ id: 7, changedFields: ["agentName"] });
    const res = await request(app).put("/api/platform/agents/7").send({ agentName: "新名字" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 7, changedFields: ["agentName"] });
    expect(mocks.updateAgent.mock.calls[0][0]).toBe(7);
  });

  it("空 body ⇒ 400（至少一项，且不调用 service）", async () => {
    const res = await request(app).put("/api/platform/agents/7").send({});
    expect(res.status).toBe(400);
    expect(mocks.updateAgent).not.toHaveBeenCalled();
  });

  it("未知 id ⇒ 404", async () => {
    mocks.updateAgent.mockRejectedValueOnce(new AppError("代理商不存在：9", 404));
    const res = await request(app).put("/api/platform/agents/9").send({ agentName: "甲" });
    expect(res.status).toBe(404);
  });

  it("提交值与现值一致（无变更）⇒ 400（不得静默成功）", async () => {
    mocks.updateAgent.mockRejectedValueOnce(
      new AppError("提交内容与当前档案一致，无字段变更", 400)
    );
    const res = await request(app).put("/api/platform/agents/7").send({ agentName: "甲" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("提交内容与当前档案一致，无字段变更");
  });
});

describe("C6-3-3 · POST /api/platform/agents/:id/status（状态流转）", () => {
  it("合法流转 ⇒ 200，状态枚举与 id 原样进 service", async () => {
    mocks.changeAgentStatus.mockResolvedValueOnce({ id: 3, status: "ACTIVE" });
    const res = await request(app).post("/api/platform/agents/3/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 3, status: "ACTIVE" });
    expect(mocks.changeAgentStatus.mock.calls[0][0]).toBe(3);
    expect(mocks.changeAgentStatus.mock.calls[0][1]).toBe("ACTIVE");
  });

  it("非法流转 ⇒ 400（service 抛 AppError，原样透出）", async () => {
    mocks.changeAgentStatus.mockRejectedValueOnce(
      new AppError("非法状态流转：PENDING → FROZEN", 400)
    );
    const res = await request(app).post("/api/platform/agents/3/status").send({ status: "FROZEN" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("非法状态流转：PENDING → FROZEN");
  });

  it("状态取值不在四态内 ⇒ 400（zod，且不调用 service）", async () => {
    const res = await request(app).post("/api/platform/agents/3/status").send({ status: "CLOSED" });
    expect(res.status).toBe(400);
    expect(mocks.changeAgentStatus).not.toHaveBeenCalled();
  });

  it("未知 id ⇒ 404", async () => {
    mocks.changeAgentStatus.mockRejectedValueOnce(new AppError("代理商不存在：8", 404));
    const res = await request(app).post("/api/platform/agents/8/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(404);
  });
});

describe("C6-3-3 · 层级权益配置 3 条端点", () => {
  it("GET /levels 走层级服务（不被 /:id 抢走）；空表 ⇒ items: []", async () => {
    mocks.listAgentLevels.mockResolvedValueOnce({ items: [] });
    const res = await request(app).get("/api/platform/agents/levels");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [] });
    expect(mocks.listAgentLevels).toHaveBeenCalledTimes(1);
    expect(mocks.getAgent).not.toHaveBeenCalled();
  });

  it("POST /levels ⇒ 200；D11 三项字段原样进 service", async () => {
    mocks.createAgentLevel.mockResolvedValueOnce({
      id: 1,
      levelCode: "level_a",
      levelName: "自定义甲级",
      allowSubLevel: true,
      planScope: [1, 2],
      discountLow: 7.5,
      discountHigh: 8.8,
      profitModeSignup: true,
      profitModeRenew: true,
      profitModeUpsell: false,
      profitRateSignup: null,
      profitRateRenew: null,
      profitRateUpsell: null,
      sortNo: 0,
      status: "ACTIVE",
    });
    const res = await request(app).post("/api/platform/agents/levels").send({
      levelCode: "level_a",
      levelName: "自定义甲级",
      allowSubLevel: true,
      planScope: [1, 2],
      discountLow: 7.5,
      discountHigh: 8.8,
    });
    expect(res.status).toBe(200);
    expect(mocks.createAgentLevel.mock.calls[0][0]).toMatchObject({
      levelCode: "level_a",
      levelName: "自定义甲级",
      allowSubLevel: true,
      planScope: [1, 2],
      discountLow: 7.5,
      discountHigh: 8.8,
    });
  });

  it("POST /levels 重复 levelCode ⇒ 409", async () => {
    mocks.createAgentLevel.mockRejectedValueOnce(new AppError("层级编码已存在：level_a", 409));
    const res = await request(app)
      .post("/api/platform/agents/levels")
      .send({ levelCode: "level_a", levelName: "甲级" });
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe("层级编码已存在：level_a");
  });

  it("POST /levels 空数组 planScope ⇒ 400（未配置请传 null，不用空数组冒充）", async () => {
    const res = await request(app)
      .post("/api/platform/agents/levels")
      .send({ levelCode: "level_b", levelName: "乙级", planScope: [] });
    expect(res.status).toBe(400);
    expect(mocks.createAgentLevel).not.toHaveBeenCalled();
  });

  it("PUT /levels/:id ⇒ 200 且回传 changedFields", async () => {
    mocks.updateAgentLevel.mockResolvedValueOnce({ id: 2, changedFields: ["profitRateSignup"] });
    const res = await request(app)
      .put("/api/platform/agents/levels/2")
      .send({ profitRateSignup: 12.5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 2, changedFields: ["profitRateSignup"] });
    expect(mocks.updateAgentLevel.mock.calls[0][0]).toBe(2);
  });

  it("PUT /levels/:id 未知 id ⇒ 404", async () => {
    mocks.updateAgentLevel.mockRejectedValueOnce(new AppError("层级不存在：99", 404));
    const res = await request(app).put("/api/platform/agents/levels/99").send({ levelName: "甲" });
    expect(res.status).toBe(404);
  });

  it("未定义的相邻路径 GET /levels/1 ⇒ 404（证明没有自拟宽松路由）", async () => {
    const res = await request(app).get("/api/platform/agents/levels/1");
    expect(res.status).toBe(404);
    expect(mocks.listAgentLevels).not.toHaveBeenCalled();
    expect(mocks.getAgent).not.toHaveBeenCalled();
  });

  it("未定义的相邻路径 DELETE /agents/1 ⇒ 404（本单不含删除端点）", async () => {
    const res = await request(app).delete("/api/platform/agents/1");
    expect(res.status).toBe(404);
  });
});
