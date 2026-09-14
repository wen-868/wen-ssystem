/**
 * R101-S2-02 组2：账单类（04 账单计费）契约校验
 *
 * 依据（文档：docs/配置项契约登记表.md §六 组2）：
 * - 欠费处理策略（全局）：宽限期天数、冻结后保留期、提醒节点、推送通道、四个自动动作
 * - 增值服务单价：存储超额 / API 超额 / 短信超量
 *
 * ⚠️ 这两组值此前在前端是**硬编码业务值**（`Reconciliation.vue:424-433` 的 graceDays:15 /
 * retainDays:90，`:297` 的 ¥10/GB/月 · ¥50/万次 · ¥0.10/条），属「禁模拟数据」违规。
 * 落库后一律由平台管理员配置，**系统不内置任何预设业务值**（护栏④）。
 *
 * 护栏③：JSON 包必须带 version 并由 zod 校验；
 * 护栏④：未配置的子项一律省略（不写默认值），前端据此区分「未配置」并置灰阻断。
 */
import { z } from "zod";

/** 催缴推送通道白名单（与 08 系统配置的短信/邮件通道开关对应） */
export const REMIND_CHANNELS = ["IN_APP", "SMS", "EMAIL", "WECHAT"] as const;

/**
 * 欠费处理策略包
 * - graceDays / retainDays：天数，≥0
 * - remindNodes：到期前提醒节点（天），如 [7,3,1] → 界面渲染「提前 7 / 3 / 1 天」
 * - channels：推送通道，白名单枚举（防脏值）
 * - autoDowngrade / autoFreeze / autoRemind / autoCancel：四个自动动作
 * 全部 optional：未配置即省略；`undefined`=未配置 ≠ `false`=已配置为关闭（护栏④）。
 */
export const arrearsPolicySchema = z
  .object({
    version: z.number().int().positive().default(1),
    graceDays: z.number().int().min(0).optional(),
    freezeAfterDays: z.number().int().min(0).optional(),
    retainDays: z.number().int().min(0).optional(),
    remindNodes: z.array(z.number().int().min(0)).optional(),
    channels: z.array(z.enum(REMIND_CHANNELS)).optional(),
    autoDowngrade: z.boolean().optional(),
    autoFreeze: z.boolean().optional(),
    autoRemind: z.boolean().optional(),
    autoCancel: z.boolean().optional(),
  })
  .passthrough();

/**
 * 增值服务单价包（单位固定，界面标注；数值由管理员配置）
 * - storagePerGbMonth：元 / GB / 月
 * - apiPer10k：元 / 万次
 * - smsPerItem：元 / 条
 */
export const addonPriceSchema = z
  .object({
    version: z.number().int().positive().default(1),
    storagePerGbMonth: z.number().min(0).optional(),
    apiPer10k: z.number().min(0).optional(),
    smsPerItem: z.number().min(0).optional(),
  })
  .passthrough();

/** 可被前端配置的顶层键（用于生成 _unconfigured 元字段） */
export const ARREARS_POLICY_KEYS = [
  "graceDays",
  "freezeAfterDays",
  "retainDays",
  "remindNodes",
  "channels",
  "autoDowngrade",
  "autoFreeze",
  "autoRemind",
  "autoCancel",
] as const;

export const ADDON_PRICE_KEYS = ["storagePerGbMonth", "apiPer10k", "smsPerItem"] as const;

export type ArrearsPolicy = z.infer<typeof arrearsPolicySchema>;
export type AddonPrice = z.infer<typeof addonPriceSchema>;
