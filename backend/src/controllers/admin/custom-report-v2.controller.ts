import { z } from "zod";
import { ok } from "../../shared/response";
import * as reportService from "../../services/admin/custom-report-v2.service";

/** 报表列表 */
export async function listReports(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    reportType: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await reportService.listReports(tenantId, params);
  res.json(ok(result));
}

/** 创建报表 */
export async function createReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const userId = req.user?.id;
  const data = z.object({
    reportName: z.string().min(1),
    reportType: z.string().min(1),
    dataSource: z.string().min(1),
    config: z.any(),
    chartType: z.string().optional(),
    description: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.createReport(tenantId, data, userId);
  res.json(ok(result));
}

/** 报表详情 */
export async function getReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reportService.getReport(tenantId, id);
  res.json(ok(result));
}

/** 更新报表 */
export async function updateReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    reportName: z.string().optional(),
    reportType: z.string().optional(),
    dataSource: z.string().optional(),
    config: z.any().optional(),
    chartType: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.body);
  const result = await reportService.updateReport(tenantId, id, data);
  res.json(ok(result));
}

/** 删除报表 */
export async function deleteReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reportService.deleteReport(tenantId, id);
  res.json(ok(result));
}

/** 生成报表数据 */
export async function generateReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const params = z.object({
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    filters: z.any().optional(),
  }).parse(req.body || {});
  const result = await reportService.generateReport(tenantId, id, params);
  res.json(ok(result));
}

/** 导出报表 */
export async function exportReport(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const format = z.string().default("EXCEL").parse(req.query.format || req.query.exportFormat || "EXCEL");
  const params = z.object({
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    filters: z.any().optional(),
  }).parse(req.query || {});
  const result = await reportService.exportReport(tenantId, id, format, params);
  res.json(ok(result));
}
