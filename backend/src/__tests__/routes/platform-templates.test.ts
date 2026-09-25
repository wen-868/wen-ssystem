/**
 * C2-0 实现段（模板中心 #1~#10）路由级测试
 *
 * 范式：src/__tests__/routes/platform-c1-2-plan.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth 的 guardedApp（不带 Authorization）⇒ 401/403。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，见 R101-C2-0 裁定 §六），
 *       本文件只负责「写好用例」，执行由凌舟在本机跑。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listInitTemplates: vi.fn(),
  createInitTemplate: vi.fn(),
  updateInitTemplate: vi.fn(),
  listTemplateVersions: vi.fn(),
  listPrintTemplates: vi.fn(),
  uploadPrintTemplate: vi.fn(),
  setPrintTemplatePublic: vi.fn(),
  listIoTemplates: vi.fn(),
  createIoTemplate: vi.fn(),
  downloadIoTemplate: vi.fn(),
}));

vi.mock("../../services/platform/platform-template.service", () => ({
  listInitTemplates: mocks.listInitTemplates,
  createInitTemplate: mocks.createInitTemplate,
  updateInitTemplate: mocks.updateInitTemplate,
  listTemplateVersions: mocks.listTemplateVersions,
}));

vi.mock("../../services/platform/platform-print-template.service", () => ({
  listPrintTemplates: mocks.listPrintTemplates,
  uploadPrintTemplate: mocks.uploadPrintTemplate,
  setPrintTemplatePublic: mocks.setPrintTemplatePublic,
}));

vi.mock("../../services/platform/platform-io-template.service", () => ({
  listIoTemplates: mocks.listIoTemplates,
  createIoTemplate: mocks.createIoTemplate,
  downloadIoTemplate: mocks.downloadIoTemplate,
}));

import { AppError } from "../../shared/app-error";
import { platformTemplatesRouter } from "../../routes/platform-templates.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const PREFIX = "/api/platform/templates";
const app = createTestApp({ prefix: PREFIX, router: platformTemplatesRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于每条端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(PREFIX, requirePlatformAuth, platformTemplatesRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

describe("C2-0 #1 GET /api/platform/templates/init", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 records: []（不是 null/undefined，不造数据）", async () => {
    mocks.listInitTemplates.mockResolvedValue({ records: [], total: 0 });
    const res = await request(app).get(`${PREFIX}/init`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("200 + 列表字段与 copyConfigs（将复制的配置随列表返回）", async () => {
    mocks.listInitTemplates.mockResolvedValue({
      records: [
        {
          id: 1,
          code: "RETAIL_BASIC",
          name: "零售标准版",
          applicable: "单店零售",
          codeRule: "SP",
          convertRule: "箱-瓶",
          printRef: "12,13",
          defaultWhAccount: "主仓/现金账户",
          configJson: { copyConfigs: [{ label: "编号规则", public: true }] },
          copyConfigs: [{ label: "编号规则", public: true }],
          freeAvailable: true,
          recommended: true,
          version: 3,
          refCount: 0,
          status: 1,
          createdAt: "2026-09-23 10:00:00",
          updatedAt: "2026-09-23 10:00:00",
        },
      ],
      total: 1,
    });
    const res = await request(app).get(`${PREFIX}/init`);

    expect(res.status).toBe(200);
    const record = res.body.data.records[0];
    expect(record.code).toBe("RETAIL_BASIC");
    expect(record.copyConfigs).toEqual([{ label: "编号规则", public: true }]);
    expect(record.version).toBe(3);
    expect(record.freeAvailable).toBe(true);
  });
});

describe("C2-0 #2 POST /api/platform/templates/init", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 + 新建结果（操作人取平台令牌）", async () => {
    mocks.createInitTemplate.mockResolvedValue({
      id: 7,
      code: "RETAIL_NEW",
      name: "零售新建模板",
      version: 1,
      copyConfigs: [],
    });
    const res = await request(app)
      .post(`${PREFIX}/init`)
      .send({ code: "RETAIL_NEW", name: "零售新建模板", freeAvailable: true });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(7);
    expect(mocks.createInitTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RETAIL_NEW", name: "零售新建模板", freeAvailable: true }),
      "testadmin"
    );
  });

  it("缺 code/name ⇒ 400 且不调 service", async () => {
    const res = await request(app).post(`${PREFIX}/init`).send({ name: "只有名字" });
    expect(res.status).toBe(400);
    expect(mocks.createInitTemplate).not.toHaveBeenCalled();
  });

  it("编码重复 ⇒ 409（service 抛 AppError）", async () => {
    mocks.createInitTemplate.mockRejectedValue(new AppError("模板编码已存在：RETAIL_BASIC", 409));
    const res = await request(app)
      .post(`${PREFIX}/init`)
      .send({ code: "RETAIL_BASIC", name: "重复编码" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("409");
  });
});

describe("C2-0 #3 PUT /api/platform/templates/init/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + version+1 与变更字段", async () => {
    mocks.updateInitTemplate.mockResolvedValue({
      id: 3,
      version: 4,
      changedFields: ["name"],
      copyConfigs: [],
    });
    const res = await request(app).put(`${PREFIX}/init/3`).send({ name: "改名后的模板" });

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(4);
    expect(mocks.updateInitTemplate).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ name: "改名后的模板" }),
      "testadmin"
    );
  });

  it(":id 非正整数 ⇒ 400 且不调 service", async () => {
    const res = await request(app).put(`${PREFIX}/init/abc`).send({ name: "x" });
    expect(res.status).toBe(400);
    expect(mocks.updateInitTemplate).not.toHaveBeenCalled();
  });

  it("模板不存在 ⇒ 404", async () => {
    mocks.updateInitTemplate.mockRejectedValue(new AppError("初始化模板不存在：999", 404));
    const res = await request(app).put(`${PREFIX}/init/999`).send({ name: "x" });
    expect(res.status).toBe(404);
  });
});

describe("C2-0 #4 GET /api/platform/templates/init/:id/versions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 records: []", async () => {
    mocks.listTemplateVersions.mockResolvedValue({ records: [], total: 0, templateId: 5 });
    const res = await request(app).get(`${PREFIX}/init/5/versions`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(mocks.listTemplateVersions).toHaveBeenCalledWith(5);
  });

  it("200 + 版本倒序（含 changeNote 与快照）", async () => {
    mocks.listTemplateVersions.mockResolvedValue({
      records: [
        {
          id: 2,
          templateId: 5,
          version: 2,
          configJson: null,
          copyConfigs: [],
          changeNote: "编辑模板（name）",
          createdBy: "platform_admin",
          createdAt: "2026-09-23 11:00:00",
        },
        {
          id: 1,
          templateId: 5,
          version: 1,
          configJson: null,
          copyConfigs: [],
          changeNote: "新建模板首版本",
          createdBy: "platform_admin",
          createdAt: "2026-09-23 10:00:00",
        },
      ],
      total: 2,
      templateId: 5,
    });
    const res = await request(app).get(`${PREFIX}/init/5/versions`);

    expect(res.status).toBe(200);
    expect(res.body.data.records.map((r: any) => r.version)).toEqual([2, 1]);
  });

  it(":id 非正整数 ⇒ 400 且不调 service", async () => {
    const res = await request(app).get(`${PREFIX}/init/0/versions`);
    expect(res.status).toBe(400);
    expect(mocks.listTemplateVersions).not.toHaveBeenCalled();
  });
});

describe("C2-0 #5 GET /api/platform/templates/print", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 records: []", async () => {
    mocks.listPrintTemplates.mockResolvedValue({ records: [], total: 0, billType: null });
    const res = await request(app).get(`${PREFIX}/print`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(mocks.listPrintTemplates).toHaveBeenCalledWith(undefined);
  });

  it("?billType=SALE_BILL 透传给 service（public 为布尔）", async () => {
    mocks.listPrintTemplates.mockResolvedValue({
      records: [
        {
          id: 2,
          name: "销售单 A4",
          billType: "SALE_BILL",
          paperType: "A4",
          spec: "A4 纵向",
          content: "{}",
          public: true,
          version: 1,
          status: 1,
          createdAt: "2026-09-23 10:00:00",
          updatedAt: "2026-09-23 10:00:00",
        },
      ],
      total: 1,
      billType: "SALE_BILL",
    });
    const res = await request(app).get(`${PREFIX}/print?billType=SALE_BILL`);

    expect(res.status).toBe(200);
    expect(res.body.data.records[0].public).toBe(true);
    expect(mocks.listPrintTemplates).toHaveBeenCalledWith("SALE_BILL");
  });

  it("?billType=ALL 等价于不筛选", async () => {
    mocks.listPrintTemplates.mockResolvedValue({ records: [], total: 0, billType: null });
    const res = await request(app).get(`${PREFIX}/print?billType=ALL`);
    expect(res.status).toBe(200);
    expect(mocks.listPrintTemplates).toHaveBeenCalledWith(undefined);
  });

  it("参数非法（?billType=FOO）⇒ 400 且不调 service", async () => {
    const res = await request(app).get(`${PREFIX}/print?billType=FOO`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(mocks.listPrintTemplates).not.toHaveBeenCalled();
  });
});

describe("C2-0 #6 POST /api/platform/templates/print/upload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 + 落库 is_public=1（public: true）", async () => {
    mocks.uploadPrintTemplate.mockResolvedValue({
      id: 9,
      name: "小票模板",
      billType: "SALE_RECEIPT",
      paperType: "RECEIPT_80",
      public: true,
      version: 1,
    });
    const res = await request(app)
      .post(`${PREFIX}/print/upload`)
      .send({ name: "小票模板", billType: "SALE_RECEIPT", content: "{\"version\":2}" });

    expect(res.status).toBe(201);
    expect(res.body.data.public).toBe(true);
    expect(mocks.uploadPrintTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ billType: "SALE_RECEIPT", content: "{\"version\":2}" }),
      "testadmin"
    );
  });

  it("缺 billType/content ⇒ 400 且不调 service", async () => {
    const res = await request(app).post(`${PREFIX}/print/upload`).send({ name: "缺字段" });
    expect(res.status).toBe(400);
    expect(mocks.uploadPrintTemplate).not.toHaveBeenCalled();
  });

  it("paperType 不在枚举内 ⇒ 400", async () => {
    const res = await request(app)
      .post(`${PREFIX}/print/upload`)
      .send({ name: "x", billType: "SALE_BILL", content: "{}", paperType: "A5" });
    expect(res.status).toBe(400);
    expect(mocks.uploadPrintTemplate).not.toHaveBeenCalled();
  });
});

describe("C2-0 #7 POST /api/platform/templates/print/:id/public", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + public: true", async () => {
    mocks.setPrintTemplatePublic.mockResolvedValue({ id: 4, public: true, changed: false });
    const res = await request(app).post(`${PREFIX}/print/4/public`);

    expect(res.status).toBe(200);
    expect(res.body.data.public).toBe(true);
    expect(mocks.setPrintTemplatePublic).toHaveBeenCalledWith(4);
  });

  it("模板不存在 ⇒ 404", async () => {
    mocks.setPrintTemplatePublic.mockRejectedValue(new AppError("公共打印模板不存在：88", 404));
    const res = await request(app).post(`${PREFIX}/print/88/public`);
    expect(res.status).toBe(404);
  });

  it(":id 非正整数 ⇒ 400", async () => {
    const res = await request(app).post(`${PREFIX}/print/abc/public`);
    expect(res.status).toBe(400);
    expect(mocks.setPrintTemplatePublic).not.toHaveBeenCalled();
  });
});

describe("C2-0 #8 GET /api/platform/templates/import-export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 records: []", async () => {
    mocks.listIoTemplates.mockResolvedValue({ records: [], total: 0, direction: null });
    const res = await request(app).get(`${PREFIX}/import-export`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(mocks.listIoTemplates).toHaveBeenCalledWith(undefined);
  });

  it("?direction=IMPORT 透传（含 hasFile 标记）", async () => {
    mocks.listIoTemplates.mockResolvedValue({
      records: [
        {
          id: 1,
          name: "商品导入模板",
          direction: "IMPORT",
          version: "v1",
          fieldCount: 12,
          compat: "兼容 v0",
          fieldDesc: "字段说明",
          fileName: "goods.json",
          hasFile: true,
          createdAt: "2026-09-23 10:00:00",
          updatedAt: "2026-09-23 10:00:00",
        },
      ],
      total: 1,
      direction: "IMPORT",
    });
    const res = await request(app).get(`${PREFIX}/import-export?direction=IMPORT`);

    expect(res.status).toBe(200);
    expect(res.body.data.records[0].hasFile).toBe(true);
    expect(mocks.listIoTemplates).toHaveBeenCalledWith("IMPORT");
  });

  it("参数非法（?direction=SIDEWAYS）⇒ 400 且不调 service", async () => {
    const res = await request(app).get(`${PREFIX}/import-export?direction=SIDEWAYS`);
    expect(res.status).toBe(400);
    expect(mocks.listIoTemplates).not.toHaveBeenCalled();
  });
});

describe("C2-0 #9 POST /api/platform/templates/import-export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 + 新增结果（hasFile 由 fileContent 决定）", async () => {
    mocks.createIoTemplate.mockResolvedValue({
      id: 6,
      name: "导出模板",
      direction: "EXPORT",
      version: "v2",
      hasFile: true,
    });
    const res = await request(app)
      .post(`${PREFIX}/import-export`)
      .send({
        name: "导出模板",
        direction: "EXPORT",
        version: "v2",
        fieldCount: 8,
        fileName: "export.json",
        fileContent: "{\"columns\":[]}",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.hasFile).toBe(true);
    expect(mocks.createIoTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "EXPORT", fileName: "export.json" }),
      "testadmin"
    );
  });

  it("缺 direction ⇒ 400 且不调 service", async () => {
    const res = await request(app).post(`${PREFIX}/import-export`).send({ name: "只有名字" });
    expect(res.status).toBe(400);
    expect(mocks.createIoTemplate).not.toHaveBeenCalled();
  });

  it("direction 非 IMPORT/EXPORT ⇒ 400", async () => {
    const res = await request(app)
      .post(`${PREFIX}/import-export`)
      .send({ name: "x", direction: "BOTH" });
    expect(res.status).toBe(400);
    expect(mocks.createIoTemplate).not.toHaveBeenCalled();
  });
});

describe("C2-0 #10 GET /api/platform/templates/import-export/:id/download", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 原始文件内容与 Content-Disposition: attachment", async () => {
    mocks.downloadIoTemplate.mockResolvedValue({
      id: 6,
      name: "导出模板",
      fileName: "导出模板.json",
      content: "{\"columns\":[]}",
    });
    const res = await request(app).get(`${PREFIX}/import-export/6/download`);

    expect(res.status).toBe(200);
    expect(String(res.headers["content-disposition"])).toContain("attachment");
    expect(res.body.toString()).toBe("{\"columns\":[]}");
    expect(mocks.downloadIoTemplate).toHaveBeenCalledWith(6);
  });

  it("模板无文件内容 ⇒ 404（明确 message，不返回空文件）", async () => {
    mocks.downloadIoTemplate.mockRejectedValue(
      new AppError("模板「导出模板」未上传文件内容，无法下载", 404)
    );
    const res = await request(app).get(`${PREFIX}/import-export/7/download`);

    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("未上传文件内容");
  });

  it(":id 非正整数 ⇒ 400 且不调 service", async () => {
    const res = await request(app).get(`${PREFIX}/import-export/abc/download`);
    expect(res.status).toBe(400);
    expect(mocks.downloadIoTemplate).not.toHaveBeenCalled();
  });
});

describe("C2-0 路由注册（顺序 + 完整性）", () => {
  const paths = (platformTemplatesRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

  it("10 个端点全部注册", () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        "get /init",
        "post /init",
        "put /init/:id",
        "get /init/:id/versions",
        "get /print",
        "post /print/upload",
        "post /print/:id/public",
        "get /import-export",
        "post /import-export",
        "get /import-export/:id/download",
      ])
    );
    expect(paths).toHaveLength(10);
  });

  it("先具体后通配：/print/upload 在 /print/:id/public 之前", () => {
    expect(paths.indexOf("post /print/upload")).toBeLessThan(paths.indexOf("post /print/:id/public"));
  });

  it("router 级 routeConfig.auth = requirePlatformAuth", async () => {
    const { routeConfig } = await import("../../routes/platform-templates.routes");
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });
});

describe("C2-0 反测：模板中心 10 个端点「无令牌 ⇒ 401/403」", () => {
  const cases: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: "get", path: `${PREFIX}/init` },
    { method: "post", path: `${PREFIX}/init`, body: { code: "X", name: "X" } },
    { method: "put", path: `${PREFIX}/init/1`, body: { name: "X" } },
    { method: "get", path: `${PREFIX}/init/1/versions` },
    { method: "get", path: `${PREFIX}/print` },
    {
      method: "post",
      path: `${PREFIX}/print/upload`,
      body: { name: "X", billType: "SALE_BILL", content: "{}" },
    },
    { method: "post", path: `${PREFIX}/print/1/public` },
    { method: "get", path: `${PREFIX}/import-export` },
    { method: "post", path: `${PREFIX}/import-export`, body: { name: "X", direction: "IMPORT" } },
    { method: "get", path: `${PREFIX}/import-export/1/download` },
  ];

  it("覆盖 10 个端点（与公告侧 2 条合计 12）", () => {
    expect(cases).toHaveLength(10);
  });

  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path} 无令牌 ⇒ 401/403 且不触达 service`, async () => {
      vi.clearAllMocks();
      let req = (request(guardedApp) as any)[c.method](c.path);
      if (c.body) req = req.send(c.body);
      const res = await req;

      expect([401, 403]).toContain(res.status);
      expect(res.body.code).toBe("401");
      expect(mocks.listInitTemplates).not.toHaveBeenCalled();
      expect(mocks.createInitTemplate).not.toHaveBeenCalled();
      expect(mocks.updateInitTemplate).not.toHaveBeenCalled();
      expect(mocks.listTemplateVersions).not.toHaveBeenCalled();
      expect(mocks.listPrintTemplates).not.toHaveBeenCalled();
      expect(mocks.uploadPrintTemplate).not.toHaveBeenCalled();
      expect(mocks.setPrintTemplatePublic).not.toHaveBeenCalled();
      expect(mocks.listIoTemplates).not.toHaveBeenCalled();
      expect(mocks.createIoTemplate).not.toHaveBeenCalled();
      expect(mocks.downloadIoTemplate).not.toHaveBeenCalled();
    });
  }
});
