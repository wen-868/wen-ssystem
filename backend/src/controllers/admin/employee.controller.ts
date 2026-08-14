import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as employeeService from "../../services/admin/employee.service";

export const listStaff = asyncHandler(async (req, res) => {
  const result = await employeeService.listStaff(req.user!.tenantId);
  res.json(ok(result));
});

export const createStaff = asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string(),
    realName: z.string(),
    mobile: z.string().optional(),
    roleId: z.string().optional(),
    storeId: z.number().optional(),
    departmentId: z.number().optional(),
    positionId: z.number().optional(),
    status: z.number().default(1),
    password: z.string().optional()
  }).parse(req.body);
  const result = await employeeService.createStaff(body, req.user!.tenantId);
  res.json(ok(result));
});

export const updateStaff = asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().optional(),
    realName: z.string().optional(),
    mobile: z.string().optional(),
    roleId: z.string().nullable().optional(),
    storeId: z.number().optional(),
    departmentId: z.number().nullable().optional(),
    positionId: z.number().nullable().optional(),
    status: z.number().optional()
  }).parse(req.body);
  const result = await employeeService.updateStaff(Number(req.params.staffId), body, req.user!.tenantId);
  res.json(ok(result));
});

export const disableStaff = asyncHandler(async (req, res) => {
  const result = await employeeService.disableStaff(Number(req.params.id), req.user!.tenantId);
  res.json(ok(result));
});

/** 启用/禁用员工（组织架构页） */
export const setStaffStatus = asyncHandler(async (req, res) => {
  const body = z.object({ status: z.number().min(0).max(1) }).parse(req.body || {});
  const result = await employeeService.setStaffStatus(Number(req.params.id), body.status, req.user!.tenantId);
  res.json(ok(result));
});

/** 员工复职（离职员工置回启用状态） */
export const restoreStaff = asyncHandler(async (req, res) => {
  const result = await employeeService.setStaffStatus(Number(req.params.id), 1, req.user!.tenantId);
  res.json(ok(result));
});

export const listStores = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = String(req.query.keyword || "");
  const result = await employeeService.listStores(page, pageSize, req.tenantId!, keyword);
  res.json(ok(result));
});

export const createStore = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string(),
    address: z.string(),
    lng: z.number().optional(),
    lat: z.number().optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    deliveryRadius: z.number().default(3)
  }).parse(req.body);
  const result = await employeeService.createStore(body, req.tenantId!);
  res.json(ok(result));
});

export const getStore = asyncHandler(async (req, res) => {
  const result = await employeeService.getStore(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateStore = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    status: z.number().optional(),
    longitude: z.number().optional(),
    latitude: z.number().optional()
  }).parse(req.body);
  const result = await employeeService.updateStore(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const getStoreWechatInfo = asyncHandler(async (req, res) => {
  const result = await employeeService.getStoreWechatInfo(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});
