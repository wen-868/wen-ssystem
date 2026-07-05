import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as service from "../services/admin/store-control.service.js";

// ==================== Admin 控制器 ====================

export const adminStoreControl = {
  getConfigs: asyncHandler(async (req, res) => {
    const result = await service.getConfigs(req.tenantId!);
    res.json(ok(result));
  }),

  getConfig: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const result = await service.getConfig(storeId, req.tenantId!);
    res.json(ok(result));
  }),

  upsertConfig: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const body = z.object({
      autoOpenTime: z.string().nullable().optional(),
      autoCloseTime: z.string().nullable().optional(),
      maxDailyOrders: z.number().nullable().optional(),
      maxOrderAmount: z.number().nullable().optional()
    }).parse(req.body);
    const result = await service.upsertConfig({ storeId, tenantId: req.tenantId!, ...body });
    res.json(ok(result));
  }),

  open: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const result = await service.openStore({
      storeId, tenantId: req.tenantId!, userId: req.user!.id
    });
    res.json(ok(result));
  }),

  close: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const result = await service.closeStore({
      storeId, tenantId: req.tenantId!, userId: req.user!.id
    });
    res.json(ok(result));
  }),

  suspend: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const body = z.object({ reason: z.string().optional() }).parse(req.body);
    const result = await service.suspendStore({
      storeId, tenantId: req.tenantId!, userId: req.user!.id, reason: body.reason
    });
    res.json(ok(result));
  }),

  resume: asyncHandler(async (req, res) => {
    const storeId = z.coerce.number().parse(req.params.storeId);
    const result = await service.resumeStore({
      storeId, tenantId: req.tenantId!, userId: req.user!.id
    });
    res.json(ok(result));
  }),

  getLogs: asyncHandler(async (req, res) => {
    const params = z.object({
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(20),
      storeId: z.coerce.number().optional(),
      changeType: z.enum(["MANUAL", "SCHEDULED", "AUTO"]).optional()
    }).parse(req.query);
    const result = await service.getLogs({ ...params, tenantId: req.tenantId! });
    res.json(ok(result));
  }),
};

// ==================== Store 控制器 ====================

export const storeStoreControl = {
  status: asyncHandler(async (req, res) => {
    const storeId = req.user?.storeId ?? 1;
    const result = await service.getStoreStatus(storeId, req.tenantId!);
    res.json(ok(result));
  }),

  myLogs: asyncHandler(async (req, res) => {
    const storeId = req.user?.storeId ?? 1;
    const params = z.object({
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(20)
    }).parse(req.query);
    const result = await service.getMyLogs({ storeId, tenantId: req.tenantId!, ...params });
    res.json(ok(result));
  }),
};

// 扁平导出：routes 层引用的名称
export const listConfigs = adminStoreControl.getConfigs;
export const getConfig = adminStoreControl.getConfig;
export const updateConfig = adminStoreControl.upsertConfig;
export const openStore = adminStoreControl.open;
export const closeStore = adminStoreControl.close;
export const suspendStore = adminStoreControl.suspend;
export const resumeStore = adminStoreControl.resume;
export const listStatusLogs = adminStoreControl.getLogs;
export const getStoreStatus = storeStoreControl.status;
export const listMyLogs = storeStoreControl.myLogs;