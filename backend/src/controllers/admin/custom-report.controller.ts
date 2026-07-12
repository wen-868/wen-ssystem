import { z } from "zod";
import { ok } from "../../shared/response";
import * as reportService from "../../services/admin/custom-report.service";

// ==================== 模板 ====================

/** 模板列表 */
export async function listTemplates(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await reportService.listTemplates(tenantId, params);
  res.json(ok(result));
}

/** 创建模板 */
export async function createTemplate(req: any, res: any) {
  const tenantId = req.tenantId!;
  const data = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    config: z.any(),
    description: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.createTemplate(tenantId, data);
  res.json(ok(result));
}

/** 更新模板 */
export async function updateTemplate(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    config: z.any().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.updateTemplate(tenantId, id, data);
  res.json(ok(result));
}

/** 删除模板 */
export async function deleteTemplate(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reportService.deleteTemplate(tenantId, id);
  res.json(ok(result));
}

/** 执行模板 */
export async function executeTemplate(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const params = z.object({
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.executeTemplate(tenantId, id, params);
  res.json(ok(result));
}

// ==================== 定时任务 ====================

/** 定时任务列表 */
export async function listSchedules(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await reportService.listSchedules(tenantId, params);
  res.json(ok(result));
}

/** 创建定时任务 */
export async function createSchedule(req: any, res: any) {
  const tenantId = req.tenantId!;
  const data = z.object({
    name: z.string().min(1),
    templateId: z.number().int().positive(),
    cronExpression: z.string().min(1),
    exportFormat: z.string().min(1),
    recipients: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.createSchedule(tenantId, data);
  res.json(ok(result));
}

/** 更新定时任务 */
export async function updateSchedule(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    name: z.string().optional(),
    templateId: z.number().int().positive().optional(),
    cronExpression: z.string().optional(),
    exportFormat: z.string().optional(),
    recipients: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.updateSchedule(tenantId, id, data);
  res.json(ok(result));
}

/** 删除定时任务 */
export async function deleteSchedule(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reportService.deleteSchedule(tenantId, id);
  res.json(ok(result));
}

/** 切换定时任务状态 */
export async function toggleSchedule(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { status } = z.object({ status: z.enum(["active", "paused"]) }).parse(req.body);
  const result = await reportService.toggleSchedule(tenantId, id, status);
  res.json(ok(result));
}

/** 立即执行定时任务 */
export async function runSchedule(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reportService.runSchedule(tenantId, id);
  res.json(ok(result));
}
