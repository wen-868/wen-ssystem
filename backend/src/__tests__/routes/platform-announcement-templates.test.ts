// C2-0 实现段（公告模板 #11/#12）路由级测试
//
// 关注点：
// 1. 新端点 /templates 必须注册在通配 /:id 之前（否则被 /:id 吃掉）；
// 2. 原有 6 个公告端点的路径一条不少（本单未改既有契约）；
// 3. 空态：无数据 返回 records 空数组，不造默认模板；
// 4. 鉴权反向：无令牌 401（真实 requirePlatformAuth）。
//
// 注意：本沙箱 vitest 无法启动（spawn EPERM），用例只写好，执行由凌舟在本机跑。
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  getAnnouncementTemplates: vi.fn(),
  saveAnnouncementTemplates: vi.fn(),
}));

vi.mock("../../services/platform/announcement-template.service", () => ({
  getAnnouncementTemplates: mocks.getAnnouncementTemplates,
  saveAnnouncementTemplates: mocks.saveAnnouncementTemplates,
}));

import { AppError } from "../../shared/app-error";
import { adminPlatformAnnouncementRouter } from "../../routes/admin-platform-announcement.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const PREFIX = "/api/platform/announcements";
const app = createTestApp({ prefix: PREFIX, router: adminPlatformAnnouncementRouter });

const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(PREFIX, requirePlatformAuth, adminPlatformAnnouncementRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

const routePaths = (adminPlatformAnnouncementRouter as any).stack
  .filter((layer: any) => layer.route)
  .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

describe("C2-0 #11 GET /api/platform/announcements/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 records 空数组（不造默认模板）", async () => {
    mocks.getAnnouncementTemplates.mockResolvedValue({ records: [], total: 0 });
    const res = await request(app).get(`${PREFIX}/templates`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("200 + 已保存模板回显", async () => {
    mocks.getAnnouncementTemplates.mockResolvedValue({
      records: [{ code: "DUNNING", name: "催缴通知", content: "{租户名} 欠费 {欠费额}" }],
      total: 1,
    });
    const res = await request(app).get(`${PREFIX}/templates`);

    expect(res.status).toBe(200);
    expect(res.body.data.records[0].code).toBe("DUNNING");
  });
});

describe("C2-0 #12 PUT /api/platform/announcements/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 整包覆盖保存（操作人取平台令牌）", async () => {
    mocks.saveAnnouncementTemplates.mockResolvedValue({
      saved: true,
      total: 1,
      records: [{ code: "DUNNING", name: "催缴通知", content: "内容" }],
    });
    const res = await request(app)
      .put(`${PREFIX}/templates`)
      .send({ records: [{ code: "DUNNING", name: "催缴通知", content: "内容" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(true);
    expect(mocks.saveAnnouncementTemplates).toHaveBeenCalledWith(
      [{ code: "DUNNING", name: "催缴通知", content: "内容" }],
      "testadmin"
    );
  });

  it("200 + 保存空数组（清空语义）", async () => {
    mocks.saveAnnouncementTemplates.mockResolvedValue({ saved: true, total: 0, records: [] });
    const res = await request(app).put(`${PREFIX}/templates`).send({ records: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });

  it("records 非数组 400 且不调 service", async () => {
    const res = await request(app).put(`${PREFIX}/templates`).send({ records: "DUNNING" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(mocks.saveAnnouncementTemplates).not.toHaveBeenCalled();
  });

  it("模板缺 name/code 400", async () => {
    const res = await request(app)
      .put(`${PREFIX}/templates`)
      .send({ records: [{ code: "DUNNING" }] });
    expect(res.status).toBe(400);
    expect(mocks.saveAnnouncementTemplates).not.toHaveBeenCalled();
  });

  it("编码重复 400（整包内自相矛盾）", async () => {
    const res = await request(app)
      .put(`${PREFIX}/templates`)
      .send({
        records: [
          { code: "DUNNING", name: "催缴", content: "a" },
          { code: "DUNNING", name: "催缴2", content: "b" },
        ],
      });
    expect(res.status).toBe(400);
    expect(mocks.saveAnnouncementTemplates).not.toHaveBeenCalled();
  });
});

describe("C2-0 公告路由注册（顺序 + 既有契约完整性）", () => {
  it("新端点 /templates 排在通配 /:id 之前（否则被吃掉）", () => {
    expect(routePaths.indexOf("get /templates")).toBeGreaterThan(-1);
    expect(routePaths.indexOf("get /templates")).toBeLessThan(routePaths.indexOf("get /:id"));
    expect(routePaths.indexOf("put /templates")).toBeLessThan(routePaths.indexOf("put /:id"));
  });

  it("原有 6 个公告端点一条不少（既有契约未改）", () => {
    expect(routePaths).toEqual(
      expect.arrayContaining([
        "get /",
        "get /:id",
        "post /",
        "put /:id",
        "delete /:id",
        "post /:id/publish",
      ])
    );
    expect(routePaths).toHaveLength(8);
  });

  it("routeConfig 前缀与鉴权口径未变", async () => {
    const { routeConfig } = await import("../../routes/admin-platform-announcement.routes");
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });
});

describe("C2-0 反测：公告模板 2 个端点 无令牌 401/403", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /templates 无令牌 401", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/templates`);
    expect([401, 403]).toContain(res.status);
    expect(res.body.code).toBe("401");
    expect(mocks.getAnnouncementTemplates).not.toHaveBeenCalled();
  });

  it("PUT /templates 无令牌 401", async () => {
    const res = await request(guardedApp)
      .put(`${PREFIX}/templates`)
      .send({ records: [] });
    expect([401, 403]).toContain(res.status);
    expect(res.body.code).toBe("401");
    expect(mocks.saveAnnouncementTemplates).not.toHaveBeenCalled();
  });

  it("既有端点 无令牌仍 401（未因新增端点放松鉴权）", async () => {
    const res = await request(guardedApp).get(`${PREFIX}`);
    expect([401, 403]).toContain(res.status);
  });
});

describe("C2-0 服务层错误透传（公告模板）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("service 抛 AppError 400 时按 400 返回", async () => {
    mocks.saveAnnouncementTemplates.mockRejectedValue(new AppError("模板结构非法", 400));
    const res = await request(app)
      .put(`${PREFIX}/templates`)
      .send({ records: [{ code: "A", name: "A", content: "x" }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
  });
});
