/**
 * R101-S2-02 组1：套餐配置契约（前端共享常量，唯一事实源）
 *
 * 与后端契约对齐（权威定义：backend/src/schemas/plan.schema.ts）：
 * - planType  → PLAN_TYPE_OPTIONS
 * - status    → PLAN_STATUS_OPTIONS
 * - 策略包    → buildPlanPolicy()（升级 / 降级 / 续费 / 扩展额度 / 限时活动），落 t_platform_config
 * - moduleAccess → 功能开关矩阵（元素为设计稿条目文案，沿用既有存量口径，不做数据迁移）
 *
 * 铁律：
 * 1) 功能开关矩阵的「总项数」由此处唯一决定 —— 页面不得写死数字（缺陷②）。
 * 2) 一律不预置勾选 / 不预置规则选项：未配置即未配置（未勾选 / 未选），
 *    禁止用前端默认值冒充「已生效配置」（凌舟裁定 R101-S2-02 护栏④）。
 * 3) 未配置的子项在 payload 中一律省略，不得写入占位值。
 */

/* ── ① 计费周期 ── */
export interface Option<T extends string = string> {
  key: T;
  label: string;
}

export const PLAN_TYPE_OPTIONS: Option[] = [
  { key: "MONTHLY", label: "月付" },
  { key: "QUARTERLY", label: "季付" },
  { key: "YEARLY", label: "年付" },
  { key: "CUSTOM", label: "自定义天数" },
];

export const PLAN_TYPE_LABELS: Record<string, string> = {
  MONTHLY: "月付",
  QUARTERLY: "季付",
  YEARLY: "年付",
  PERMANENT: "永久",
  CUSTOM: "自定义天数",
};

/** 各周期对应的默认天数（仅用于表单呈现与 CUSTOM 兜底，不写库） */
export const PLAN_TYPE_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
};

/* ── ② 套餐状态 ── */
export const PLAN_STATUS_OPTIONS: Option[] = [
  { key: "DRAFT", label: "草稿（仅平台可见）" },
  { key: "ACTIVE", label: "已上架" },
  { key: "INACTIVE", label: "停售" },
];

export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿（仅平台可见）",
  ACTIVE: "已上架",
  INACTIVE: "停售",
};

/** 列表页状态标签（简洁口径） */
export const PLAN_STATUS_TAGS: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: "草稿", cls: "tag-gy" },
  ACTIVE: { text: "上架中", cls: "tag-g" },
  INACTIVE: { text: "停售", cls: "tag-gy" },
};

/* ── ③ 升降级与续费规则 ── */
export const UPGRADE_MODE_OPTIONS: Option[] = [
  { key: "IMMEDIATE", label: "立即生效，剩余天数按天折算补差价（推荐）" },
  { key: "NEXT_CYCLE", label: "当前周期结束后生效" },
];

export const DOWNGRADE_MODE_OPTIONS: Option[] = [
  { key: "NEXT_CYCLE", label: "周期结束生效" },
  { key: "IMMEDIATE_NEXT_PRICE", label: "立即生效·下期按新价" },
];

export const RENEW_POLICY_OPTIONS: Option[] = [
  { key: "FORBID_GUIDE_UPGRADE", label: "禁止续费·引导升级" },
  { key: "ALLOW_LAST_YEAR", label: "允许续费最后一年" },
  { key: "AUTO_RECOMMEND_PLAN", label: "自动转推荐套餐" },
];

function labelOf(options: Option[], key?: string | null): string {
  if (!key) return "";
  return options.find((o) => o.key === key)?.label || key;
}

export function upgradeModeLabel(key?: string | null) {
  return labelOf(UPGRADE_MODE_OPTIONS, key);
}
export function downgradeModeLabel(key?: string | null) {
  return labelOf(DOWNGRADE_MODE_OPTIONS, key);
}
export function renewPolicyLabel(key?: string | null) {
  return labelOf(RENEW_POLICY_OPTIONS, key);
}

/* ── ④ 功能开关矩阵（设计稿 5 组 / 23 项，总项数唯一事实源） ── */
export interface FeatureItem {
  /** 设计稿条目文案，同时作为 moduleAccess 的存储值（沿用存量口径） */
  name: string;
  /** v1.1 修订标记 */
  v11?: boolean;
  /** 付费专属能力（免费版锁定不可选） */
  paidOnly?: boolean;
}

export interface FeatureGroup {
  name: string;
  items: FeatureItem[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: "进销存核心",
    items: [
      { name: "采购管理" },
      { name: "销售管理" },
      { name: "库存/盘点/调拨" },
      { name: "成本核算" },
      { name: "审批流（多级审核）" },
      { name: "送货单签收" },
    ],
  },
  {
    name: "多仓库 / 多计量单位",
    items: [
      { name: "多仓库" },
      { name: "多单位换算" },
      { name: "多级批发价" },
      { name: "客户等级价" },
    ],
  },
  {
    name: "会员营销",
    items: [{ name: "会员储值" }, { name: "积分体系" }, { name: "会员价/券" }],
  },
  {
    name: "小程序商城",
    items: [
      { name: "线上选品下单" },
      { name: "优惠券领取核销" },
      { name: "即时零售对接" },
      { name: "分销裂变" },
    ],
  },
  {
    name: "API / 报表 / AI",
    items: [
      { name: "开放平台 API" },
      { name: "标准报表" },
      { name: "自定义报表" },
      { name: "AI 助手（增强）" },
      { name: "数据批量导出" },
      { name: "自定义AI模型接入", v11: true, paidOnly: true },
    ],
  },
];

/** 功能开关总项数（唯一事实源：页面显示 x / TOTAL 项，禁止写死） */
export const TOTAL_FEATURE_COUNT = FEATURE_GROUPS.reduce(
  (n, g) => n + g.items.length,
  0
);

/** 扁平化的全部开关条目名（用于校验 moduleAccess 合法性） */
export const ALL_FEATURE_NAMES: string[] = FEATURE_GROUPS.flatMap((g) =>
  g.items.map((it) => it.name)
);

/* ── ⑤ 套餐策略包（护栏③：带 version；未配置子项省略） ──
 * ⚠️ 该包不写 t_subscription_plan.features 列：
 *    features 列语义为「功能特性码数组」且被公开端点 listPublicPlans() 原样透出，
 *    塞入内部配额/策略会泄露给未鉴权调用方。
 *    落库位置：t_platform_config（config_key='plan_policy:<planId>'），见 plan-policy.service.ts。
 */
export interface PlanPolicy {
  version: number;
  quota?: { apiDaily?: number; aiMonthly?: number };
  upgrade?: { mode: string };
  downgrade?: { mode: string };
  renew?: { policy: string };
  promo?: { price?: number; start?: string; end?: string };
}

export interface PlanFeaturesInput {
  apiQuota?: number | null;
  aiQuota?: number | null;
  upgradeMode?: string | null;
  downgradeMode?: string | null;
  renewPolicy?: string | null;
  promoPrice?: number | null;
  promoStart?: string | null;
  promoEnd?: string | null;
}

/** 由表单值组装策略包：未配置的子项一律不出现（禁止占位值） */
export function buildPlanPolicy(input: PlanFeaturesInput): PlanPolicy {
  const features: PlanPolicy = { version: 1 };

  const quota: { apiDaily?: number; aiMonthly?: number } = {};
  if (input.apiQuota !== null && input.apiQuota !== undefined && input.apiQuota !== ("" as unknown as number)) {
    quota.apiDaily = Number(input.apiQuota);
  }
  if (input.aiQuota !== null && input.aiQuota !== undefined && input.aiQuota !== ("" as unknown as number)) {
    quota.aiMonthly = Number(input.aiQuota);
  }
  if (quota.apiDaily !== undefined || quota.aiMonthly !== undefined) features.quota = quota;

  if (input.upgradeMode) features.upgrade = { mode: input.upgradeMode };
  if (input.downgradeMode) features.downgrade = { mode: input.downgradeMode };
  if (input.renewPolicy) features.renew = { policy: input.renewPolicy };

  const promo: { price?: number; start?: string; end?: string } = {};
  if (input.promoPrice !== null && input.promoPrice !== undefined && input.promoPrice !== ("" as unknown as number)) {
    promo.price = Number(input.promoPrice);
  }
  if (input.promoStart) promo.start = input.promoStart;
  if (input.promoEnd) promo.end = input.promoEnd;
  if (promo.price !== undefined || promo.start || promo.end) features.promo = promo;

  return features;
}
