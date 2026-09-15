/**
 * R101-S2-02 组3（AI 类）：四组配置包 zod 契约校验
 *
 * 依据（文档：docs/R101-S2-02-组3-AI类配置契约.md；设计稿 v1.6 第 899~1160 行 sec-ai）：
 * - 套餐加成倍率与月额度用尽策略（ai:billing_strategy）
 * - 免费版赠送额度（ai:free_grant）
 * - 额度包商品（ai:quota_pack）
 * - 积分抵扣汇率（ai:points_rate）
 *
 * ⚠️ 设计稿示例值（1.0x / 1.2x / 1.1x / 1.0x、50 次/月、500000 Token ¥99、1 积分=50 token）
 * 仅为设计稿示意，**不得作为默认值或种子数据写入代码与数据库**（契约第 3 节明文禁止）。
 * 系统不内置任何预设业务值（护栏④）：未配置的子项一律省略，前端据此置灰阻断。
 *
 * 护栏③：JSON 包必须带 version 并由 zod 校验；
 * 护栏④：未配置的子项一律省略（不写默认值），_ 前缀元字段（_unconfigured / _configured）
 *        为只读字段，绝不由本 schema 产出、也不得回写。
 *
 * _KEYS 仅列顶层业务键（plans / packs 为容器字段，是否含子项由前端展示层决定，
 * 容器本身出现即视为已配置）。
 */
import { z } from "zod";

/**
 * 套餐加成倍率与月额度用尽策略包
 * - plans：以 planCode / planId 为键的套餐策略映射
 *   - multiplier：加成倍率，> 0，AI 超额费用 = 模型成本单价 × 倍率
 *   - exhaustion：月度额度用尽策略（disable 停用+升级引导 / downgrade 降级至基础模型 / overage 超额计费）
 *   - downgradeModel：exhaustion=downgrade 时的降级目标模型（可空）
 *   - note：运营说明文案（可空）
 * - 超额单价不入库：overage 只表示策略类型，具体单价属 S3-03，本包不存该字段
 */
export const billingStrategySchema = z
  .object({
    version: z.number().int().positive().default(1),
    plans: z
      .record(
        z.string(),
        z.object({
          multiplier: z.number().positive(),
          exhaustion: z.enum(["disable", "downgrade", "overage"]),
          downgradeModel: z.string().optional(),
          note: z.string().optional(),
        })
      )
      .optional(),
  })
  .passthrough();

/**
 * 免费版赠送额度包
 * - monthlyCalls：每月赠送调用次数，非负整数
 * - grantModel：赠送模型标识（如 deepseek-v3，可空）
 * 注：「免费额度月初重置不累计」为固定业务规则，不做成配置项。
 */
export const freeGrantSchema = z
  .object({
    version: z.number().int().positive().default(1),
    monthlyCalls: z.number().int().min(0).optional(),
    grantModel: z.string().optional(),
  })
  .passthrough();

/**
 * 额度包商品包
 * - packs：额度包商品数组
 *   - id：商品标识
 *   - name：商品名称
 *   - tokens：额度 Token 数，正整数
 *   - price：售价（元），> 0
 *   - validMonths：有效期（月），正整数
 *   - applicablePlans：适用套餐范围，空数组 = 不限
 *   - purchaseLimit：限购数量，null = 不限
 *   - status：on_sale 在售 / off_shelf 下架
 */
export const quotaPackSchema = z
  .object({
    version: z.number().int().positive().default(1),
    packs: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          tokens: z.number().int().positive(),
          price: z.number().positive(),
          validMonths: z.number().int().positive(),
          applicablePlans: z.array(z.string()),
          purchaseLimit: z.number().int().nullable(),
          status: z.enum(["on_sale", "off_shelf"]),
        })
      )
      .optional(),
  })
  .passthrough();

/**
 * 积分抵扣汇率包
 * - points：积分面额，正整数
 * - tokens：折算 Token 数，正整数
 * - enabled：积分抵扣总开关
 * 注：「汇率调整仅对新消耗生效、不追溯」为固定规则，不做成配置项。
 */
export const pointsRateSchema = z
  .object({
    version: z.number().int().positive().default(1),
    points: z.number().int().positive().optional(),
    tokens: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

/** 可被前端配置的顶层键（用于生成 _unconfigured 元字段，顺序即前端展示顺序） */
export const BILLING_STRATEGY_KEYS = ["plans"] as const;

export const FREE_GRANT_KEYS = ["monthlyCalls", "grantModel"] as const;

export const QUOTA_PACK_KEYS = ["packs"] as const;

export const POINTS_RATE_KEYS = ["points", "tokens", "enabled"] as const;

export type BillingStrategy = z.infer<typeof billingStrategySchema>;
export type FreeGrant = z.infer<typeof freeGrantSchema>;
export type QuotaPack = z.infer<typeof quotaPackSchema>;
export type PointsRate = z.infer<typeof pointsRateSchema>;
