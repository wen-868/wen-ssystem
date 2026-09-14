/**
 * R101-S2-02 组2：账单类（04 账单计费）契约校验
 *
 * 依据（文档：docs/配置项契约登记表.md §六 组2；设计稿 v1.6 第 809 行）：
 * - 欠费处理策略（全局）：4 段边界（绝对截止天数 15/30/60/90）、提醒节点、推送通道、四个自动动作
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
 * 欠费处理策略包（4 段边界，绝对截止天数）
 * 依据设计稿 v1.6 第 809 行时间线：
 *   宽限期(全功能) → 功能降级·只读 → 冻结·仅可导出 → 保留期 → 注销清除
 * 四段边界以「欠费起始日 D+0」起算的绝对截止天数表示：
 *   - graceEndDays  宽限截止（D+1~D+graceEndDays 全功能）
 *   - degradeEndDays 降级截止（D+graceEndDays+1~D+degradeEndDays 只读）
 *   - freezeEndDays  冻结截止（D+degradeEndDays+1~D+freezeEndDays 仅可导出）
 *   - retainEndDays  保留截止（D+freezeEndDays+1~D+retainEndDays 保留期；之后转人工注销）
 * 取代旧「间隔」语义字段 graceDays / freezeAfterDays / retainDays（已废弃：真库尚未落库、
 * S2-02 处于「待取证」、无存量数据；若日后发现存量含旧字段，读取时一律忽略，不自动推算、
 * 不回落任何默认天数）。
 * - remindNodes：到期前提醒节点（天），如 [7,3,1] → 界面渲染「提前 7 / 3 / 1 天」
 * - channels：推送通道，白名单枚举（防脏值）
 * - autoDowngrade / autoFreeze / autoRemind / autoCancel：四个自动动作
 * 全部 optional：未配置即省略；`undefined`=未配置 ≠ `false`=已配置为关闭（护栏④）。
 * 严格递增：宽限截止 < 降级截止 < 冻结截止 < 保留截止（仅相邻两段均配置时才校验）。
 */
export const arrearsPolicySchema = z
  .object({
    version: z.number().int().positive().default(1),
    graceEndDays: z.number().int().min(0).optional(),
    degradeEndDays: z.number().int().min(0).optional(),
    freezeEndDays: z.number().int().min(0).optional(),
    retainEndDays: z.number().int().min(0).optional(),
    remindNodes: z.array(z.number().int().min(0)).optional(),
    channels: z.array(z.enum(REMIND_CHANNELS)).optional(),
    autoDowngrade: z.boolean().optional(),
    autoFreeze: z.boolean().optional(),
    autoRemind: z.boolean().optional(),
    autoCancel: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    type Pair = {
      firstVal: number | null | undefined;
      secondVal: number | null | undefined;
      firstLabel: string;
      secondLabel: string;
      secondField: "degradeEndDays" | "freezeEndDays" | "retainEndDays";
    };
    const pairs: Pair[] = [
      { firstVal: val.graceEndDays, secondVal: val.degradeEndDays, firstLabel: "宽限截止", secondLabel: "降级截止", secondField: "degradeEndDays" },
      { firstVal: val.degradeEndDays, secondVal: val.freezeEndDays, firstLabel: "降级截止", secondLabel: "冻结截止", secondField: "freezeEndDays" },
      { firstVal: val.freezeEndDays, secondVal: val.retainEndDays, firstLabel: "冻结截止", secondLabel: "保留截止", secondField: "retainEndDays" },
    ];
    for (const p of pairs) {
      // 只有相邻两段都非 null/undefined 时才校验严格递增
      if (p.firstVal != null && p.secondVal != null && p.firstVal >= p.secondVal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [p.secondField],
          message: `时间线截止天数必须严格递增：${p.firstLabel} ${p.firstVal} 必须小于 ${p.secondLabel} ${p.secondVal}`,
        });
      }
    }
  });

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

/** 可被前端配置的顶层键（用于生成 _unconfigured 元字段，顺序即前端展示顺序） */
export const ARREARS_POLICY_KEYS = [
  "graceEndDays",
  "degradeEndDays",
  "freezeEndDays",
  "retainEndDays",
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
