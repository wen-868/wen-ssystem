import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as customerService from "../../services/admin/customer.service";

/**
 * 创建客户入参校验（S3-181）
 *
 * 契约见 docs/API接口文档.md:417-428：name 必填、mobile 必填、
 * customerType 可选（RETAIL/WHOLESALE，默认 RETAIL）、staffId 可选。
 * 手机号口径沿用仓内既有写法 `/^1[3-9]\d{9}$/`
 * （同 member.service.ts:113、saas/tenant.controller.ts:32、admin-web CustomersView.vue:180）。
 *
 * 为什么必须补：controller 原先直接把 `req.body` 透给 service，字段名不符（如 AI 底座发
 * `phone` 而非 `mobile`）时 `body.mobile` 为 undefined 直达 INSERT ⇒ MySQL 报
 * 「Column 'mobile' cannot be null」且无人映射 ⇒ 未捕获 ⇒ 500（生产实例，见跨线缺陷报告）。
 * 校验失败由 ZodError 分支统一返回 400 + 逐字段错误。
 */
const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "客户名称必填").max(64, "客户名称不能超过 64 字"),
  mobile: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  customerType: z
    .enum(["RETAIL", "WHOLESALE"], { message: "客户类型只能是 RETAIL 或 WHOLESALE" })
    .default("RETAIL"),
  staffId: z.number().int().positive().optional(),
  contact: z.string().max(64, "联系人不能超过 64 字").optional(),
  address: z.string().max(255, "客户地址不能超过 255 字").optional(),
  settlementType: z.string().max(32).optional(),
  remark: z.string().max(500, "备注不能超过 500 字").optional(),
});

export const listMembers = asyncHandler(async (req, res) => {
  const result = await customerService.listMembers(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20),
    String(req.query.keyword || "")
  );
  res.json(ok(result));
});

export const createCustomer = asyncHandler(async (req, res) => {
  const body = createCustomerSchema.parse(req.body);
  const result = await customerService.createCustomer(req.tenantId!, body);
  res.json(ok(result));
});

export const getCustomerDetail = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerDetail(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.updateCustomer(req.tenantId!, Number(req.params.id), req.body);
  res.json(ok(result));
});

export const disableCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.disableCustomer(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
});

export const assignStaffToCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.assignStaffToCustomer(
    req.tenantId!,
    Number(req.params.id),
    Number(req.body.staffId)
  );
  res.json(ok(result));
});

export const getCustomerPriceHistory = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerPriceHistory(
    req.tenantId!,
    Number(req.params.id),
    Number(req.query.skuId)
  );
  res.json(ok(result));
});

export const listCustomerSaleBills = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerSaleBills(
    req.tenantId!,
    Number(req.params.id),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCustomerPayments = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerPayments(
    req.tenantId!,
    Number(req.params.id),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCustomerStatements = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerStatements(
    req.tenantId!,
    Number(req.params.id),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const getCustomerPurchaseStats = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerPurchaseStats(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
});

export const getCustomerStats = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerStats(req.tenantId!);
  res.json(ok(result));
});
