/**
 * WORKBENCH-13-F2 · A 段（原型视觉基线）门禁逻辑（纯函数，无 IO、无网络）
 *
 * 卡 §三.A.1/§五.1 要的是「原型与实现同视口并排截图 + DOM/computed 差异表」，
 * 所以这里不比类名、不比源码字符串，只比**同一视口下两个真实渲染的读数**。
 * 原型侧与实现侧由 `f2a-visual-baseline.mjs` 在同一次浏览器运行里分别量取，
 * 本文件负责把两份读数对齐成差异表并判红。
 *
 * 为什么必须机器判红（卡 §六「不得用近似截图替代原型并排验收」）：
 * 只看两张图很容易自我说服，坐标差 8px、底色差一档、新对话还在顶部，
 * 人眼扫过去就过去了；这里逐指标算差值，超容差且没有解释 ⇒ 直接红。
 */

/** A 段只允许在桌面基准视口做并排对比（卡 §三.A.1：1440×1000 同时采集原型与实现） */
export const BASE_VIEWPORT = { id: "1440x1000", width: 1440, height: 1000 };

/** 实现侧仍需覆盖的其余视口（卡 §三.C.14：原型是桌面基准，窄屏只要求无裁切且可达） */
export const IMPL_ONLY_VIEWPORTS = [
  { id: "1024x768", width: 1024, height: 768 },
  { id: "390x844", width: 390, height: 844 },
];

/**
 * 区域契约：`key` 是同一条并排证据里的同一个部位。
 * `proto` / `impl` 是各自页面上的量取选择器；`gate` 列出卡面点名的指标。
 */
export const REGION_CONTRACT = [
  {
    key: "rail",
    label: "一级图标栏",
    proto: "nav.rail",
    impl: '[data-testid="rail"]',
    card: "§三.A.3",
    gate: ["x", "width", "height", "backgroundColor", "padding", "gap"],
  },
  {
    key: "side",
    label: "二级导航列",
    proto: "aside.side",
    impl: '[data-testid="second-nav"]',
    card: "§三.A.3",
    gate: ["x", "width", "height", "backgroundColor"],
  },
  {
    key: "main",
    label: "主区列",
    proto: ".main",
    impl: ".wb-main",
    card: "§三.A.3",
    gate: ["x", "width"],
  },
  {
    key: "top",
    label: "顶栏",
    proto: "header.top",
    impl: ".wb-top",
    card: "§三.A.3",
    gate: ["height", "padding", "borderBottomWidth", "borderBottomColor"],
  },
  {
    key: "brand",
    label: "侧栏品牌区",
    proto: ".brand-side",
    impl: ".sn-brand",
    card: "§三.A.4",
    gate: ["height", "padding", "borderBottomWidth", "borderBottomColor"],
  },
  {
    key: "subZone",
    label: "二级内容起点",
    proto: "#subZone",
    impl: '[data-testid="second-nav-sub-zone"]',
    card: "§三.A.7",
    gate: ["y"],
  },
  {
    key: "dualNote",
    label: "双入口说明块",
    proto: ".mf-dual",
    impl: '[data-testid="second-nav-dual-note"]',
    card: "§三.A.5",
    gate: ["x", "y", "width", "borderRadius", "borderStyle", "padding"],
    required: true,
  },
  {
    key: "grid",
    label: "常用功能卡网格",
    proto: ".sub-grid",
    impl: ".sn-grid",
    card: "§三.A.5",
    gate: ["y", "gap", "gridColumns"],
    required: true,
  },
  {
    key: "segBar",
    label: "员工/对话横栏",
    proto: "#alV21Sidehd",
    impl: '[data-testid="second-nav-tabs"]',
    card: "§三.A.7",
    gate: ["y", "height"],
    required: true,
  },
  {
    key: "newChat",
    label: "新对话控件",
    proto: "#newChatBtn",
    impl: '[data-testid="second-nav-new-chat"]',
    card: "§三.A.6",
    gate: ["width", "height", "borderRadius", "backgroundColor", "padding"],
    required: true,
  },
  {
    key: "search",
    label: "搜索框（默认隐藏）",
    proto: ".al-v14-search",
    impl: '[data-testid="second-nav-search"]',
    card: "§三.A.5",
    gate: ["display", "width"],
    required: true,
  },
  {
    key: "dir",
    label: "员工/会话目录",
    proto: "#sessList",
    impl: '[data-testid="second-nav-directory"]',
    card: "§三.A.7",
    gate: ["y", "padding"],
    required: true,
  },
  {
    key: "acct",
    label: "底部账号区",
    proto: "#acctZone",
    impl: '[data-testid="second-nav-account"]',
    card: "§三.A.7",
    gate: ["y", "height", "backgroundColor", "borderTopColor", "padding"],
    required: true,
  },
  {
    key: "kpis",
    label: "KPI 区",
    proto: ".wb-kpis",
    impl: ".wb-kpis",
    card: "§三.A.8",
    gate: ["gap", "gridColumns", "padding"],
  },
  {
    key: "approvals",
    label: "待办审批卡",
    proto: "#wbApps .wb-ap",
    impl: "#wbApps .wb-ap",
    card: "§三.A.8",
    gate: ["borderRadius", "padding", "marginBottom"],
  },
  {
    key: "broadcast",
    label: "AI 播报入口条",
    proto: "#al10BCBar",
    impl: '[data-testid="wb-bc-entry"]',
    card: "§三.A.8",
    gate: ["borderRadius", "padding"],
  },
  {
    key: "queue",
    label: "主管动作队列标题",
    proto: "#actHome",
    impl: '[data-testid="wb-feed-taskboard"] .wb-sec',
    card: "§三.A.8",
    gate: ["marginBottom", "fontSize", "gap"],
  },
  {
    key: "taskStep",
    label: "任务步进步卡",
    proto: ".act24-card",
    impl: ".act24-card",
    card: "§三.A.8",
    gate: ["borderRadius", "padding", "marginBottom"],
  },
];

/**
 * 二级列的纵向顺序（卡 §三.A.5 点名顺序：品牌区 → 说明块 → 常用功能 → 员工/对话横栏 → 目录 → 账号区）。
 * 新对话控件**不在**此序列：它是横栏内的末位子控件（与横栏同 y），由 findNewChatPlacement 按
 * 「同行 + 横栏内 + 右侧无其它可点控件」单独判定；把它塞进 y 序列只会得到并列值的假顺序。
 * 搜索框默认 display:none（§三.A.5），无 y 可言，由 findSearchVisibleByDefault / findSearchUnrecoverable 判定。
 */
export const SIDE_ORDER = ["brand", "dualNote", "grid", "segBar", "dir", "acct"];

/** 默认工作台主面区块顺序（卡 §三.A.8：KPI → 待办审批 → AI 播报 → 动作队列 → 任务步进） */
export const BODY_ORDER = ["kpis", "approvals", "broadcast", "queue", "taskStep"];

/* ────────────────────────── 一级 rail 契约（卡 §三.A.2）────────────────────────── */

/**
 * 卡 §三.A.2 点名：真实生产态 SUPER_ADMIN 必须可见 12 项，顺序即下表。
 * 这个数字不来自我们的实现，而来自原型 1440×1000 的实测 DOM 枚举
 * （原型融合版 V40 层把 rail 末位的 `.rl-set` 用 `display:none!important` 视觉隐藏，
 * 所以可见项 = 工作台 + 11 个一级业务模块 = 12；设置入口移到二级列底部账号区）。
 */
export const RAIL_VISIBLE_LABELS = [
  "工作台",
  "销售管理",
  "订单管理",
  "采购管理",
  "库存管理",
  "客户管理",
  "商品中心",
  "即时零售",
  "财务管理",
  "数据报表",
  "营销推广",
  "系统管理",
];

export const RAIL_VISIBLE_COUNT = RAIL_VISIBLE_LABELS.length;

/** rail 门禁要比的指标（项与项同构，逐项与**原型真实读数**对齐，不与源码字符串对齐） */
export const RAIL_ITEM_METRICS = ["x", "y", "width", "height", "fontSize", "borderRadius", "padding", "gap"];

/** logo / 选中态 / 设置项 / 分隔线各自的门禁指标 */
export const RAIL_LOGO_METRICS = ["x", "y", "width", "height", "borderRadius", "fontSize"];
export const RAIL_SELECTED_METRICS = ["backgroundColor", "color", "iconColor"];
export const RAIL_GAP_METRICS = ["x", "y", "width", "height", "backgroundColor"];
export const RAIL_SETTINGS_METRICS = ["display"];

/** 纵向步进：原型相邻两项 top 之差恒为 48（43 高 + 5 gap），逐项实测再由门禁比对 */
export function railSteps(items = []) {
  const tops = items.map((item) => Number(item?.metrics?.y ?? item?.y));
  return tops
    .slice(1)
    .map((top, index) => (Number.isFinite(top) && Number.isFinite(tops[index]) ? Math.round((top - tops[index]) * 100) / 100 : null));
}

/**
 * 单指标比对（差异表与 rail 差异行共用一套判据，避免两条判红口径）。
 * row = {region,label,card,metric,prototype,impl,delta,tolerance,gated,verdict,note}
 */
export function metricRow(region, label, card, metric, protoValue, implValue, gated, notes = {}, noteKey = "") {
  const pv = normalizeMetric(metric, protoValue);
  const iv = normalizeMetric(metric, implValue);
  if (pv === "" && iv === "") return null;
  const pn = numericOf(metric, pv);
  const in_ = numericOf(metric, iv);
  const delta = pn !== null && in_ !== null ? Math.round((in_ - pn) * 100) / 100 : null;
  const tol = isLengthMetric(metric) || /gap|padding|margin|radius/i.test(metric)
    ? TOLERANCE.length
    : /color|background/i.test(metric)
      ? TOLERANCE.color
      : TOLERANCE.length;
  const withinTol = delta === null ? pv === iv : Math.abs(delta) <= tol;
  const note = notes[noteKey || `${region}.${metric}`] ?? notes[`${region}.*`] ?? "";
  return {
    region,
    label,
    card,
    metric,
    prototype: pv,
    impl: iv,
    delta,
    tolerance: gated ? tol : null,
    gated,
    verdict: gated ? (withinTol ? "match" : note ? "explained" : "off-spec") : "recorded",
    note: gated && !withinTol ? note : "",
  };
}

/**
 * rail 差异行：把两侧真实量到的 rail 结构逐项摊开（数量、logo、12 项的坐标/尺寸/文案、
 * 步进、选中态实色、末位设置项的显示状态、底部分隔线）。
 * 这些行和区域差异表同构，因此 §三.A.7 的「偏差必须逐项解释」对 rail 同样生效。
 */
export function buildRailRows(protoRail = {}, implRail = {}, notes = {}) {
  const rows = [];
  const gate = (r) => r && rows.push(r);
  const pItems = protoRail.items ?? [];
  const iItems = implRail.items ?? [];

  gate(
    metricRow("rail.count", "一级栏可见项数", "§三.A.2", "count", pItems.length, iItems.length, true, notes, "rail.count.*"),
  );
  for (const metric of RAIL_LOGO_METRICS) {
    gate(
      metricRow(
        "rail.logo",
        "一级栏 logo",
        "§三.A.2",
        metric,
        protoRail.logo?.metrics?.[metric],
        implRail.logo?.metrics?.[metric],
        true,
        notes,
        `rail.logo.${metric}`,
      ),
    );
  }
  const total = Math.max(pItems.length, iItems.length);
  for (let index = 0; index < total; index += 1) {
    const p = pItems[index];
    const i = iItems[index];
    if (!p || !i) {
      rows.push({
        region: `rail.item[${index + 1}]`,
        label: `一级栏第 ${index + 1} 项`,
        card: "§三.A.2",
        metric: "presence",
        prototype: p ? (p.label ?? "present") : "absent",
        impl: i ? (i.label ?? "present") : "absent",
        delta: null,
        tolerance: 0,
        gated: true,
        verdict: "missing",
        note: notes[`rail.item[${index + 1}].presence`] ?? "",
      });
      continue;
    }
    rows.push({
      region: `rail.item[${index + 1}]`,
      label: `一级栏第 ${index + 1} 项`,
      card: "§三.A.2",
      metric: "label",
      prototype: String(p.label ?? "").trim(),
      impl: String(i.label ?? "").trim(),
      delta: null,
      tolerance: 0,
      gated: true,
      verdict: String(p.label ?? "").trim() === String(i.label ?? "").trim() ? "match" : notes[`rail.item[${index + 1}].label`] ? "explained" : "off-spec",
      note: notes[`rail.item[${index + 1}].label`] ?? "",
    });
    const gatedSet = new Set(RAIL_ITEM_METRICS);
    const metrics = new Set([...RAIL_ITEM_METRICS, ...Object.keys(p.metrics ?? {}), ...Object.keys(i.metrics ?? {})]);
    for (const metric of [...metrics].sort()) {
      const row = metricRow(
        `rail.item[${index + 1}]`,
        `一级栏第 ${index + 1} 项`,
        "§三.A.2",
        metric,
        p.metrics?.[metric],
        i.metrics?.[metric],
        gatedSet.has(metric),
        notes,
        `rail.item[${index + 1}].${metric}`,
      );
      if (row) gate(row);
    }
  }
  const pSteps = railSteps(pItems);
  const iSteps = railSteps(iItems);
  for (let index = 0; index < Math.max(pSteps.length, iSteps.length); index += 1) {
    const row = metricRow(
      "rail.step",
      "一级栏纵向步进",
      "§三.A.2",
      "y",
      pSteps[index],
      iSteps[index],
      true,
      notes,
      `rail.step[${index + 1}].y`,
    );
    if (row) {
      row.metric = `step(${index + 1}→${index + 2})`;
      gate(row);
    }
  }
  for (const metric of RAIL_SELECTED_METRICS) {
    gate(
      metricRow(
        "rail.selected",
        "一级栏选中态",
        "§三.A.2",
        metric,
        protoRail.selected?.[metric],
        implRail.selected?.[metric],
        true,
        notes,
        `rail.selected.${metric}`,
      ),
    );
  }
  for (const metric of RAIL_GAP_METRICS) {
    gate(
      metricRow(
        "rail.gap",
        "一级栏底部分隔线",
        "§三.A.2",
        metric,
        protoRail.gap?.metrics?.[metric],
        implRail.gap?.metrics?.[metric],
        true,
        notes,
        `rail.gap.${metric}`,
      ),
    );
  }
  for (const metric of RAIL_SETTINGS_METRICS) {
    gate(
      metricRow(
        "rail.settings",
        "一级栏设置项（原型视觉隐藏）",
        "§三.A.2",
        metric,
        protoRail.settings?.metrics?.[metric],
        implRail.settings?.metrics?.[metric],
        true,
        notes,
        `rail.settings.${metric}`,
      ),
    );
  }
  return rows.filter(Boolean);
}

/** 生产态验收：rail 可见项数必须与原型实测同构且等于卡面点名的 12 项 */
export function findRailCount(protoItems = [], implItems = []) {
  const out = [];
  if (protoItems.length !== RAIL_VISIBLE_COUNT) {
    out.push({ reason: `原型实测可见项 ${protoItems.length} ≠ 卡面 §三.A.2 的 ${RAIL_VISIBLE_COUNT} 项，契约需以原型实测为准复核` });
  }
  if (implItems.length !== RAIL_VISIBLE_COUNT) {
    out.push({ reason: `实现生产态可见项 ${implItems.length}（卡面要求 ${RAIL_VISIBLE_COUNT}：${RAIL_VISIBLE_LABELS.join("/")}）` });
  }
  const missing = RAIL_VISIBLE_LABELS.filter((label) => !implItems.some((it) => String(it.label).trim() === label));
  if (missing.length > 0) out.push({ reason: `实现缺项：${missing.join("/")}` });
  return out;
}

/** rail 设置项：原型保留 DOM 但视觉隐藏 ⇒ 实现侧 display 必须为 none（不得删节点、不得用 visibility 冒充） */
export function findRailSettingsHidden(settings) {
  if (!settings || settings.exists !== true) {
    return [{ reason: "rail 设置项节点不在 DOM（卡面要求「保留但视觉隐藏」，删除即改结构）" }];
  }
  if (String(settings.metrics?.display) !== "none") {
    return [{ reason: `rail 设置项仍视觉可见（display=${settings.metrics?.display}），原型最新态为 display:none` }];
  }
  return [];
}

/** 加载期骨架不得混进生产态验收（骨架项与真实项互斥是 F1 既有契约） */
export function findRailSkeletonLeak(implRail = {}) {
  const skeletons = implRail.skeletons ?? [];
  if (skeletons.length === 0) return [];
  return [{ reason: `生产态截图里混入 ${skeletons.length} 个加载期骨架项（data-rail-skeleton），验收态必须是 ready 真实项` }];
}

/**
 * 卡 §三.A.2 末条：`?wb_uiux=12-groups` 注入态只能用于结构诊断。
 * A 段的并排/三视口截图必须来自无注入的生产入口，否则「12 项」是测试参数造出来的假象。
 */
export function findInjectionInProductionShot(production = {}) {
  const out = [];
  if (production.uiuxInject === true || production.injected === true) {
    out.push({ reason: "生产态验收截图带 ?wb_uiux 注入（注入态只可用于结构诊断，不得作为生产验收证据）" });
  }
  if (typeof production.search === "string" && production.search.includes("wb_uiux")) {
    out.push({ reason: `生产态 URL 仍带注入参数：${production.search}` });
  }
  return out;
}

/**
 * 容差：卡 §三.A.7 要求「原则上为 0」，但两侧字体度量不可能逐字节相同，
 * 所以坐标/尺寸给 1px（含 421.7 这类亚像素取整），间距给 1px，颜色与内边距给 0。
 * 任何超容差项必须带逐项解释（deviationNotes），否则判红。
 */
export const TOLERANCE = {
  length: 1, // x/y/width/height/gap/padding/margin/border 宽度
  radius: 1,
  color: 0, // 颜色必须逐字节相同（归一到 rgb 三元组后比较）
  display: 0,
};

/** 卡 §三.A.6 的直接反证：侧栏顶部不允许再存在整宽的新对话大按钮 */
export const MAX_NEWCHAT_WIDTH = 40;

/** 说明块/搜索框这类「原型有、实现必须也有」的项，缺失即红 */
export const MISSING_IS_FATAL = true;

/* ────────────────────────── 读数归一 ────────────────────────── */

/** "rgb(247, 249, 252)" / "#F7F9FC" / "rgba(...)" → "247,249,252" */
export function normalizeColor(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return "none";
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(",");
  }
  const rgb = raw.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => Number(p.trim()));
    return parts.slice(0, 3).map((n) => Math.round(n)).join(",");
  }
  return raw;
}

/** "0 10px 0 14px" → "0,10,0,14"；缺项按 CSS 四面简写展开 */
export function normalizeBox(value) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const nums = parts.map((p) => (Number.parseFloat(p) || 0));
  const n = nums.length;
  const t = nums[0];
  const r = n >= 2 ? nums[1] : nums[0];
  const b = n >= 3 ? nums[2] : nums[0];
  const l = n === 4 ? nums[3] : r;
  return [t, r, b, l].map((x) => Math.round(x * 100) / 100).join(",");
}

/** "546px 1080px" / "none" / "1fr 1fr" → 归一后的轨道串 */
export function normalizeTrack(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none") return "none";
  return raw
    .split(/\s+/)
    .map((p) => {
      const px = Number.parseFloat(p);
      return Number.isFinite(px) ? Math.round(px * 100) / 100 : p.toLowerCase();
    })
    .join(" ");
}

/** 单指标归一：颜色 / 盒式 / 轨道 / 数字 / 字符串 */
export function normalizeMetric(name, value) {
  if (value === undefined || value === null) return "";
  if (/color$/i.test(name) || /^background/i.test(name) || /^border/i.test(name) && /color$/i.test(name)) {
    return normalizeColor(value);
  }
  if (/^padding|^margin|^gap|^borderBottomWidth|^borderTopWidth|^borderWidth|^borderRadius|^fontSize|^lineHeight/i.test(name)) {
    return String(value).includes(" ") && !/px/.test(String(value))
      ? normalizeColor(String(value))
      : normalizeBox(String(value));
  }
  if (name === "gridColumns") return normalizeTrack(value);
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim().toLowerCase();
}

/** 数字型指标（做差值）；非数字返回 null */
export function numericOf(metric, normalized) {
  const n = ["x", "y", "width", "height", "right", "bottom", "fontSize", "lineHeight", "borderBottomWidth", "borderTopWidth", "gap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "borderRadius"].includes(metric) || /^(padding|margin)Top|^(padding|margin)Bottom/.test(metric);
  if (["padding", "gap", "marginBottom", "marginTop", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "x", "y", "width", "height", "borderRadius", "borderBottomWidth", "borderTopWidth", "borderWidth", "fontSize", "lineHeight"].includes(metric)) {
    const first = Number.parseFloat(String(normalized).split(",")[0]);
    return Number.isFinite(first) ? first : null;
  }
  return n ? Number.parseFloat(String(normalized)) ?? null : null;
}

/** 该指标是否按「数字差值」判容差 */
export function isLengthMetric(metric) {
  return [
    "x", "y", "width", "height", "gap", "borderRadius", "borderBottomWidth", "borderTopWidth",
    "borderWidth", "marginBottom", "marginTop", "marginLeft", "marginRight",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontSize",
  ].includes(metric);
}

/* ────────────────────────── 差异表 ────────────────────────── */

/**
 * 生成逐区域逐指标差异表。
 * `rows` 每项：{region,label,card,metric,prototype,impl,delta,tolerance,gated,verdict,note}
 * verdict：
 *   match      —— 门禁指标且完全一致（或在容差内）
 *   off-spec   —— 门禁指标且超容差（且没有解释）⇒ 判红
 *   explained  —— 超容差但带逐项书面解释 ⇒ 允许，但必须留在表里
 *   n/a        —— 有一侧没有读数（非门禁区域）
 *   missing    —— required 区域在一侧不存在 ⇒ 判红
 */
export function buildDiffTable(proto = {}, impl = {}, notes = {}) {
  const rows = [];
  for (const region of REGION_CONTRACT) {
    const p = proto?.[region.key];
    const i = impl?.[region.key];
    if (!p || !i || p.exists !== true || i.exists !== true) {
      rows.push({
        region: region.key,
        label: region.label,
        card: region.card,
        metric: "presence",
        prototype: p?.exists === true ? "present" : "absent",
        impl: i?.exists === true ? "present" : "absent",
        delta: null,
        tolerance: 0,
        gated: true,
        verdict: MISSING_IS_FATAL && region.required ? "missing" : "n/a",
        note: notes[`${region.key}.presence`] ?? "",
      });
      continue;
    }
    const metrics = new Set([...(region.gate ?? []), ...Object.keys(p.metrics ?? {})]);
    for (const metric of [...metrics].sort()) {
      const pv = normalizeMetric(metric, p.metrics?.[metric]);
      const iv = normalizeMetric(metric, i.metrics?.[metric]);
      if (pv === "" && iv === "") continue;
      const gated = (region.gate ?? []).includes(metric);
      const num = numericOf(metric, pv) !== null && numericOf(metric, iv) !== null;
      const delta = num ? Math.round((numericOf(metric, iv) - numericOf(metric, pv)) * 100) / 100 : null;
      const tol = isLengthMetric(metric) ? TOLERANCE.length : /color|background/i.test(metric) ? TOLERANCE.color : TOLERANCE.length;
      const withinTol = gated ? (delta === null ? pv === iv : Math.abs(delta) <= tol) : true;
      const note = notes[`${region.key}.${metric}`] ?? notes[`${region.key}.*`] ?? "";
      rows.push({
        region: region.key,
        label: region.label,
        card: region.card,
        metric,
        prototype: pv,
        impl: iv,
        delta,
        tolerance: gated ? tol : null,
        gated,
        verdict: gated ? (withinTol ? (pv === iv ? "match" : "match") : note ? "explained" : "off-spec") : "recorded",
        note: gated && !withinTol ? note : "",
      });
    }
  }
  return rows;
}

/** 差异表里判红的行 */
export function findOffSpec(rows = []) {
  return rows.filter((r) => r.verdict === "missing" || r.verdict === "off-spec");
}

/** 「超容差但写了说明」的行 —— 允许，但必须显式留在证据里（卡 §三.A.7「偏差必须逐项解释」） */
export function findExplained(rows = []) {
  return rows.filter((r) => r.verdict === "explained");
}

/** 门禁指标一致率（写进回传卡用，不参与判红） */
export function gatedStats(rows = []) {
  const gated = rows.filter((r) => r.gated && r.metric !== "presence");
  return {
    gated: gated.length,
    exact: gated.filter((r) => r.prototype === r.impl).length,
    withinTolerance: gated.filter((r) => r.verdict === "match" || r.verdict === "explained").length,
    offSpec: gated.filter((r) => r.verdict === "off-spec").length,
  };
}

/* ────────────────────────── 结构性门禁 ────────────────────────── */

/** 顺序门禁：按各区域 top 排序后必须等于卡面给定顺序 */
export function findOrderViolations(readings = {}, expected = SIDE_ORDER) {
  const present = expected
    .map((key) => ({ key, top: readings?.[key]?.metrics?.y, exists: readings?.[key]?.exists }))
    .filter((e) => e.exists === true && Number.isFinite(e.top));
  const sorted = [...present].sort((a, b) => a.top - b.top).map((e) => e.key);
  const want = expected.filter((k) => present.some((p) => p.key === k));
  if (sorted.join(">") === want.join(">")) return [];
  return [{ expected: want.join(" > "), actual: sorted.join(" > ") }];
}

/**
 * 卡 §三.A.6：整宽蓝色新对话按钮必须消失。
 * 只看实现页里所有含「新对话」文本或 newchat 类的可点节点：
 * 任一节点宽度 > MAX_NEWCHAT_WIDTH 即判红（不接受「隐藏但仍存在」的把戏 —— 它要求的是删除）。
 */
export function findFullWidthNewChat(candidates = []) {
  return candidates
    .filter((c) => Number(c.width) > MAX_NEWCHAT_WIDTH)
    .map((c) => ({ selector: c.selector, width: c.width, height: c.height, background: c.background, top: c.top }));
}

/** 卡 §三.A.6：新对话必须回到员工/对话横栏右侧（同一行、且在该行最右） */
export function findNewChatPlacement(newChat, segBar) {
  const out = [];
  if (!newChat || newChat.exists !== true) return [{ reason: "新对话控件不存在" }];
  if (!segBar || segBar.exists !== true) return [{ reason: "员工/对话横栏不存在，无从判定右侧位置" }];
  const n = newChat.metrics ?? {};
  const s = segBar.metrics ?? {};
  const sameRow = Math.abs(Number(n.y) - Number(s.y)) <= TOLERANCE.length + 2;
  if (!sameRow) out.push({ reason: `与横栏不同行（新对话 y=${n.y} · 横栏 y=${s.y}）` });
  const rightAligned = Number(n.x) + Number(n.width) <= Number(s.x) + Number(s.width) + 1 && Number(n.x) >= Number(s.x);
  if (!rightAligned) out.push({ reason: `不在横栏范围内（新对话 x=${n.x} w=${n.width} · 横栏 x=${s.x} w=${s.width}）` });
  if (Number(n.rightMostWithinBar) === 0) out.push({ reason: "横栏内右侧仍有其它可点控件，新对话不是末位" });
  return out;
}

/**
 * 卡 §三.A.5：搜索框默认必须不可见（原型 .al-v14-search 默认 display:none）。
 * 读数的 `exists/visible` 在节点层、`display/width/focusable` 在 metrics 层，
 * 这里显式分取，避免「字段拿错 ⇒ 恒判红 / 恒放行」这类自我安慰式门禁。
 */
export function findSearchVisibleByDefault(search) {
  if (!search || search.exists !== true) return [{ reason: "搜索框节点缺失（能力不得因对齐原型而丢）" }];
  const m = search.metrics ?? {};
  const painted = search.visible === true && String(m.display) !== "none" && Number(m.width) > 0 && Number(m.height) > 0;
  if (painted) {
    return [{ reason: `默认即已绘制（display=${m.display} w=${m.width} h=${m.height} visible=${search.visible}）` }];
  }
  return [];
}

/** 搜索框必须仍可展开可用（隐藏不等于删功能）：绘制 + 真的能被聚焦，两者都要实测 */
export function findSearchUnrecoverable(searchAfterToggle) {
  const node = searchAfterToggle ?? {};
  const m = node.metrics ?? {};
  if (node.exists !== true) return [{ reason: "点击展开控件后搜索框不在 DOM" }];
  if (node.visible !== true || String(m.display) === "none") {
    return [{ reason: `展开后仍未绘制（display=${m.display} w=${m.width} h=${m.height} visible=${node.visible}）` }];
  }
  if (m.focused !== "true") {
    return [{ reason: `展开后无法真正聚焦（activeElement 实测=${String(m.focused)}）：不可聚焦等于不可用` }];
  }
  return [];
}

/** 底部账号区必须贴住视口底（卡 §三.A.7：y=942 h=58 在 1000 高视口里即「贴底」） */
export function findAccountNotPinned(acct, viewportHeight) {
  if (!acct || acct.exists !== true) return [{ reason: "账号区不存在" }];
  const bottom = Number(acct.metrics?.y) + Number(acct.metrics?.height);
  if (!Number.isFinite(bottom)) return [{ reason: "账号区读数缺失" }];
  if (Math.abs(bottom - viewportHeight) > TOLERANCE.length + 1) {
    return [{ reason: `账号区底边 y=${bottom} 未贴视口底 ${viewportHeight}` }];
  }
  return [];
}

/** 主面不得出现横向裁切（卡 §三.C.14） */
export function findClippedA(frames = []) {
  return frames
    .filter((f) => Number(f.overflowX) !== 0)
    .map((f) => ({ viewport: f.viewport, screen: f.screen, overflowX: f.overflowX }));
}

/** 并排证据必须真的存在两张同视口截图 + 一张合成图（卡 §三.A.1/§六） */
export function findMissingSideBySide(shots = {}) {
  const need = ["prototype", "implementation", "sideBySide"];
  return need.filter((k) => !shots?.[k] || Number(shots[k]?.bytes ?? 0) < 8000).map((k) => `并排证据缺 ${k}（PNG 字节不足或缺失）`);
}

/** 并排图里两侧必须真的各占一半且同高（防止拿两张不同视口的图硬拼） */
export function findSideBySideMismatch(composite = {}) {
  const out = [];
  if (Number(composite.panes) !== 2) out.push({ reason: `合成图面板数=${composite.panes}（需 2）` });
  if (composite.sameViewport !== true) out.push({ reason: "两侧视口不一致" });
  if (Number(composite.heightMatch) !== 1) out.push({ reason: "两侧高度不同（不是同视口并排）" });
  return out;
}

/** 差异表为空 / 门禁行为 0 ⇒ 采集端根本没量到东西，判红 */
export function findEmptyDiff(rows = []) {
  const gated = rows.filter((r) => r.gated);
  if (gated.length < 20) {
    return [{ reason: `门禁指标行仅 ${gated.length} 条（<20）：区域读数疑似未采集成功` }];
  }
  return [];
}

/** 网络失败白名单沿用 A/B 段同一份口径（卡 §三.9） */
export function findUnresolvedNetwork(audit = {}, allowedPorts = []) {
  const ports = new Set(allowedPorts.map((e) => Number(e.port)));
  const closed = new Set((audit.recovered ?? []).map((f) => f.signature));
  return (audit.failures ?? [])
    .filter((f) => !ports.has(Number(f.port)))
    .filter((f) => !closed.has(f.signature))
    .map((f) => ({ method: f.method, url: f.url, port: f.port, error: f.error }));
}

/**
 * 一次性汇总 A 段门禁违例。空数组 = 证据合格。
 * 采集端与专项测试共用，保证「机器判红」和「人工看并排图」是同一套规则。
 */
export function collectViolationsF2A(bundle = {}) {
  const out = [];
  const base = bundle?.viewports?.[BASE_VIEWPORT.id] ?? {};
  const rows = base.diffTable ?? [];
  for (const r of findEmptyDiff(rows)) out.push(`差异表可疑：${r.reason}`);
  /* 一级 rail（卡 §三.A.2）：可见 12 项、设置项视觉隐藏、骨架不得混入生产态、验收 URL 不得带注入 */
  const protoRail = base.protoRail ?? {};
  const implRail = base.implRail ?? {};
  for (const r of findRailCount(protoRail.items ?? [], implRail.items ?? [])) {
    out.push(`一级栏项数/顺序不符（§三.A.2）：${r.reason}`);
  }
  for (const r of findRailSettingsHidden(implRail.settings)) {
    out.push(`一级栏设置项（§三.A.2）：${r.reason}`);
  }
  for (const r of findRailSettingsHidden(protoRail.settings)) {
    out.push(`一级栏设置项原型侧读数异常（§三.A.2，契约以原型实测为准，需复核）：${r.reason}`);
  }
  for (const r of findRailSkeletonLeak(implRail)) {
    out.push(`一级栏混入骨架（§三.A.2 生产态验收）：${r.reason}`);
  }
  for (const r of findInjectionInProductionShot(base.production ?? {})) {
    out.push(`生产态验收被污染（§三.A.2 末条）：${r.reason}`);
  }
  for (const r of findOffSpec(rows)) {
    out.push(`原型偏差未解释：${r.card} ${r.label} · ${r.metric} 原型=${r.prototype} 实现=${r.impl}${r.delta === null ? "" : ` 差=${r.delta}`}${r.tolerance === null ? "" : `（容差 ±${r.tolerance}）`}`);
  }
  for (const v of findOrderViolations(base.impl ?? {}, SIDE_ORDER)) {
    out.push(`二级列顺序错位（§三.A.5）：期望 ${v.expected}，实际 ${v.actual}`);
  }
  for (const v of findOrderViolations(base.implBody ?? {}, BODY_ORDER)) {
    out.push(`主面区块顺序错位（§三.A.8）：期望 ${v.expected}，实际 ${v.actual}`);
  }
  for (const c of findFullWidthNewChat(base.newChatCandidates ?? [])) {
    out.push(`整宽新对话按钮仍在（§三.A.6）：${c.selector} 宽 ${c.width}px（要求 ≤${MAX_NEWCHAT_WIDTH}px 并回到横栏右侧）`);
  }
  for (const p of findNewChatPlacement(base.impl?.newChat, base.impl?.segBar)) {
    out.push(`新对话位置不合规（§三.A.6）：${p.reason}`);
  }
  for (const s of findSearchVisibleByDefault(base.impl?.search)) {
    out.push(`搜索框默认未隐藏（§三.A.5）：${s.reason}`);
  }
  for (const s of findSearchUnrecoverable(base.searchAfterToggle)) {
    out.push(`搜索框隐藏后不可恢复（§三.A.5 不得因对齐原型丢功能）：${s.reason}`);
  }
  for (const a of findAccountNotPinned(base.impl?.acct, BASE_VIEWPORT.height)) {
    out.push(`账号区未贴底（§三.A.7）：${a.reason}`);
  }
  for (const m of findMissingSideBySide(base.shots ?? {})) out.push(`并排证据不足：${m}`);
  for (const m of findSideBySideMismatch(base.sideBySide ?? {})) out.push(`并排图不同视口：${m.reason}`);
  for (const c of findClippedA(bundle.frames ?? [])) {
    out.push(`横向裁切（§三.C.14）：${c.viewport}/${c.screen} overflowX=${c.overflowX}`);
  }
  for (const n of findUnresolvedNetwork(bundle.network ?? {}, bundle.expectedOffline ?? [])) {
    out.push(`未闭合网络失败：${n.method} ${n.url} → ${n.error}`);
  }
  const servers = bundle.servers ?? {};
  if (servers.portsAllDown !== true) {
    out.push(`服务未自停：${servers.backendPort ?? 8080}/${servers.webPort ?? 5199} 未全部 DOWN`);
  }
  /* 采集端自报的异常/超时不得被当成「没有违例」：任何一条都算门禁失败 */
  for (const e of bundle.errors ?? []) out.push(`采集端异常（§五.1 证据可信度）：${String(e).slice(0, 180)}`);
  if (bundle.aborted) out.push(`采集中止（§五.1 证据可信度）：${String(bundle.aborted).slice(0, 180)}`);
  if (base.railSettled !== true) out.push("一级栏未确认落定到菜单 ready 态（§三.A.2 生产态验收）");
  if (bundle.apiBase !== "/api") out.push(`API 基址未统一：${String(bundle.apiBase)}（要求同源 /api）`);
  if (bundle.prototypeSource?.sha256 !== bundle.prototypeSha256) {
    out.push(`原型指纹与卡面不符：实测 ${String(bundle.prototypeSource?.sha256)} ≠ 卡面 ${String(bundle.prototypeSha256)}`);
  }
  return out;
}

/* ────────────────────────── 消费者验收（卡 §四.1/3/4）────────────────────────── */

/** 除「工作台」外必须逐个点击的 11 个一级业务模块（顺序即卡面顺序） */
export const CONSUMER_MODULE_LABELS = RAIL_VISIBLE_LABELS.slice(1);

/** 选中态判定基准（原型实测主蓝实心） */
export const RAIL_SELECTED_BG = "37,99,235";
export const RAIL_SELECTED_FG = "255,255,255";

/** 消费者场景汇总门禁。空数组 = 生产态验收合格（采集端与专项测试共用）。 */
export function collectConsumerViolations(bundle = {}) {
  const out = [];
  const servers = bundle.servers ?? {};
  if (servers.portsAllDown !== true) out.push(`服务未自停：${servers.backendPort ?? "?"}/${servers.webPort ?? "?"} 未全部 DOWN`);
  if (bundle.apiBase !== "/api") out.push(`API 基址未统一：${String(bundle.apiBase)}（要求同源 /api）`);
  if (!JSON.stringify(bundle.app?.roles ?? []).includes("SUPER_ADMIN")) out.push(`登录态不是真实 SUPER_ADMIN：${JSON.stringify(bundle.app?.roles ?? [])}`);
  const prod = bundle.production ?? {};
  if (prod.uiuxInject === true || prod.injected === true || String(prod.href ?? "").includes("wb_uiux")) {
    out.push("消费者验收被注入态污染（§四 要求生产 URL + 真实登录态）");
  }
  const mods = bundle.modules ?? [];
  const gotLabels = mods.map((m) => String(m.label ?? "").trim());
  for (const want of CONSUMER_MODULE_LABELS) {
    if (!gotLabels.includes(want)) out.push(`业务模块缺席：${want}（§四.3 要求逐个点击 11 个模块）`);
  }
  for (const m of mods) {
    const tag = `模块 ${m.label ?? m.railKey ?? "?"}`;
    if (m.clicked !== true) out.push(`${tag} 未被真实点击（§四.3 不得用 hover/注入冒充）`);
    const bg = normalizeColor(m.railItem?.backgroundColor);
    const fg = normalizeColor(m.railItem?.color);
    if (bg !== RAIL_SELECTED_BG || fg !== RAIL_SELECTED_FG) out.push(`${tag} 选中态不符原型：底色=${bg || "∅"}（应 ${RAIL_SELECTED_BG}）文字=${fg || "∅"}`);
    if (m.main?.hasContent !== true) out.push(`${tag} 主面无可见内容（既不是真实页也不是诚实占位，疑似空白）`);
    if (Number(m.main?.overflowX) !== 0) out.push(`${tag} 出现横向裁切 overflowX=${m.main?.overflowX}（§三.C.14）`);
    if (m.subnav?.secondNavVisible !== true) out.push(`${tag} 二级导航列不可见`);
    if (m.subnav?.dirVisible !== true) out.push(`${tag} 二级目录不可见（§四.3「二级目录符合原型」）`);
    if (m.pageerror?.length) out.push(`${tag} 页面未捕获异常：${String(m.pageerror[0]).slice(0, 120)}`);
  }
  const desk = bundle.backToDesk ?? {};
  if (desk.feedShown !== true) out.push("回退工作台后信息流面未出现");
  if (desk.dualNoteVisible !== true) out.push("回退工作台后双入口说明块不可见（§四.3 回退常用功能）");
  if (desk.gridVisible !== true) out.push("回退工作台后常用功能网格不可见（§四.3 回退常用功能）");
  if (normalizeColor(desk.railItem?.backgroundColor) !== RAIL_SELECTED_BG) out.push(`回退后工作台选中态异常：${normalizeColor(desk.railItem?.backgroundColor)}`);
  const seg = bundle.segToggle ?? {};
  const before = seg.before ?? {};
  const chat = seg.afterChat ?? {};
  const staff = seg.afterStaffAgain ?? {};
  if (before.activeTab !== "员工") out.push(`初始分段态不是「员工」：${before.activeTab ?? "∅"}`);
  if (chat.activeTab !== "对话") out.push("点击「对话」后分段未切换（§四.4 员工/对话切换）");
  if (chat.searchAriaLabel !== "搜索会话") out.push(`对话态搜索框语义未随切换：aria-label=${chat.searchAriaLabel ?? "∅"}`);
  if (staff.activeTab !== "员工") out.push("切回「员工」后分段未回位（§四.4 双向切换）");
  if (staff.searchAriaLabel !== "搜索员工") out.push(`回位后搜索框语义未复原：aria-label=${staff.searchAriaLabel ?? "∅"}`);
  if (String(staff.dirState ?? "") !== String(before.dirState ?? "")) out.push(`员工态目录往返后状态漂移：${before.dirState} → ${staff.dirState}`);
  const hashes = new Set();
  for (const f of bundle.frames ?? []) {
    if (Number(f.bytes) < 8000) out.push(`帧字节不足：${f.file ?? f.label ?? "?"}`);
    if (hashes.has(f.sha256)) out.push(`帧哈希重复（平图复用冒充逐模块证据）：${f.file ?? "?"}`);
    hashes.add(f.sha256);
  }
  for (const n of findUnresolvedNetwork(bundle.network ?? {}, bundle.expectedOffline ?? [])) {
    out.push(`未闭合网络失败：${n.method} ${n.url} → ${n.error}`);
  }
  for (const e of bundle.errors ?? []) out.push(`采集端异常：${String(e).slice(0, 180)}`);
  if (bundle.aborted) out.push(`采集中止：${String(bundle.aborted).slice(0, 180)}`);
  return out;
}

/** 脱敏（沿用 F1/F2 同一规则：证据里不得出现凭据形态） */
export { redactText, portOfUrl, findDuplicateHashes, VIEWPORTS } from "./uiux-scenarios-lib.mjs";
