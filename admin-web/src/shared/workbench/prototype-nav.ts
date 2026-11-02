/**
 * 工作台 UI/UX 原型真相源（WORKBENCH-10 · UIUX 对齐）
 *
 * 数据来源：**Playwright 真实加载原型后的运行态 DOM**，不是人工抄写。
 * - 原型：`D:\Users\ZXQL\ZXQL-WORK\projects\ai\design\智享全链_工作台电脑端_UI原型_融合版.html`
 * - 原型 SHA256：`6A2724A6…C30C51`
 * - 抽取脚本：`projects/ms/evidence/WORKBENCH-10/tools/probe-modules.cjs`
 * - 抽取证据：`projects/ms/evidence/WORKBENCH-10/raw/12-prototype-modules.txt`
 * - 测试夹具：`admin-web/tests/fixtures/workbench-prototype-rail.json`（同一份数据副本）
 *
 * 设计口径：
 * 1. 本表只声明「原型长什么样」（名称、顺序、数量、布局度量），**不声明谁能看**；
 *    谁看得见仍由路由 meta.roles 派生（沿用 WORKBENCH-08/09 同一条真相链）。
 * 2. 二级目录是**原型的 UI 结构清单**，不是现有 manifest 的别名。原型有、manifest 未接线的项，
 *    由 `planPrototypeSubnav()` 标记为「待接入」，**不得静默丢弃**（派单卡 §六）。
 * 3. 数字只来自原型实测，不使用随机数或演示值填充。
 */
import type { ManifestItem } from "./types";

/** 一级导航项的语义分类 */
export type RailItemKind = "desk" | "module" | "settings";

export interface RailPrototypeItem {
  /** 稳定键（与 groupCode 解耦，便于以后重排/改名） */
  key: string;
  /** 原型 rail 上显示的文字（实测值） */
  label: string;
  /** 原型 title 属性（实测值） */
  title: string;
  /** 对应既有 route manifest 组；settings 为 null */
  groupCode: string | null;
  kind: RailItemKind;
}

/**
 * 原型 rail 一级导航（实测 13 项，顺序即原型顺序）。
 * 组成：工作台(1) + 11 个一级业务模块 + 设置(1)。
 *
 * 口径说明：派单卡 §四-A-1 记为「工作台 + 12 个一级业务模块」，是把「设置」计入业务模块；
 * 按 DOM 实测枚举为 工作台 + 11 业务 + 设置。两种口径下 **rail 可见项总数同为 13**，
 * 本表以实测 DOM 为准，差异在回传卡显式报备。
 */
export const PROTOTYPE_RAIL_ITEMS: readonly RailPrototypeItem[] = [
  { key: "desk", label: "工作台", title: "工作台 · 信息流", groupCode: "wb.dashboard", kind: "desk" },
  { key: "sales", label: "销售管理", title: "销售管理", groupCode: "wb.sales", kind: "module" },
  { key: "order", label: "订单管理", title: "订单管理", groupCode: "wb.order", kind: "module" },
  { key: "purchase", label: "采购管理", title: "采购管理", groupCode: "wb.purchase", kind: "module" },
  { key: "inventory", label: "库存管理", title: "库存管理", groupCode: "wb.inventory", kind: "module" },
  { key: "customer", label: "客户管理", title: "客户管理", groupCode: "wb.customer", kind: "module" },
  { key: "product", label: "商品中心", title: "商品中心", groupCode: "wb.product", kind: "module" },
  { key: "instant-retail", label: "即时零售", title: "即时零售", groupCode: "wb.instant-retail", kind: "module" },
  { key: "finance", label: "财务管理", title: "财务管理", groupCode: "wb.finance", kind: "module" },
  { key: "report", label: "数据报表", title: "数据报表", groupCode: "wb.report", kind: "module" },
  { key: "marketing", label: "营销推广", title: "营销推广", groupCode: "wb.marketing", kind: "module" },
  { key: "system", label: "系统管理", title: "系统管理", groupCode: "wb.system", kind: "module" },
  { key: "settings", label: "设置", title: "系统设置", groupCode: null, kind: "settings" },
];

/** rail 可见项总数（原型实测） */
export const PROTOTYPE_RAIL_COUNT = 13;

/** 其中「工作台与设置之外」的一级业务模块数量 */
export const PROTOTYPE_BUSINESS_MODULE_COUNT = 11;

/** 一级业务模块 key（工作台/设置除外），按原型顺序 */
export const PROTOTYPE_BUSINESS_KEYS: readonly string[] = PROTOTYPE_RAIL_ITEMS.filter(
  (item) => item.kind === "module",
).map((item) => item.key);

/**
 * 固定 rail 项（工作台 / 设置）占用的分组码 → rail 键。
 *
 * 为什么需要：`MANUAL_GROUPS` 里有一组 `groupCode: "wb.dashboard"`，其唯一条目路径就是 `/dashboard`。
 * rail 结构按角色派生（不吃菜单桥交集）后，路由反推归属会在 `/dashboard` 上命中这一组，
 * 于是 railKey 变成 `"wb.dashboard"` —— 而 rail 上**没有**这个键的节点（工作台是固定的 `desk` 位），
 * 结果 12 项全都不高亮（原型默认可见项「工作台」是实心蓝选中态）。这里把固定组的码映射回固定键，
 * 选中态判定与 rail 渲染口径就重新一致了；业务模块仍原样返回自己的 groupCode。
 */
export const RAIL_FIXED_KEY_BY_GROUP: Readonly<Record<string, string>> = Object.fromEntries(
  PROTOTYPE_RAIL_ITEMS.filter(
    (item): item is RailPrototypeItem & { groupCode: string } => item.kind !== "module" && item.groupCode !== null,
  ).map((item) => [item.groupCode, item.key]),
);

/**
 * 原型第二栏二级目录（实测：点击一级模块后 .sub-grid 渲染的 .sub-card 文字）。
 * 「工作台」项下为原型「常用功能」六宫格。
 */
export const PROTOTYPE_SUBCATALOG: Readonly<Record<string, readonly string[]>> = {
  desk: ["建销售单", "库存查询", "销售汇总", "今日晨报", "批量对账", "打印模板"],
  sales: ["销售开单", "销售单据", "销售退货", "收款管理", "收款关联", "提成管理", "销售报表"],
  order: ["订单列表", "订单看板", "订单超时", "订单中心", "批发订单确认"],
  purchase: ["采购订单", "采购入库", "采购退货", "采购合同", "供应商对账", "采购计划", "采购付款", "供应商管理"],
  inventory: [
    "库存列表",
    "库存盘点",
    "库存调拨",
    "库存批次",
    "批量调价",
    "报价管理",
    "库存预警",
    "库存成本",
    "追溯查询",
    "效期预警",
    "召回管理",
    "库存报表",
  ],
  customer: ["客户管理", "客户类型", "信用管理", "会员体系", "客户运营"],
  product: ["商品管理", "分类管理", "品牌管理", "单位管理", "标签体系", "商品审核", "套装与组合品", "价格管理"],
  "instant-retail": [
    "平台配置",
    "平台管理",
    "商品上架",
    "平台订单",
    "平台对账",
    "配送管理",
    "库存同步",
    "平台公告",
    "零售看板",
  ],
  finance: [
    "收付款",
    "回款管理",
    "客户对账",
    "利润核算",
    "费用管理",
    "财务对账",
    "银行账户",
    "票据管理",
    "单据管理",
    "分账与结算",
    "财务看板",
  ],
  report: ["报表中心", "客户分析"],
  marketing: [
    "营销活动",
    "优惠券",
    "限时折扣",
    "赠品规则",
    "积分商城",
    "营销标签",
    "营销素材",
    "营销看板",
    "售后管理",
    "拼团活动",
    "ROI 分析",
  ],
  system: [
    "组织人事",
    "权限管理",
    "审批中心",
    "日志中心",
    "系统监控",
    "反馈管理",
    "设备管理",
    "AI 主管视图",
    "AI 播报中心",
  ],
  /**
   * 设置：原型实测点击「设置」后，第二栏 heading 仍为「常用功能」、内容仍为那 6 项
   * （证据 `raw/12-prototype-modules.txt` 第 12 行：heading=常用功能 / 二级目录数=6）。
   *
   * 即原型**没有**「设置专属二级目录」，点击后第二栏不发生切换。故此处登记为空，
   * 渲染时由 `resolveSubnavCatalogKey()` 回落到 desk 的「常用功能」，与原型一致。
   * 设置本体属于第四阶段范围，本阶段不臆造其目录。
   */
  settings: [],
};

/**
 * 解析某个 rail 项实际应展示的二级目录。
 * 「设置」无专属目录 ⇒ 回落到 desk 的「常用功能」（原型实测行为，见上方注释）。
 */
export function resolveSubnavCatalogKey(railKey: string | null | undefined): string {
  if (!railKey) return "desk";
  const own = PROTOTYPE_SUBCATALOG[railKey];
  return own && own.length > 0 ? railKey : "desk";
}

/** 第二列布局度量（1440 视口实测，单位 px） */
export const PROTOTYPE_METRICS = {
  /** 最左一级 rail 宽 */
  railWidth: 60,
  /** 第二栏展开宽 */
  sideWidth: 230,
  /** 第二栏折叠后宽（实测 56，不是 0——折叠态仍保留可见条） */
  sideCollapsedWidth: 56,
  /** 1440 视口下主面宽 */
  mainWidth: 1150,
} as const;

/**
 * 原型第二栏**标题行**文案（实测 `.qk-t` / 模块切换后 heading 文字）。
 *
 * 注意：标题 ≠ rail 项名。原型一级叫「销售管理」，其第二栏标题是「销售」。
 * 「设置」行标题实测仍为「常用功能」，与 `settings` 回落 desk 的行为互相印证。
 */
export const PROTOTYPE_SUBNAV_HEADS: Readonly<Record<string, string>> = {
  desk: "常用功能",
  sales: "销售",
  order: "订单",
  purchase: "采购",
  inventory: "库存",
  customer: "客户",
  product: "商品中心",
  "instant-retail": "即时零售",
  finance: "财务",
  report: "数据报表",
  marketing: "营销推广",
  system: "系统",
  settings: "常用功能",
};

/** 取第二栏标题；未知 key 回落「常用功能」（fail-closed 到中性值，不显示 undefined） */
export function subnavHead(railKey: string | null | undefined): string {
  if (!railKey) return PROTOTYPE_COMMON_LABEL;
  return PROTOTYPE_SUBNAV_HEADS[railKey] ?? PROTOTYPE_COMMON_LABEL;
}

/** 原型第二栏「常用功能」标题 */
export const PROTOTYPE_COMMON_LABEL = "常用功能";

/**
 * 原型第二栏数字员工部门分组（实测 .al-v14-hd 文字与其后计数）。
 * 9 组，共 15 名员工。分组最后一组为「历史会话」。
 */
export const PROTOTYPE_STAFF_GROUPS: readonly { name: string; count: number }[] = [
  { name: "总经办", count: 1 },
  { name: "订单管理", count: 2 },
  { name: "财务", count: 3 },
  { name: "库存管理", count: 2 },
  { name: "客户管理", count: 2 },
  { name: "商品中心", count: 2 },
  { name: "营销推广", count: 1 },
  { name: "履约配送", count: 1 },
  { name: "历史会话", count: 1 },
];

/**
 * 原型顶栏模式胶囊（工作台 ⇄ 收银台）
 *
 * ⚠️ **实测未决项（诚实留痕，不在本阶段冒充已对齐）**：
 * `raw/12-prototype-modules.txt` 末段显示——切到「收银台」后 `pos-wrap` 可见（正确）；
 * 但再点回「工作台」时，探针读到 `msOn` 仍为收银台激活、`pos-wrap` 仍可见。
 * 两种可能：(a) 原型自身缺陷（回切未复位视图）；(b) 探针点击后未等待过渡动画即取值。
 * **结论待第四阶段复测定性**，本阶段不写代码掩盖、也不假装已双向可用。
 */
export const PROTOTYPE_MODES: readonly string[] = ["工作台", "收银台"];

/** 第二栏双入口开关（员工 / 对话） */
export const PROTOTYPE_SIDE_TABS: readonly string[] = ["员工", "对话"];

// ═══════════════════════════════════════════════════════════════════════════
// 第二栏渲染计划：原型结构 × 现有 manifest
// ═══════════════════════════════════════════════════════════════════════════

export type SubnavEntryStatus = "wired" | "pending";

export interface SubnavPlanEntry {
  /** 原型二级目录名称（唯一真相，UI 上显示的永远是这个） */
  label: string;
  status: SubnavEntryStatus;
  /** status=wired 时的 manifest 项；pending 时为 null */
  item: ManifestItem | null;
}

/**
 * 把「原型二级目录」与「现有 manifest 已接线项」按名称逐字对齐：
 * - 命中 ⇒ `wired`，可点击、走既有打开链路；
 * - 未命中 ⇒ `pending`，**仍渲染**但不可点击并标注「待接入」，不静默丢弃。
 *
 * 理由：原型结构是 UIUX 契约，manifest 是接线现状；两者不同构时若只按 manifest 渲染，
 * 等于「以现有接口没有字段为由删掉原型结构」（§六明令禁止）。
 */
export function planPrototypeSubnav(
  moduleKey: string,
  manifestItems: readonly ManifestItem[],
): SubnavPlanEntry[] {
  const labels = PROTOTYPE_SUBCATALOG[resolveSubnavCatalogKey(moduleKey)] ?? [];
  const remaining = [...manifestItems];
  return labels.map((label) => {
    const hit = remaining.findIndex((entry) => entry.title === label);
    if (hit < 0) return { label, status: "pending", item: null };
    const [item] = remaining.splice(hit, 1);
    return { label, status: "wired", item };
  });
}

/** 统计某个模块的接线覆盖率（供 UI 标注与测试断言，不用演示数字填充） */
export function wiringRatio(moduleKey: string, manifestItems: readonly ManifestItem[]): { wired: number; total: number } {
  const plan = planPrototypeSubnav(moduleKey, manifestItems);
  return { wired: plan.filter((entry) => entry.status === "wired").length, total: plan.length };
}

/** 给「现有分组」贴上原型文案后的 rail 渲染行（扁平结构，便于模板直接取 groupCode） */
export type PrototypeDecorated<T> = T & {
  /** 原型 rail 项稳定键；原型未声明的分组为 `+<groupCode>` */
  protoKey: string;
  protoLabel: string;
  protoTitle: string;
};

/**
 * 按**原型顺序**输出「现有分组 × 原型文案」的 rail 渲染行。
 *
 * 三条口径：
 * 1. 只输出原型声明过的一级**业务模块**（kind=module 且有 groupCode）；
 *    desk / settings 各行其路由由调用方单独渲染，不进本列表。
 * 2. 分组当前不可见（无对应 groupCode）⇒ 整块不渲染。可见性仍归 `meta.roles` 派生
 *    （沿用 WORKBENCH-08/09 真相链），**本函数不做任何权限判断**。
 * 3. manifest 有而原型未声明的剩余分组 ⇒ **追加到尾部**、protoKey 冠 `+` 前缀，
 *    保证任何现存入口都不会因「原型没写」而被静默丢弃（派单卡 §六明令禁止）。
 *    标签回落 `group.title`，**绝不把 groupCode 暴露到 UI**（运行态取证实测发现
 *    `wb.dashboard` 曾以分组码形态出现在 rail 文案里，属于不可读缺陷，已修）。
 *
 * 4. 已被**固定项**占用的分组（desk→wb.dashboard、settings→无分组）不再重复渲染一个
 *    rail 项：否则「工作台」会在 rail 里出现两次（运行态取证实测发现）。
 *
 * 注：manifest 原文件顺序（dashboard/order/sales/product/…）与原型顺序（sales/order/purchase/…）
 * **不一致**，这正是必须先由真相源定序、再按角色裁剪的原因。
 */
export function decorateRailGroups<T extends { groupCode: string; title?: string }>(
  visible: readonly T[],
): PrototypeDecorated<T>[] {
  /** 固定 rail 项（desk/settings）已占用的分组码：不得再作为业务模块重复渲染 */
  const fixedCodes = new Set(
    PROTOTYPE_RAIL_ITEMS.filter((item) => item.kind !== "module" && item.groupCode).map(
      (item) => item.groupCode as string,
    ),
  );
  const remaining = new Map(visible.map((group) => [group.groupCode, group]));
  const rows: PrototypeDecorated<T>[] = [];
  for (const proto of PROTOTYPE_RAIL_ITEMS) {
    if (proto.kind !== "module" || !proto.groupCode) continue;
    const group = remaining.get(proto.groupCode);
    if (!group) continue;
    remaining.delete(proto.groupCode);
    rows.push({ ...group, protoKey: proto.key, protoLabel: proto.label, protoTitle: proto.title });
  }
  for (const [code, group] of remaining) {
    if (fixedCodes.has(code)) continue; // 固定项已承载，避免重复 rail 项
    const label = group.title || code;
    rows.push({ ...group, protoKey: `+${code}`, protoLabel: label, protoTitle: label });
  }
  return rows;
}

/** 按 railKey 取原型项；未知 key 返回 null（fail-closed 的第一步） */
export function findRailItem(key: string | null | undefined): RailPrototypeItem | null {
  if (!key) return null;
  return PROTOTYPE_RAIL_ITEMS.find((item) => item.key === key) ?? null;
}

/**
 * 一级 rail 的选中态切换语义（原型 §动态交互 1/2）：
 * - 点击未选中的模块 ⇒ 选中它，第二栏切成该模块二级目录；
 * - 再次点击已选中的模块 ⇒ **取消选中**，第二栏恢复「常用功能」。
 */
export function toggleRailSelection(selected: string | null, clicked: string): string | null {
  return selected === clicked ? null : clicked;
}
