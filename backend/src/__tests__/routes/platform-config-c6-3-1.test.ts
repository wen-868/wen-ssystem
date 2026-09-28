/**
 * R101-C6-3-1：平台全局功能开关（2 条）+ 平台数据字典（3 条）共 5 条新端点的路由级测试
 * （路径 / 方法 / 鉴权 / 校验 400 / 业务码 404）
 *
 * 范式：src/__tests__/routes/platform-role.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡 §三A②/§三B②——路径由卡逐字钉死，本文件逐条断言，防后续被改名/挪前缀；
 * 另断言「未定义的相邻路径（/data-dict/:dictType 不带 /items）⇒ 404」，证明没有自拟宽松路由。
 *
 * 注意：本工作树可跑 vitest（backend/node_modules 存在）；完整全量回归由凌舟本机执行。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listFeatureSwitches: vi.fn(),
  updateFeatureSwitch: vi.fn(),
  listDictTypes: vi.fn(),
  listDictItems: vi.fn(),
  replaceDictItems: vi.fn(),
}));

vi.mock("../../services/platform/platform-feature-switch.service", () => ({
  listFeatureSwitches: mocks.listFeatureSwitches,
  updateFeatureSwitch: mocks.updateFeatureSwitch,
}));

vi.mock("../../services/platform/platform-dict.service", () => ({
  listDictTypes: mocks.listDictTypes,
  listDictItems: mocks.listDictItems,
  replaceDictItems: mocks.replaceDictItems,
}));

import { AppError } from "../../shared/app-error";
import { routeConfig } from "../../routes/platform-config.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: routeConfig.prefix, router: routeConfig.router });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于 5 条新端点的「无令牌」反测 */
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

describe("C6-3-1 · 路由声明（前缀 + 全量 requirePlatformAuth）", () => {
  it("前缀与派单卡 §三 逐字一致，且 auth 为 requirePlatformAuth", () => {
    expect(routeConfig.prefix).toBe("/api/platform/config");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("无令牌访问 5 条新端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/config/feature-switches"),
      request(guardedApp).put("/api/platform/config/feature-switches/multi_warehouse").send({ enabled: true }),
      request(guardedApp).get("/api/platform/config/data-dict"),
      request(guardedApp).get("/api/platform/config/data-dict/unit/items"),
      request(guardedApp).put("/api/platform/config/data-dict/unit").send({ items: [] }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listFeatureSwitches).not.toHaveBeenCalled();
    expect(mocks.updateFeatureSwitch).not.toHaveBeenCalled();
    expect(mocks.replaceDictItems).not.toHaveBeenCalled();
  });
});

describe("C6-3-1 · GET /api/platform/config/feature-switches（功能开关列表）", () => {
  it("空表 ⇒ { items: [] }（诚实空态，不由后端预置功能清单）", async () => {
    mocks.listFeatureSwitches.mockResolvedValueOnce({ items: [] });
    const res = await request(app).get("/api/platform/config/feature-switches");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ items: [] });
  });

  it("有行 ⇒ 逐字段返回 featureCode/featureName/enabled/defaultForNewTenant/remark", async () => {
    mocks.listFeatureSwitches.mockResolvedValueOnce({
      items: [
        {
          featureCode: "multi_warehouse",
          featureName: "多仓库",
          enabled: true,
          defaultForNewTenant: false,
          remark: null,
        },
      ],
    });
    const res = await request(app).get("/api/platform/config/feature-switches");
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toEqual({
      featureCode: "multi_warehouse",
      featureName: "多仓库",
      enabled: true,
      defaultForNewTenant: false,
      remark: null,
    });
  });
});

describe("C6-3-1 · PUT /api/platform/config/feature-switches/:code（改开关）", () => {
  it("带 enabled ⇒ 透传 code 并返回 changedFields", async () => {
    mocks.updateFeatureSwitch.mockResolvedValueOnce({
      featureCode: "multi_warehouse",
      changedFields: ["enabled"],
    });
    const res = await request(app)
      .put("/api/platform/config/feature-switches/multi_warehouse")
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ featureCode: "multi_warehouse", changedFields: ["enabled"] });
    expect(mocks.updateFeatureSwitch.mock.calls[0][0]).toBe("multi_warehouse");
    expect(mocks.updateFeatureSwitch.mock.calls[0][1]).toEqual({ enabled: true });
  });

  it("body 一个可变更字段都没给 ⇒ 400（zod 反射，且不调用 service）", async () => {
    const res = await request(app)
      .put("/api/platform/config/feature-switches/multi_warehouse")
      .send({});
    expect(res.status).toBe(400);
    expect(mocks.updateFeatureSwitch).not.toHaveBeenCalled();
  });

  it("body 给未知字段 ⇒ 400（zod 严格不认的自拟字段）", async () => {
    const res = await request(app)
      .put("/api/platform/config/feature-switches/multi_warehouse")
      .send({ featureName: "自拟字段" });
    expect(res.status).toBe(400);
    expect(mocks.updateFeatureSwitch).not.toHaveBeenCalled();
  });

  it("未知 code ⇒ 404（service 抛 AppError 404，原样透出）", async () => {
    mocks.updateFeatureSwitch.mockRejectedValueOnce(new AppError("功能开关不存在：nope", 404));
    const res = await request(app)
      .put("/api/platform/config/feature-switches/nope")
      .send({ enabled: true });
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("功能开关不存在：nope");
  });

  it("提交值等于当前值（无变更）⇒ 400（不得静默成功）", async () => {
    mocks.updateFeatureSwitch.mockRejectedValueOnce(
      new AppError("提交内容与当前配置一致，无字段变更", 400)
    );
    const res = await request(app)
      .put("/api/platform/config/feature-switches/multi_warehouse")
      .send({ enabled: false });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("提交内容与当前配置一致，无字段变更");
  });
});

describe("C6-3-1 · GET /api/platform/config/data-dict（字典类型列表）", () => {
  it("零预置 ⇒ 空表 ⇒ { items: [] }", async () => {
    mocks.listDictTypes.mockResolvedValueOnce({ items: [] });
    const res = await request(app).get("/api/platform/config/data-dict");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [] });
  });

  it("有行 ⇒ 返回 dictType/dictName/remark/status/itemCount", async () => {
    mocks.listDictTypes.mockResolvedValueOnce({
      items: [
        { dictType: "unit", dictName: "计量单位", remark: null, status: "ACTIVE", itemCount: 4 },
      ],
    });
    const res = await request(app).get("/api/platform/config/data-dict");
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toEqual({
      dictType: "unit",
      dictName: "计量单位",
      remark: null,
      status: "ACTIVE",
      itemCount: 4,
    });
  });
});

describe("C6-3-1 · GET /api/platform/config/data-dict/:dictType/items（字典项）", () => {
  it("合法类型未落库 ⇒ { dictType, items: [] }", async () => {
    mocks.listDictItems.mockResolvedValueOnce({ dictType: "unit", items: [] });
    const res = await request(app).get("/api/platform/config/data-dict/unit/items");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ dictType: "unit", items: [] });
    expect(mocks.listDictItems.mock.calls[0][0]).toBe("unit");
  });

  it("未知 dictType ⇒ 404", async () => {
    mocks.listDictItems.mockRejectedValueOnce(new AppError("未知字典类型：nope", 404));
    const res = await request(app).get("/api/platform/config/data-dict/nope/items");
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("未知字典类型：nope");
  });

  it("自拟的 /data-dict/:dictType（不带 /items）不是本单路径 ⇒ 404（证明未放宽路由）", async () => {
    const res = await request(app).get("/api/platform/config/data-dict/unit");
    expect(res.status).toBe(404);
    expect(mocks.listDictItems).not.toHaveBeenCalled();
  });
});

describe("C6-3-1 · PUT /api/platform/config/data-dict/:dictType（整包替换）", () => {
  it("整包替换 ⇒ 透传 dictType 与 items，返回 saved", async () => {
    mocks.replaceDictItems.mockResolvedValueOnce({ dictType: "unit", saved: 2 });
    const items = [
      { itemCode: "bottle", itemName: "瓶", sortNo: 1, status: "ACTIVE" },
      { itemCode: "box", itemName: "箱", sortNo: 2 },
    ];
    const res = await request(app)
      .put("/api/platform/config/data-dict/unit")
      .send({ items });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ dictType: "unit", saved: 2 });
    expect(mocks.replaceDictItems.mock.calls[0][0]).toBe("unit");
    expect(mocks.replaceDictItems.mock.calls[0][1].length).toBe(2);
  });

  it("空数组 ⇒ 允许（清空该类型字典项，幂等），不触发 400", async () => {
    mocks.replaceDictItems.mockResolvedValueOnce({ dictType: "unit", saved: 0 });
    const res = await request(app).put("/api/platform/config/data-dict/unit").send({ items: [] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ dictType: "unit", saved: 0 });
  });

  it("items 不是数组 ⇒ 400（zod，且不调用 service）", async () => {
    const res = await request(app)
      .put("/api/platform/config/data-dict/unit")
      .send({ items: { itemCode: "bottle" } });
    expect(res.status).toBe(400);
    expect(mocks.replaceDictItems).not.toHaveBeenCalled();
  });

  it("itemCode 为空串 ⇒ 400（zod min(1)）", async () => {
    const res = await request(app)
      .put("/api/platform/config/data-dict/unit")
      .send({ items: [{ itemCode: "", itemName: "瓶" }] });
    expect(res.status).toBe(400);
    expect(mocks.replaceDictItems).not.toHaveBeenCalled();
  });

  it("itemCode 重复 ⇒ 400（service 抛 AppError，原样透出）", async () => {
    mocks.replaceDictItems.mockRejectedValueOnce(new AppError("字典项编码重复：bottle", 400));
    const res = await request(app)
      .put("/api/platform/config/data-dict/unit")
      .send({ items: [{ itemCode: "bottle", itemName: "瓶" }, { itemCode: "bottle", itemName: "瓶2" }] });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("字典项编码重复：bottle");
  });

  it("未知 dictType ⇒ 404（service 抛 AppError）", async () => {
    mocks.replaceDictItems.mockRejectedValueOnce(new AppError("未知字典类型：nope", 404));
    const res = await request(app).put("/api/platform/config/data-dict/nope").send({ items: [] });
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("未知字典类型：nope");
  });
});
