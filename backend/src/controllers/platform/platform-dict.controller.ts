import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-dict.service";

/**
 * R101-C6-3-1：平台数据字典控制器（3 条端点，路径由派单卡钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 B②
 *   · GET /api/platform/config/data-dict                 → { items: [{ dictType, dictName, remark, status, itemCount }] }
 *   · GET /api/platform/config/data-dict/:dictType/items  → { items: [{ itemCode, itemName, sortNo, status, remark }] }
 *   · PUT /api/platform/config/data-dict/:dictType        → 整包替换该类型字典项 → { dictType, saved }
 *
 * 校验口径：zod 失败 ⇒ ZodError ⇒ 400；未知 dictType ⇒ service 抛 AppError 404；
 *   同一请求内 itemCode 重复 ⇒ service 抛 AppError 400。
 * 本控制器**不吞错**（红线⑤）。
 */

const dictTypeSchema = z
  .string({ required_error: "缺少字典类型" })
  .trim()
  .min(1, "字典类型不能为空")
  .max(32, "字典类型最长 32 字符");

const itemSchema = z.object({
  itemCode: z
    .string({ required_error: "字典项缺少 itemCode" })
    .trim()
    .min(1, "字典项编码不能为空")
    .max(64, "字典项编码最长 64 字符"),
  itemName: z
    .string({ required_error: "字典项缺少 itemName" })
    .trim()
    .min(1, "字典项名称不能为空")
    .max(64, "字典项名称最长 64 字符"),
  sortNo: z.coerce.number({ invalid_type_error: "排序号须为数字" }).int("排序号须为整数").optional(),
  status: z.string().trim().max(16, "状态最长 16 字符").optional(),
  remark: z
    .string({ invalid_type_error: "备注须为字符串或 null" })
    .trim()
    .max(255, "备注最长 255 字符")
    .nullable()
    .optional(),
});

/** 整包替换请求体：items 必须是数组（可为空数组 = 清空该类型字典项，仍幂等） */
const replaceBodySchema = z.object({
  items: z.array(itemSchema, {
    required_error: "缺少 items 字段",
    invalid_type_error: "items 必须是数组",
  }).max(500, "单次最多替换 500 条字典项"),
});

/** GET /api/platform/config/data-dict —— 已落库的字典类型列表（零预置 ⇒ 空表 ⇒ items: []） */
export async function listDictTypes(_req: any, res: any) {
  res.json(ok(await service.listDictTypes()));
}

/** GET /api/platform/config/data-dict/:dictType/items —— 该类型字典项（合法类型未落库 ⇒ items: []） */
export async function listDictItems(req: any, res: any) {
  const dictType = dictTypeSchema.parse(req.params.dictType);
  res.json(ok(await service.listDictItems(dictType)));
}

/** PUT /api/platform/config/data-dict/:dictType —— 整包替换（幂等） */
export async function replaceDictItems(req: any, res: any) {
  const dictType = dictTypeSchema.parse(req.params.dictType);
  const body = replaceBodySchema.parse(req.body ?? {});
  res.json(ok(await service.replaceDictItems(dictType, body.items)));
}
