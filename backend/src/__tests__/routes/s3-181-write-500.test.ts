/**
 * S3-181 回归护栏：写端点不再因「入参字段名不符 / 唯一键撞车 / 业务前置缺失」返回 500
 *
 * 防的是什么（跨线缺陷报告 2026-10-13）：
 *   ① `POST /api/admin/members` 无 zod 校验 ⇒ 字段名不符（AI 底座发 `phone`）时
 *      `mobile` 为 undefined 直达 INSERT ⇒ `Column 'mobile' cannot be null` ⇒ 500；
 *   ② 同一 `mobile` 重复创建 ⇒ `ER_DUP_ENTRY`(`t_member.uk_member_mobile`) 无人映射 ⇒ 500；
 *   ③ `POST /api/store/sale-bills` 的 `SKU不存在：<skuId>` 抛的是裸 Error（无 statusCode）
 *      ⇒ 落进"未知错误"分支 ⇒ 500（客户传入的 skuId 无效，本应 400）。
 *
 * 反测（本文件即判据）：把 ① 的 zod 去掉 ⇒ 用例 A1/A2/A3 该红就红；
 * 把 ② 的映射去掉 ⇒ 用例 B1/B2 该红就红；把 ③ 改回裸 Error ⇒ 用例 C1 该红就红。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockInsertErrorLog, mockReportToLingZhou } = vi.hoisted(() => ({
  mockInsertErrorLog: vi.fn().mockResolvedValue(undefined),
  mockReportToLingZhou: vi.fn().mockResolvedValue({ ok: false, status: 0, data: {} }),
}));

vi.mock("../../services/admin/error-log.service", () => ({ insertErrorLog: mockInsertErrorLog }));
vi.mock("../../shared/feishu-report", () => ({ reportToLingZhou: mockReportToLingZhou }));

import { errorHandler } from "../../middleware/error-handler";
import { routeConfig as adminCustomerRouteConfig } from "../../routes/admin-customer.routes";
import { routeConfigs as storeSaleBillRouteConfigs } from "../../routes/store-sale-bill.routes";
import type { Request, Response, NextFunction } from "express";

const ADMIN_USER = { id: 1, username: "testadmin", realName: "测试管理员", roles: ["SUPER_ADMIN"], storeId: 1 };

/** 挂「本文件自己的路由 + 生产同款 errorHandler」，与整机装配解耦（避免被别的文件抢先注册） */
function buildApp(routeConfig: { prefix: string; router: any }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.tenantId = "default";
    req.user = ADMIN_USER;
    next();
  });
  app.use(routeConfig.prefix, routeConfig.router);
  app.use(errorHandler);
  return app;
}

const memberApp = buildApp(adminCustomerRouteConfig);
// S3-195：该文件已收窄为 routeConfigs（/api/store/sale-bills + /api/store/payment），本用例只用前者
const saleBillApp = buildApp(
  storeSaleBillRouteConfigs.find((c) => c.prefix === "/api/store/sale-bills")!
);

/** 构造 mysql2 驱动形状的错误（与生产栈同形状） */
function driverError(message: string, code: string, errno: number) {
  return Object.assign(new Error(message), { code, errno });
}

function mockReqRes() {
  const req = { originalUrl: "/api/test", url: "/api/test", method: "POST", user: { id: 1 }, tenantId: "default" } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S3-181 ① POST /api/admin/members 入参校验（字段名不符不再 500）", () => {
  it("A1 AI 底座字段名（phone 而非 mobile）⇒ 400 且指出 mobile 必填，响应不含 SQL 原文", async () => {
    const res = await request(memberApp)
      .post("/api/admin/members")
      .send({ name: "幂等验证专用客户A", phone: "13900000001", customerType: "WHOLESALE" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    const fields = (res.body.errors || []).map((e: { field: string }) => e.field);
    expect(fields).toContain("mobile");
    expect(JSON.stringify(res.body)).not.toContain("cannot be null");
  });

  it("A2 空体 {} ⇒ 400（逐字段列出缺项）", async () => {
    const res = await request(memberApp).post("/api/admin/members").send({});

    expect(res.status).toBe(400);
    const fields = (res.body.errors || []).map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "mobile"]));
  });

  it("A3 手机号格式不合法 ⇒ 400（沿用仓内 /^1[3-9]\\d{9}$/ 口径）", async () => {
    const res = await request(memberApp).post("/api/admin/members").send({ name: "格式错误", mobile: "12345" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain("手机号格式不正确");
  });

  it("A4 正常入参 ⇒ 200（校验不误伤）", async () => {
    const res = await request(memberApp)
      .post("/api/admin/members")
      .send({ name: "正常客户", mobile: "13900000009", customerType: "WHOLESALE" });

    expect(res.status).toBe(200);
    expect(res.body.data.memberId).toBeTruthy();
  });

  it("A5 customerType 缺省 ⇒ 按契约默认 RETAIL（不再以 null 进库）", async () => {
    const res = await request(memberApp).post("/api/admin/members").send({ name: "默认类型客户", mobile: "13900000008" });

    expect(res.status).toBe(200);
    expect(res.body.data.customerType).toBe("RETAIL");
  });
});

describe("S3-181 ② 回库错误映射（errorHandler 全局）", () => {
  it("B1 ER_DUP_ENTRY(t_member.uk_member_mobile) ⇒ 409 + 中文业务文案，且不回显 SQL 原文", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(
      driverError("Duplicate entry '13900000001' for key 't_member.uk_member_mobile'", "ER_DUP_ENTRY", 1062),
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.code).toBe("409");
    expect(payload.msg).toBe("该手机号已存在");
    expect(JSON.stringify(payload)).not.toContain("Duplicate entry");
    expect(JSON.stringify(payload)).not.toContain("13900000001");
  });

  it("B2 撞未登记唯一键 ⇒ 409 + 通用文案（仍不含 SQL 原文）", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(driverError("Duplicate entry 'x' for key 'uk_some_unknown_key'", "ER_DUP_ENTRY", 1062), req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.msg).toBe("该记录已存在，请检查是否重复提交");
    expect(JSON.stringify(payload)).not.toContain("Duplicate entry");
  });

  it("B3 ER_BAD_NULL_ERROR(1048) ⇒ 400 + 指出缺哪个必填参数", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(driverError("Column 'mobile' cannot be null", "ER_BAD_NULL_ERROR", 1048), req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as any).mock.calls[0][0].msg).toBe("缺少必填参数：mobile");
  });

  it("B4 ER_NO_DEFAULT_FOR_FIELD(1364) ⇒ 400 + 指出缺哪个必填参数", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(
      driverError("Field 'rule_name' doesn't have a default value", "ER_NO_DEFAULT_FOR_FIELD", 1364),
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as any).mock.calls[0][0].msg).toBe("缺少必填参数：rule_name");
  });

  it("B5 其余 DB 错误（如语法错）⇒ 仍 500，不被吞成 4xx", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(driverError("You have an error in your SQL syntax", "ER_PARSE_ERROR", 1064), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect((res.json as any).mock.calls[0][0].msg).toBe("服务器内部错误");
  });

  it("B6 普通 Error ⇒ 仍 500（映射未放宽）", () => {
    const { req, res, next } = mockReqRes();
    errorHandler(new Error("未知错误"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("S3-181 ③ POST /api/store/sale-bills 业务前置缺失不再 500", () => {
  it("C1 skuId 在本租户查不到 ⇒ 400 + 「SKU不存在」，不是 500", async () => {
    const res = await request(saleBillApp)
      .post("/api/store/sale-bills")
      .send({
        storeId: 1,
        customerId: null,
        saleType: "CASH",
        discountAmount: 0,
        roundingAmount: 0,
        items: [{ skuId: 99999999, totalBottleQty: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("SKU不存在");
  });

  it("C2 缺 items ⇒ 400（zod 原有判据未被削弱）", async () => {
    const res = await request(saleBillApp).post("/api/store/sale-bills").send({});

    expect(res.status).toBe(400);
  });

  it("C3 正常清单 ⇒ 200（收口不误伤正常链路）", async () => {
    const res = await request(saleBillApp)
      .post("/api/store/sale-bills")
      .send({
        storeId: 1,
        customerId: null,
        saleType: "CASH",
        discountAmount: 0,
        roundingAmount: 0,
        items: [{ skuId: 1, totalBottleQty: 2 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.billNo).toBeTruthy();
  });
});
