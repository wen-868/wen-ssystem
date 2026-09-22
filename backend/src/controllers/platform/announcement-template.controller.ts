import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/announcement-template.service";

/**
 * C2-0 实现段：公告模板清单控制器（路由挂在既有 /api/platform/announcements 下）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §三（端点 #11/#12）。
 * 落库走 t_platform_config（0 DDL，config_key='announcement:templates'）。
 */

const templateRecordsSchema = z
  .array(
    z.object({
      code: z.string().trim().min(1).max(64),
      name: z.string().trim().min(1).max(64),
      content: z.string().min(1),
    })
  )
  .max(50)
  .superRefine((records, ctx) => {
    const seen = new Set<string>();
    records.forEach((item, index) => {
      if (seen.has(item.code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "code"],
          message: `模板编码重复：${item.code}`,
        });
      }
      seen.add(item.code);
    });
  });

/** #11 GET /api/platform/announcements/templates */
export async function listAnnouncementTemplates(_req: any, res: any) {
  res.json(ok(await service.getAnnouncementTemplates()));
}

/** #12 PUT /api/platform/announcements/templates（整包覆盖保存） */
export async function saveAnnouncementTemplates(req: any, res: any) {
  const body = z.object({ records: templateRecordsSchema }).parse(req.body ?? {});
  const operator = String(req.user?.username || req.user?.realName || "platform_admin");
  res.json(ok(await service.saveAnnouncementTemplates(body.records, operator)));
}
