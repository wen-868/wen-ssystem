import { z } from "zod";
import { ok } from "../../shared/response";
import { PRINT_BILL_TYPE_VALUES, PRINT_PAPER_TYPE_VALUES } from "../../services/admin/print-templates";
import * as initService from "../../services/platform/platform-template.service";
import * as printService from "../../services/platform/platform-print-template.service";
import * as ioService from "../../services/platform/platform-io-template.service";

/**
 * C2-0 实现段：平台模板中心控制器（路由 prefix /api/platform/templates）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §三（端点 #1~#10）。
 * 校验口径：zod 解析失败 ⇒ 由 error-handler 统一转 400；业务冲突（编码重复 409 /
 * 资源不存在 404）由 service 抛 AppError。
 */

const idSchema = z.coerce.number().int().positive();
const billTypeSchema = z.enum(PRINT_BILL_TYPE_VALUES as [string, ...string[]]);
const paperTypeSchema = z.enum(PRINT_PAPER_TYPE_VALUES as [string, ...string[]]);
const directionSchema = z.enum(["IMPORT", "EXPORT"]);

/** 列表筛选参数：空串与 ALL 视为「全部」，其余必须命中枚举（非法值 ⇒ ZodError ⇒ 400） */
function optionalFilter(raw: unknown, schema: z.ZodTypeAny): string | undefined {
  const value = String(raw ?? "").trim();
  if (value === "" || value.toUpperCase() === "ALL") return undefined;
  return String(schema.parse(value));
}

function operatorOf(req: any): string {
  return String(req.user?.username || req.user?.realName || "platform_admin");
}

const initTemplateBody = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  applicable: z.string().trim().max(64).optional(),
  codeRule: z.string().trim().max(128).optional(),
  convertRule: z.string().trim().max(128).optional(),
  printRef: z.string().trim().max(64).optional(),
  defaultWhAccount: z.string().trim().max(128).optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
  freeAvailable: z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).optional(),
  recommended: z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).optional(),
  changeNote: z.string().trim().max(255).optional(),
});

const initTemplatePatchBody = initTemplateBody.partial().extend({
  status: z.coerce.number().int().min(0).max(1).optional(),
});

/** #1 GET /api/platform/templates/init */
export async function listInitTemplates(_req: any, res: any) {
  res.json(ok(await initService.listInitTemplates()));
}

/** #2 POST /api/platform/templates/init */
export async function createInitTemplate(req: any, res: any) {
  const body = initTemplateBody.parse(req.body ?? {});
  const result = await initService.createInitTemplate(body, operatorOf(req));
  res.status(201).json(ok(result));
}

/** #3 PUT /api/platform/templates/init/:id */
export async function updateInitTemplate(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const body = initTemplatePatchBody.parse(req.body ?? {});
  const result = await initService.updateInitTemplate(id, body, operatorOf(req));
  res.json(ok(result));
}

/** #4 GET /api/platform/templates/init/:id/versions */
export async function listInitTemplateVersions(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  res.json(ok(await initService.listTemplateVersions(id)));
}

/** #5 GET /api/platform/templates/print?billType= */
export async function listPrintTemplates(req: any, res: any) {
  const billType = optionalFilter(req.query?.billType, billTypeSchema);
  res.json(ok(await printService.listPrintTemplates(billType)));
}

/** #6 POST /api/platform/templates/print/upload */
export async function uploadPrintTemplate(req: any, res: any) {
  const body = z
    .object({
      name: z.string().trim().min(1).max(64),
      billType: billTypeSchema,
      content: z.string().min(1),
      paperType: paperTypeSchema.optional(),
      spec: z.string().trim().max(255).optional(),
    })
    .parse(req.body ?? {});
  const result = await printService.uploadPrintTemplate(body, operatorOf(req));
  res.status(201).json(ok(result));
}

/** #7 POST /api/platform/templates/print/:id/public */
export async function setPrintTemplatePublic(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  res.json(ok(await printService.setPrintTemplatePublic(id)));
}

/** #8 GET /api/platform/templates/import-export?direction= */
export async function listIoTemplates(req: any, res: any) {
  const direction = optionalFilter(req.query?.direction, directionSchema);
  res.json(ok(await ioService.listIoTemplates(direction)));
}

/** #9 POST /api/platform/templates/import-export */
export async function createIoTemplate(req: any, res: any) {
  const body = z
    .object({
      name: z.string().trim().min(1).max(64),
      direction: directionSchema,
      version: z.string().trim().max(16).optional(),
      fieldCount: z.coerce.number().int().min(0).optional(),
      compat: z.string().trim().max(128).optional(),
      fieldDesc: z.string().optional(),
      fileName: z.string().trim().max(128).optional(),
      fileContent: z.string().optional(),
    })
    .parse(req.body ?? {});
  const result = await ioService.createIoTemplate(body, operatorOf(req));
  res.status(201).json(ok(result));
}

/** #10 GET /api/platform/templates/import-export/:id/download */
export async function downloadIoTemplate(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const file = await ioService.downloadIoTemplate(id);

  // 下载端点返回原始文件内容（不走 ok() 信封）：文件名中文用 filename* 传递，ASCII 回退名兜底
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  res.send(file.content);
}
