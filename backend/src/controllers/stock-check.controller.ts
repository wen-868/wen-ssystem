import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as service from "../services/admin/stock-check.service.js";

// ==================== Admin 控制器 ====================

export const adminStockCheck = {
  create: asyncHandler(async (req, res) => {
    const body = z.object({
      storeId: z.number().int().positive(),
      remark: z.string().default("")
    }).parse(req.body);
    const result = await service.createCheck({ ...body, tenantId: req.tenantId! });
    res.json(ok(result));
  }),

  list: asyncHandler(async (req, res) => {
    const params = z.object({
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(20),
      storeId: z.coerce.number().optional(),
      status: z.enum(["DRAFT", "CHECKING", "COMPLETED", "CANCELLED"]).optional()
    }).parse(req.query);
    const result = await service.listChecks({ ...params, tenantId: req.tenantId! });
    res.json(ok(result));
  }),

  statistics: asyncHandler(async (req, res) => {
    const result = await service.getStatistics(req.tenantId!);
    res.json(ok(result));
  }),

  detail: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.getCheckDetail(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(e.statusCode || 404).json(fail(e.message));
    }
  }),

  update: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const body = z.object({ remark: z.string().optional() }).parse(req.body);
      const result = await service.updateCheck(id, req.tenantId!, body);
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),

  start: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.startCheck(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),

  complete: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.completeCheck(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),

  cancel: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.cancelCheck(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),

  handleDiff: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const body = z.object({ itemId: z.number().int().positive() }).parse(req.body);
      const result = await service.handleDiff({
        checkId: id, itemId: body.itemId, tenantId: req.tenantId!, userId: req.user!.id
      });
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),
};

// ==================== Store 控制器 ====================

export const storeStockCheck = {
  my: asyncHandler(async (req, res) => {
    const storeId = req.user?.storeId;
    if (!storeId) {
      res.status(400).json(fail("未关联门店"));
      return;
    }
    const result = await service.listMyChecks(storeId, req.tenantId!);
    res.json(ok(result));
  }),

  detail: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.getMyCheckDetail(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(e.statusCode || 404).json(fail(e.message));
    }
  }),

  updateItem: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const itemId = z.coerce.number().parse(req.params.itemId);
      const body = z.object({ actualQty: z.number().int().min(0) }).parse(req.body);
      const result = await service.updateItemQty({
        checkId: id, itemId, actualQty: body.actualQty, tenantId: req.tenantId!
      });
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),

  submit: asyncHandler(async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const result = await service.submitCheck(id, req.tenantId!);
      res.json(ok(result));
    } catch (e: any) {
      res.status(400).json(fail(e.message));
    }
  }),
};

// 扁平导出：routes 层引用的名称
export const create = adminStockCheck.create;
export const getStatistics = adminStockCheck.statistics;
export const list = adminStockCheck.list;
export const getDetail = adminStockCheck.detail;
export const update = adminStockCheck.update;
export const start = adminStockCheck.start;
export const complete = adminStockCheck.complete;
export const cancel = adminStockCheck.cancel;
export const handleDiff = adminStockCheck.handleDiff;
export const getMyList = storeStockCheck.my;
export const updateItem = storeStockCheck.updateItem;
export const submit = storeStockCheck.submit;