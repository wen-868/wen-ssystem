/**
 * R101-S2-02 组1：套餐（t_subscription_plan）契约校验
 *
 * 依据（文档：docs/配置项契约登记表.md 组1）：
 * - plan_type  VARCHAR(32) → MONTHLY / QUARTERLY / YEARLY / PERMANENT / CUSTOM
 * - status     VARCHAR(16) → DRAFT / ACTIVE / INACTIVE
 * - features   JSON        → 功能特性码数组（生产既有语义，禁止改作配置包）
 *
 * ⚠️ features 列不可复用作「配置包」容器，两条硬理由：
 *   1. 生产种子数据即字符串数组（docs/migrations/016_phase9_tenant_subscription.sql:172
 *      '["basic_sales","basic_inventory","basic_report"]'），语义是「功能特性列表」；
 *   2. 公开端点 listPublicPlans()（backend/src/services/platform-miniapp.service.ts:139）
 *      原样透出 features 供对外展示，塞入内部配额/策略会泄露给未鉴权调用方。
 *   → 无结构化列承载的策略项改落 t_platform_config（见 planPolicySchema）。
 *
 * 护栏③（凌舟裁定 R101-S2-02）：JSON 包必须带 version 并由 zod 校验；
 * 未配置的子项一律省略（不写默认值），前端据此区分「未配置」并置灰阻断。
 */
import { z } from "zod";

/** 套餐类型（设计稿 chips：月付 / 季付 / 年付 / 自定义天数） */
export const PLAN_TYPES = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "PERMANENT",
  "CUSTOM",
] as const;

/** 套餐状态（DRAFT=草稿仅平台可见 / ACTIVE=已上架 / INACTIVE=停售） */
export const PLAN_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

/** 升级生效方式 */
export const UPGRADE_MODES = ["IMMEDIATE", "NEXT_CYCLE"] as const;

/** 降级生效方式 */
export const DOWNGRADE_MODES = ["NEXT_CYCLE", "IMMEDIATE_NEXT_PRICE"] as const;

/** 停售后存量租户续费策略 */
export const RENEW_POLICIES = [
  "FORBID_GUIDE_UPGRADE",
  "ALLOW_LAST_YEAR",
  "AUTO_RECOMMEND_PLAN",
] as const;

/**
 * features 列：功能特性码数组（生产真实形态）。
 * 例：["basic_sales","basic_inventory","basic_report"]
 * 对外可见，禁止写入内部配额 / 价格策略 / 通道密钥等敏感或未公开信息。
 */
export const planFeaturesSchema = z.array(z.string());

/**
 * 套餐策略 JSON 包：承载「无结构化列」的组1配置项（零新建表）。
 * 落库位置：t_platform_config
 *   platform = 'SAAS'，tenant_id = 'platform'，config_key = 'plan_policy:<planId>'
 *   （复用 R97-01 平台级整包 JSON 行约定，与 saas_settings 同表同约定）
 *
 * - version：包版本号（护栏③强制）
 * - quota：结构化配额列之外的扩展额度（apiDaily=API 日额度、aiMonthly=AI 月额度）
 * - upgrade / downgrade / renew：升降级与续费规则
 * - promo：限时活动（price / start / end）
 * 全部子项 optional：未配置即省略，禁止用默认值冒充「已配置」（护栏④）。
 * passthrough：容忍后续新增键，避免历史数据在升级期被拒。
 */
export const planPolicySchema = z
  .object({
    version: z.number().int().positive().default(1),
    quota: z
      .object({
        apiDaily: z.number().int().min(0).optional(),
        aiMonthly: z.number().int().min(0).optional(),
      })
      .passthrough()
      .optional(),
    upgrade: z.object({ mode: z.enum(UPGRADE_MODES) }).passthrough().optional(),
    downgrade: z.object({ mode: z.enum(DOWNGRADE_MODES) }).passthrough().optional(),
    renew: z.object({ policy: z.enum(RENEW_POLICIES) }).passthrough().optional(),
    promo: z
      .object({
        price: z.number().min(0).optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PlanPolicy = z.infer<typeof planPolicySchema>;

/** 策略包中「可被前端配置」的键（用于生成 _unconfigured 元字段） */
export const PLAN_POLICY_KEYS = ["quota", "upgrade", "downgrade", "renew", "promo"] as const;
