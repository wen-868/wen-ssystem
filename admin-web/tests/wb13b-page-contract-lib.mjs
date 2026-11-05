/**
 * WORKBENCH-13B · 页面级视觉契约（卡 §三.A.4/5/6 · 逐业务模块页面，非壳层）
 *
 * F2a/F3 的 REGION_CONTRACT 量的是**壳层**（rail / 二级列 / 顶栏 / 默认信息流五区块），
 * 13B 要量的是**每个业务模块页面自身**：页根、页面标题、统计条、筛选条、表格、分页、
 * 表单卡、板块标题、图表、空态。本文件只做三件事：
 *   1) PAGE_CONTRACT —— 区域契约（原型选择器 ↔ 实现选择器，支持候选选择器列表）
 *   2) buildPageDiffTable —— 与 F2a 同一套归一/容差口径（直接 import 复用，不复制第二份）
 *   3) 机器门禁 —— collectModuleParityViolations：判红项、复用帧、覆盖缺口、签名不一致
 *
 * 口径来源：卡 §三.A.6「偏差 ≤±1px，颜色必须逐字节相同」与 §三.A.7「偏差必须逐项解释」
 * ⇒ 容差/归一/判红全部复用 f2a-visual-baseline-lib.mjs 的 TOLERANCE / normalizeMetric /
 * numericOf / isLengthMetric / MISSING_IS_FATAL，本文件不另立标准。
 */
import {
  BASE_VIEWPORT,
  MISSING_IS_FATAL,
  TOLERANCE,
  findDuplicateHashes,
  isLengthMetric,
  normalizeMetric,
  numericOf,
} from "./f2a-visual-baseline-lib.mjs";

/** 13B 主视口两档（卡 §三.A.3）：1440×1000 与 1024×768，两档各自独立成帧，不得互借 */
export const PAGE_VIEWPORTS = [
  BASE_VIEWPORT,
  { id: "1024x768", width: 1024, height: 768 },
];

/**
 * 区域契约。
 * `proto` / `impl`：选择器或选择器数组（数组按序取第一个命中的 ⇒ 同一部位在两种版式里的别名）。
 * `expect`：both（两侧都必须有）/ proto-only（原型独有，实现有才算偏差）/ impl-only（反之）/ either（版式相关，缺一不判红）。
 * `types`：适用的原型版式（PANEL 工厂键：list/form/detail/board/bill/order/print/fuse/pos）；缺省=全部。
 * `gate`：卡面点名的门禁指标；其余指标只 `recorded` 不判红。
 */
export const PAGE_CONTRACT = [
  {
    key: "pageRoot",
    label: "页面根容器",
    // `__ROOT__` 放最前：两侧的量测层由采集器的 rootSel 决定，而它两侧刻意取**同一层**
    // —— 原型 = `#wbWrap.wb-wrap`（L195 的 1080 上限 + 32/44/60 内边距），
    //    实现 = `main[data-view=manual].shown` 的页根（13B 把同一条包装语法打在它身上，见 styles.css）。
    // `.s-wrap` 是 .wb-wrap 里已扣掉边距的内容层（L749 min-width:0），留在后面只作 rootSel 未命中时的兜底。
    proto: ["__ROOT__", ".s-wrap"],
    // `__ROOT__` = 采集器把读数限定到的页面容器本身（实现侧 = `main[data-view=manual].shown` 的子元素）。
    // 业务页根类**并不统一**：多数视图用 `.page`，POS/商品/供应商/付款页各有自有根
    // （实测 /sale-bills=`.pos-sale-bills`、/collection=`.pos-collection`）⇒ 只有取「真实渲染出的根」
    // 才能逐模块量同一层，硬写类名清单必然漏。`.page` 等仍留作 rootSel 未命中时的兜底。
    impl: ["__ROOT__", ".page", ".wb-page", "main .page"],
    card: "§三.A.4",
    expect: "both",
    gate: ["x", "width", "height", "padding", "backgroundColor"],
  },
  {
    key: "pageTitle",
    label: "页面标题（顶栏唯一标题）",
    proto: "#topTitle",
    impl: ".wb-top .wb-top-title",
    card: "§三.A.4",
    // 两侧标题都渲染在**顶栏**（原型 #topTitle / 实现 .wb-top .wb-top-title），不在页体根容器内
    // ⇒ 这条必须按整屏口径查，否则页面作用域永远查不到自己的标题。
    scope: "shell",
    expect: "both",
    gate: ["fontSize", "fontWeight", "color", "text"],
  },
  {
    key: "inPageHeader",
    label: "页面内自绘标题块",
    proto: ["#wbBody .page-header", "#wbBody [data-testid='page-header']"],
    impl: [".page-header", ".page-title"],
    card: "§三.A.4",
    // 原型 L1752 明确「顶栏唯一标题：页面内不再重复渲染标题」⇒ 实现侧的页内标题块是多余一层
    expect: "impl-only",
    gate: ["y", "height", "fontSize", "marginBottom"],
  },
  {
    key: "dockInfo",
    label: "对接信息条",
    proto: ".s-dock",
    impl: [".wb13b-dock", "[data-testid='wb-dock']"],
    card: "§三.A.4",
    // 原型里的路由/组件/接口条是给设计看板用的注记，不是给人用的界面 ⇒ 实现侧本就不该有
    expect: "proto-only",
    gate: ["y", "height", "fontSize", "padding", "borderRadius"],
  },
  {
    key: "statistics",
    label: "统计条 / KPI 区",
    proto: ".wb-kpis",
    // 实现侧 KPI 条宿主在历史视图里有多种同类命名（逐类取自 src/views 实测：
    // `.stat-row`×13、`.stats-row`×7、`.stat-grid`×5、`.stat-cards`×2、`.wb-kpis`×1）
    // 外加共享组件 StatBar.vue 的 `.stat-bar`（客户 订单 商品 库存 财务 五个模块同用一条，实测 5 处引用）
    // —— 都是「页面顶部并排统计卡」同一角色，只认 `.stat-row` 会把已有 KPI 区的页面误报成 statistics 缺失（假红）。
    impl: [".stat-row", ".stats-row", ".stat-grid", ".stat-cards", ".stat-bar", ".wb-kpis", "[data-testid='page-stats']"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "board", "fuse", "bill", "order", "detail"],
    gate: ["x", "y", "width", "gap", "gridColumns", "padding", "marginBottom"],
  },
  {
    key: "statCard",
    label: "统计卡单元",
    proto: ".wb-kpi",
    // 同上：`.stat-item`×27 / `.stat-card`×86 / `.stat-grid-card`×17 / `.wb-kpi` 是同一角色的四种命名，
    // 再加共享组件 StatBar.vue 的 `.stat-bar-item`（画布内已按 styles.css §4b 还原成独立卡）。
    impl: [".stat-item", ".stat-card", ".stat-grid-card", ".stat-bar-item", ".wb-kpi", "[data-testid='page-stat-item']"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "board", "fuse", "bill", "order", "detail"],
    // 两侧分隔口径都在四边（原型 .wb-kpi 1px 全框），下边框与上边框同值 ⇒ 保留 borderBottomColor，
    // 另补 borderTopColor 与 borderColor 无关的圆角/底色已由前两项覆盖。
    gate: ["width", "height", "padding", "borderRadius", "backgroundColor", "borderBottomColor"],
  },
  {
    key: "filterBar",
    label: "筛选条",
    proto: ".s-filter",
    // `.filter-bar`×86 与 `.filter-card`×5（即时零售自提 / 订单路由 / 报表 2 页 / 系统反馈）是同一角色的两种命名，
    // 画布内两条宿主共用同一组规则（styles.css §2 用 `:is(.filter-bar, .filter-card)`）。
    impl: [".filter-bar", ".filter-card", "[data-testid='page-filter']", ".el-form--inline"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "order", "bill"],
    gate: ["x", "y", "width", "height", "gap", "padding", "borderRadius", "backgroundColor", "marginBottom"],
  },
  {
    key: "filterField",
    label: "筛选控件（输入/下拉）",
    // 原型把描边/高度画在**真实控件** `input/select` 上（L768 height30、radius9、12px、1px #ECEEF1），
    // `.s-fi` 只是 label+控件的外层 flex 容器（无边框）⇒ 取控件本体，否则读出的是 currentColor 假色。
    // 实现侧 ElementPlus 把可视盒画在 `__wrapper` 上（外层 .el-input 无描边），同理取 wrapper。
    proto: [".s-filter .s-fi input", ".s-filter .s-fi select", ".s-fi"],
    impl: [
      ".filter-bar .el-input__wrapper",
      ".filter-bar .el-select__wrapper",
      ".filter-bar .el-input",
      ".filter-bar .el-select",
      ".filter-bar input",
      ".filter-card .el-input__wrapper",
      ".filter-card .el-select__wrapper",
      ".filter-card .el-input",
      ".filter-card .el-select",
      ".filter-card input",
    ],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "order", "bill"],
    gate: ["width", "height", "fontSize", "borderRadius", "borderBottomColor"],
  },
  {
    key: "toolbarActions",
    label: "工具条按钮组（查询/重置/导出/新建）",
    // 两侧都指到**主行动按钮**（原型模板 L2764 的第一个 .btn2 就是 `btn2 pri` 查询；实现侧对应 el-button--primary）。
    // 取「第一个 button」会拿原型蓝钮 ⇄ 实现白钮比底色，是同一角色选错实例的口径假红，不是页面差异。
    proto: [".s-filter .btn2.pri", ".s-filter .btn2", ".acts-bar .btn2.pri", ".acts-bar .btn2"],
    impl: [
      ".filter-bar .el-button--primary",
      ".filter-card .el-button--primary",
      ".page-header-actions .el-button--primary",
      ".toolbar .el-button--primary",
      ".filter-bar .el-button",
      ".filter-card .el-button",
      ".page-header-actions .el-button",
      ".toolbar .el-button",
    ],
    card: "§三.A.4",
    expect: "either",
    gate: ["height", "padding", "borderRadius", "backgroundColor", "color", "fontSize", "gap"],
  },
  {
    key: "tableWrap",
    label: "表格外框卡",
    // 原型的「外框」就画在表格本体上（L269 `.wb-tbl{border:1px solid var(--line);border-radius:13px(⇒V16 14);
    // border-collapse:separate;border-spacing:0}`），`.s-twrap`（L770）只是 `overflow-x:auto` 的滚动壳，
    // 既无描边也无圆角 —— 拿它当外框量会恒得 0 圆角 + currentColor 描边。
    // 实现侧 13B 已把同一圈外框**从包装卡移到表格本体**（styles.css §三 段）：
    //   ① 与原型同层 ⇒ 宽度不再因「框在卡上、表在框内」少 2px；② 分页条回到框外（原型 .s-pg 就在框外）。
    // ⇒ 两侧都取带框的那层（原型 table.wb-tbl ⇄ 实现 .table-card .el-table）。
    proto: ["table.wb-tbl", ".s-twrap"],
    impl: [".table-card .el-table", ".el-table", "[data-testid='page-table-card']"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "board", "print", "detail", "order"],
    gate: ["x", "y", "width", "padding", "borderRadius", "backgroundColor", "borderTopColor", "marginBottom"],
  },
  {
    key: "table",
    label: "数据表格",
    proto: "table.wb-tbl",
    impl: [".el-table", "table.data-table"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "board", "print", "detail", "order"],
    // 门里**不放 fontSize/color/width**，理由（实测两侧同源）：
    // ① 原型把表格字号写在 th/td 上（L271-272，11.5⇒11 / 12.5⇒12），`table` 本体只继承 body 的 16px；
    //    实现侧 EP 必须在 `.el-table` 根上写 12px 才能级联到单元格 ⇒ 量本体恒得「16 vs 12」的口径假红。
    //    真实字号由 tableHeadCell/tableCell 两行逐字门把关。
    // ② width 由 tableWrap（同一带框层）把关，这里重复一次只会把 1px 边框归属算两遍。
    // ③ borderCollapse 是原型 L269 的硬口径（separate + spacing 0），EP 默认 separate ⇒ 可逐字比。
    gate: ["borderCollapse", "backgroundColor"],
  },
  {
    key: "tableHeadCell",
    label: "表头单元格",
    proto: ".wb-tbl thead th",
    impl: [".el-table__header th", ".wb-tbl thead th"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "board", "print", "detail", "order"],
    // itemCount 在表头即「列数」——原型表头是设计口径，列数必须逐字对齐（卡 §三.A.4）。
    // countScope:"table" ⇒ 只数**首个命中单元格所在那张表**的表头：原型融合页一页多表（列表 + 若干明细卡），
    // 整页累加会把「别张表的列」算进本页（实测销售单据 27 vs 实现 7，全是别表的列），是假红不是差异。
    countScope: "table",
    gate: ["itemCount", "height", "padding", "fontSize", "fontWeight", "backgroundColor", "color", "borderBottomColor"],
  },
  {
    key: "tableCell",
    label: "表体单元格",
    proto: ".wb-tbl tbody td",
    impl: [".el-table__row td", ".wb-tbl tbody td"],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "board", "print", "detail", "order"],
    // 分隔线口径：原型 L272 `.wb-tbl td{border-top:1px solid var(--line)}` ⇒ 行分隔画在**上边**，
    // 实测原型 td 下边框恒为 none（差异表 proto="none" impl=… 那类假红即来自量错边）。
    // ⇒ 门禁改量 borderTopColor（两侧真实的分隔线），断言数量不减。
    gate: ["height", "padding", "fontSize", "color", "borderTopColor"],
  },
  {
    key: "pagination",
    label: "分页条",
    proto: ".s-pg",
    // 原型 `.s-pg` 是**整条分页宿主**（左「共 N 条」+ 右按钮，space-between，L771），不是里面的按钮；
    // 实现侧同层的宿主有三写法：视图自绘 `.table-card-footer` / `.pagination-bar`，
    // 以及共享组件 DataTable.vue 的 `.pagination-wrapper`（`.el-pagination` 只是宿主内的控件），
    // 取宿主才与原型同尺 —— 取控件会把「控件宽=按钮总和」当成「分页条宽=整行」比出假红。
    // 实现侧同层的宿主有六种命名（逐类取自 src/views 实测计数，只认两三种会把其余页面误读成视图自己的皮肤）：
    // `.pagination`×21（主流）、视图自绘 `.table-card-footer` / `.pagination-bar` / `.pagination-area` /
    // `.product-pagination` / `.preview-pagination`，以及共享组件 DataTable.vue 的 `.pagination-wrapper`。
    // （`.el-pagination` 只是宿主内的控件，取控件会把「按钮总和宽」当成「分页条整行宽」比出假红。）
    impl: [
      ".pagination",
      ".pagination-bar",
      ".pagination-area",
      ".pagination-wrapper",
      ".product-pagination",
      ".preview-pagination",
      ".table-card-footer",
      ".el-pagination",
      "[data-testid='page-pagination']",
    ],
    card: "§三.A.4",
    expect: "either",
    types: ["list", "fuse", "board", "order"],
    gate: ["x", "y", "width", "height", "gap", "padding", "fontSize", "borderTopColor"],
  },
  {
    key: "pageCard",
    label: "信息卡（表单/板块容器）",
    proto: [".s-fc", ".fc"],
    impl: [".el-card", ".form-card", "[data-testid='page-card']"],
    card: "§三.A.4",
    expect: "either",
    types: ["form", "fuse", "print", "detail"],
    gate: ["y", "width", "padding", "borderRadius", "backgroundColor", "borderTopColor", "marginBottom"],
  },
  {
    key: "pageCardHead",
    label: "信息卡标题行",
    proto: [".s-fc-hd", ".fc-hd"],
    impl: [".el-card__header", ".form-card-header", ".s-fc-hd"],
    card: "§三.A.4",
    expect: "either",
    types: ["form", "fuse", "print", "detail"],
    gate: ["height", "padding", "fontSize", "fontWeight", "borderBottomWidth", "borderBottomColor"],
  },
  {
    key: "formField",
    label: "表单字段",
    proto: [".fld", ".s-fi"],
    // 宿主顺序＝**先角色后泛用**：`.el-form-item` 同时是「筛选条里的一个字段」（内联表单）和
    // 「表单页的一个字段」（块级表单）。原型差异表的 formField 比的是块级字段（`.fld` 187 宽 / margin 0），
    // 拿内联表单的筛选字段去比会把功能面（筛选）当版式面（表单）读 ⇒ 先只认非内联表单，
    // 再认原型的 `.fld`，最后才回落到裸 `.el-form-item`（只有内联表单的页面仍要有一条字段读数）。
    impl: [".el-form:not(.el-form--inline) .el-form-item", ".fld", ".el-form-item"],
    card: "§三.A.4",
    expect: "either",
    types: ["form", "fuse"],
    gate: ["width", "height", "marginBottom", "fontSize", "gap"],
  },
  {
    key: "formActions",
    label: "表单动作条",
    proto: ".acts-bar",
    impl: [".acts-bar", ".form-actions", "[data-testid='page-form-actions']"],
    card: "§三.A.4",
    expect: "either",
    types: ["form"],
    gate: ["y", "height", "gap", "padding", "borderTopColor"],
  },
  {
    key: "boardGrid",
    label: "看板三栏网格",
    proto: ".s-g3",
    impl: [".s-g3", ".board-container", ".board-grid", ".el-row"],
    card: "§三.A.4",
    expect: "either",
    types: ["board", "fuse"],
    gate: ["y", "width", "gap", "gridColumns"],
  },
  {
    key: "boardCard",
    label: "看板焦点卡",
    proto: ".s-focus",
    // 角色对齐：原型 L3149 的看板是「`.s-g3` 网格 + 三张 `.s-focus` 列卡」，
    // 实现侧 OrderBoardView 是「`.board-container` 行 + `.board-column` 列卡」⇒ 列卡对列卡。
    // `.board-card` 只是页面包装壳（画布 §6b 已退透明），排在列卡之后兜底；`.el-card` 是泛用容器放最后。
    impl: [".s-focus", ".board-column", ".board-card", ".el-card"],
    card: "§三.A.4",
    expect: "either",
    types: ["board", "fuse"],
    gate: ["width", "padding", "borderRadius", "backgroundColor", "borderTopColor"],
  },
  {
    key: "chart",
    label: "图表块",
    proto: ".s-chart",
    // 原型的图表块 = 带 14×15 内边距 + 14 圆角 + 白底的**容器**（L801 .s-chart）。
    // 实现侧 `canvas` 只是容器里的画布本体（padding 恒 0、无圆角、透明底）⇒ 拿它当同一层读数
    // 必然得到「992 vs 488 / 圆角 0」的假差。容器类名先进清单，canvas 留作最后回落。
    impl: [".s-chart", ".chart-container", ".chart-card", ".chart-box", ".chart", "[data-testid='page-chart']", "canvas"],
    card: "§三.A.4",
    expect: "either",
    types: ["board", "fuse"],
    gate: ["y", "width", "height", "padding", "borderRadius", "backgroundColor"],
  },
  {
    key: "sectionTitle",
    label: "页内板块标题",
    proto: ".s-sec",
    impl: [".s-sec", ".wb-sec", ".el-divider__text"],
    card: "§三.A.4",
    expect: "either",
    types: ["board", "fuse", "print", "detail"],
    gate: ["y", "height", "fontSize", "fontWeight", "marginBottom", "gap"],
  },
  {
    key: "emptyState",
    label: "空态（暂无数据）",
    proto: ".v17-empty",
    impl: [".v17-empty", ".el-empty", ".empty-state", ".empty-tip", "[data-testid='page-empty']"],
    card: "§三.C",
    expect: "either",
    gate: ["y", "width", "height", "fontSize", "color"],
  },
];

/** 版式 ⇒ 该页应然的区域顺序（卡 §三.A.4「纵向节奏」）；只比对两侧共有的区域 */
export const PAGE_RHYTHM_BY_TYPE = {
  list: ["dockInfo", "statistics", "filterBar", "tableWrap", "pagination"],
  fuse: ["dockInfo", "statistics", "filterBar", "tableWrap", "pagination", "pageCard"],
  board: ["dockInfo", "statistics", "boardGrid", "chart", "tableWrap", "pagination"],
  form: ["dockInfo", "pageCard", "formActions"],
  detail: ["dockInfo", "pageCard", "sectionTitle", "tableWrap"],
  print: ["dockInfo", "sectionTitle", "tableWrap", "pageCard"],
  order: ["dockInfo", "filterBar", "pageCard", "formActions"],
  bill: ["dockInfo", "statistics", "filterBar", "tableWrap"],
  pos: [],
};

/** 该区域是否适用于给定版式（types 缺省=全部适用） */
export function regionApplies(region, panelType) {
  if (!region.types || region.types.length === 0) return true;
  return region.types.includes(panelType);
}

/** 取某版式的契约子集（顺序保持，便于差异表逐行读） */
export function contractFor(panelType) {
  return PAGE_CONTRACT.filter((r) => regionApplies(r, panelType));
}

/** 字体层级读数（卡 §三.A.4「字体层级」）：角色 → 选择器，两侧同角色逐字节比 */
export const FONT_ROLES = [
  // `scope:"shell"`：两侧页面标题都渲染在**顶栏**（`#topTitle` / `.wb-top .wb-top-title`），
  // 不在页体根容器里 ⇒ 必须按整屏口径取，否则实现侧（关闭文档兜底）永远读不到。
  { role: "pageTitle", scope: "shell", proto: "#topTitle", impl: [".wb-top .wb-top-title"] },
  // 角色宿主必须与契约区域（sectionTitle）同一套别名：`.page-desc` 是**页标题下的说明文字**（12/400/#6D6D6D），
  // 原型 `.s-sec` 是**页内板块标题**（13/800/--ink）⇒ 拿它当对应元素比，产出的是「假红字体差」，不是对齐证据。
  { role: "sectionTitle", proto: ".s-sec", impl: [".s-sec", ".wb-sec", ".el-divider__text"] },
  // StatBar.vue 的数值/标签类名是 `.stat-bar-value` `.stat-bar-label`（与 `.stat-value` 不同名），
  // 画布内已按 styles.css §4b 压到原型的 20px/800 与 11px 口径 ⇒ 角色别名必须列全，否则读到兜底容器 `.stat-item` 的 16px。
  { role: "statValue", proto: ".wb-kpi .v", impl: [".stat-item .v", ".stat-value", ".stat-bar-value", ".stat-grid-value", ".stat-item"] },
  { role: "statLabel", proto: ".wb-kpi .l", impl: [".stat-item .l", ".stat-label", ".stat-bar-label", ".stat-grid-label"] },
  { role: "tableHead", proto: ".wb-tbl thead th", impl: [".el-table__header th"] },
  { role: "tableCell", proto: ".wb-tbl tbody td", impl: [".el-table__row td"] },
  // 正文字号取页面根容器本身（业务页根类不统一，见 pageRoot 的注释）⇒ 用采集器的 `__ROOT__`
  { role: "body", proto: "#wbBody", impl: ["__ROOT__", ".page"] },
];

/* ────────────────────────── 差异表（与 F2a 同一归一/容差口径） ────────────────────────── */

/**
 * 书面解释的取值口径（三种写法，处置力度递增）：
 *   字符串                              ⇒ 无条件解释（该指标本来就只在「同一层宿主」可比，绝对位置类就属于这类）
 *   {text,maxAbsDelta}                  ⇒ **带上限**的解释：仅当超容差幅度 ≤maxAbsDelta 才算解释过，越界自动回到判红。
 *   {text,owner,disposition:"blocked"}  ⇒ **待裁定**：差值确实存在，但改它要动本单禁区（后端字段／业务列数／视图结构），
 *                                          `owner` 必须写清由谁裁定、归哪一单继续；缺 owner ⇒ 视为没处置，照旧判红（fail-closed）。
 *   三者可与 maxAbsDelta 组合：幅度在上限内按「已解释」，超出上限按「待裁定」。
 * 上限这一档是防「一条泛化说明把 270px 的分栏布局差说成 17px 的卡片内衬差」⇒ 解释自己声明适用范围，
 * 超出范围的大偏差仍然是红，不会因为同一指标写过说明就被吞掉。
 */
export function resolveNote(raw, delta = null) {
  const text = typeof raw === "string" ? raw : raw?.text ?? "";
  const empty = { text: "", applies: false, disposition: null, owner: "" };
  if (!text) return empty;
  const isObj = raw && typeof raw === "object";
  const owner = String(isObj ? raw.owner ?? "" : "").trim();
  const wantsBlocked = isObj && raw.disposition === "blocked";
  // 待裁定必须带归属：没有「由谁裁定／归哪一单」的 blocked 等于没处置 ⇒ 落回判红，不给静默绿灯
  if (wantsBlocked && !owner) return { ...empty, text };
  const disposition = wantsBlocked ? "blocked" : "explained";
  const d = delta === null || Number.isNaN(Number(delta)) ? null : Math.abs(Number(delta));
  const cap = isObj ? raw.maxAbsDelta : null;
  if (cap == null) return { text, applies: true, disposition, owner };
  // 带幅度上限：上限内＝已解释；越界＝按声明的处置走（blocked 有主 ⇒ 待裁定，否则判红）
  if (d !== null && d <= Number(cap)) return { text, applies: true, disposition: "explained", owner };
  return wantsBlocked
    ? { text, applies: true, disposition: "blocked", owner }
    : { text, applies: false, disposition: null, owner };
}

/**
 * 偏差说明文件的四级作用域合并，**越具体越优先**：
 *   "*"  →  "<module>/*"  →  "<module>/<page>@*"（两档视口共用）  →  "<module>/<page>@<vp>"（= pairId）
 * 早先的实现把 pairId 夹在 module/* 之前 ⇒ 逐页说明会被同名的模块级说明覆盖掉，写进去的理由并不生效（说明层假绿）。
 */
export function mergeDeviationNotes(scopes = {}, { moduleKey = "", pairId = "" } = {}) {
  const pageWildcard = pairId.includes("@") ? `${pairId.slice(0, pairId.lastIndexOf("@"))}@*` : "";
  return {
    ...(scopes["*"] ?? {}),
    ...(scopes[`${moduleKey}/*`] ?? {}),
    ...(pageWildcard ? scopes[pageWildcard] ?? {} : {}),
    ...(scopes[pairId] ?? {}),
  };
}

/**
 * 逐区域逐指标差异表。行形状与 F2a 完全一致，便于同一套人读工具消费。
 * verdict：match / off-spec / explained / blocked / exempted / recorded / n/a / missing
 *   missing   —— expect=both 且 required 侧缺席 ⇒ 判红
 *   off-spec  —— 门禁指标超容差且无书面解释 ⇒ 判红
 *   explained —— 超容差但差值来自内容量／既有结构，且解释在声明的幅度范围内
 *   blocked   —— 超容差且改它要动本单禁区，书面写明「由谁裁定／归哪一单」（owner 必填）⇒ 不计红、不计绿，逐条列进待裁定
 *   exempted  —— 区域带书面豁免（expect 非 both 的结构差异）⇒ 不判红但必须留在表里
 */
export function buildPageDiffTable(proto = {}, impl = {}, notes = {}, contract = PAGE_CONTRACT) {
  const rows = [];
  for (const region of contract) {
    const p = proto?.[region.key];
    const i = impl?.[region.key];
    const pPresent = p?.exists === true;
    const iPresent = i?.exists === true;
    const expect = region.expect ?? "both";
    if (!pPresent || !iPresent) {
      const noteObj = resolveNote(notes[`${region.key}.presence`] ?? region.exemptNote);
      const note = noteObj.text;
      let verdict;
      if (!pPresent && !iPresent) {
        // 两侧都没有：该版式本就不含这个部位（如表单页没有表格）⇒ 记录，不判红
        verdict = "n/a";
      } else if ((expect === "proto-only" && !iPresent) || (expect === "impl-only" && !pPresent)) {
        // 一侧独有的是**设计口径**（原型对接信息条 / 实现页内标题块）⇒ 豁免但必须留在表里
        verdict = "exempted";
      } else if (expect === "either") {
        // 版式相关：一侧有另一侧没有是本单已确认的版式差异（卡片/内联表单宿主不同）⇒ 按契约定义「缺一不判红」
        verdict = "exempted";
      } else if (noteObj.applies) {
        verdict = noteObj.disposition;
      } else {
        verdict = MISSING_IS_FATAL ? "missing" : "n/a";
      }
      rows.push({
        region: region.key,
        label: region.label,
        card: region.card,
        metric: "presence",
        prototype: pPresent ? "present" : "absent",
        impl: iPresent ? "present" : "absent",
        delta: null,
        tolerance: 0,
        gated: verdict === "missing" || verdict === "explained",
        verdict,
        owner: verdict === "blocked" ? noteObj.owner : "",
        note,
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
      const noteObj = resolveNote(
        notes[`${region.key}.${metric}`] ?? notes[`${region.key}.*`],
        delta,
      );
      const offTol = gated && !withinTol;
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
        verdict: offTol ? (noteObj.applies ? noteObj.disposition : "off-spec") : gated ? "match" : "recorded",
        owner: offTol && noteObj.disposition === "blocked" ? noteObj.owner : "",
        note: offTol && noteObj.applies ? noteObj.text : "",
      });
    }
  }
  return rows;
}

/** 判红行（missing / off-spec） */
export function findPageOffSpec(rows = []) {
  return rows.filter((r) => r.verdict === "missing" || r.verdict === "off-spec");
}

/** 超容差但已书面解释的行 */
export function findPageExplained(rows = []) {
  return rows.filter((r) => r.verdict === "explained");
}

/** 超容差且明确「本单不改」的行：卡 §三.A.7 的 blocked 处置，必须带 owner，逐条进回传待裁定 */
export function findPageBlocked(rows = []) {
  return rows.filter((r) => r.verdict === "blocked");
}

/** 结构性豁免行（原型独有 / 实现独有 / 版式相关） */
export function findPageExempted(rows = []) {
  return rows.filter((r) => r.verdict === "exempted");
}

/** 门禁一致率（写回传卡，不参与判红） */
export function pageGatedStats(rows = []) {
  const gated = rows.filter((r) => r.gated && r.metric !== "presence");
  return {
    gated: gated.length,
    exact: gated.filter((r) => r.prototype === r.impl).length,
    withinTolerance: gated.filter((r) => r.verdict === "match" || r.verdict === "explained").length,
    offSpec: gated.filter((r) => r.verdict === "off-spec").length,
    // 待裁定单独计数：既不算「一致」也不算「红」，回传卡要逐条列出去向
    blocked: gated.filter((r) => r.verdict === "blocked").length,
    maxAbsDelta: gated.reduce((m, r) => Math.max(m, Math.abs(r.delta ?? 0)), 0),
  };
}

/**
 * 纵向节奏：两侧各按区域 top 排序，取共有区域序列比较（卡 §三.A.4）。
 * 只比共有区域 —— 原型独有的对接条、实现独有的分页都已在差异表里单独判定，
 * 混进序列只会得到「数量不等」的假节奏差。
 * 也只比**流程里的兄弟块** —— 纵向包住了另一块的层是宿主/包装壳（卡片把筛选条整条包住），
 * 它的 top 是外壳的位置而不是「这一屏的顺序」，计入会把结构层差误报成节奏差。
 */
export function findPageRhythmViolations(readings = {}, panelType = "list") {
  const yOf = (k) => readings?.[k]?.metrics?.y;
  const hOf = (k) => Number(readings?.[k]?.metrics?.height) || 0;
  const want = (PAGE_RHYTHM_BY_TYPE[panelType] ?? []).filter((k) => readings?.[k]?.exists === true && Number.isFinite(yOf(k)));
  // 包装壳不进序列：把筛选表单/表格包在卡片里的那几页（供应商管理、采购付款…），卡片本体的 y 天然在
  // 它包住的条/表之上，但量到的是**宿主层**而不是流程里的兄弟块 ⇒ 与「先后顺序」无关。
  // 判定只看纵向包住（含等高的同层不算）：真正摆错位置、又不包住任何块的卡片照旧被抓。
  const wraps = (a, b) => a !== b && yOf(a) <= yOf(b) + 0.5 && yOf(a) + hOf(a) >= yOf(b) + hOf(b) - 0.5 && hOf(a) > hOf(b);
  const seq = want.filter((a) => !want.some((b) => wraps(a, b)));
  // 以 top 升序重建「共有且应然」的子序列
  const actual = seq.map((key) => ({ key, y: yOf(key) })).sort((a, b) => a.y - b.y).map((e) => e.key);
  const expected = seq;
  if (actual.join(">") === expected.join(">")) return [];
  return [{ panelType, expected: expected.join(" > "), actual: actual.join(" > ") }];
}

/** 字体层级差（逐字节比 fontSize/fontWeight/color；差值>0 即列出门禁项） */
export function findFontHierarchyViolations(proto = {}, impl = {}) {
  const out = [];
  for (const role of FONT_ROLES) {
    const p = proto?.[role.role];
    const i = impl?.[role.role];
    if (!p || !i || p.exists !== true || i.exists !== true) continue;
    for (const metric of ["fontSize", "fontWeight", "color"]) {
      const pv = normalizeMetric(metric, p[metric]);
      const iv = normalizeMetric(metric, i[metric]);
      if (pv === "" || iv === "") continue;
      if (pv !== iv) out.push({ role: role.role, metric, prototype: pv, impl: iv });
    }
  }
  return out;
}

/**
 * 节奏差 / 字体差也是「差异」⇒ 必须走与差异表同一套 修复 / 豁免 / 阻断 处置（卡 §三.A.7），
 * 否则它们只能在门禁里硬红：回传时既没有书面去向，也没有 owner，验收方看不出这条差归谁。
 * 行形状与 buildPageDiffTable 一致（region / metric / prototype / impl / verdict / owner / note），
 * 采集器把它们并进 diff.rows ⇒ 判红、已解释、待裁定三档自动汇总，门禁只按 verdict 出红。
 * 说明键：`rhythm.order.<side>`、`font.<role>.<metric>`（也可写 `font.<role>.*`）；
 * delta 恒为 null ⇒ 这两类不是长度差，只能写无条件解释或带 owner 的待裁定，写 maxAbsDelta 无意义
 * （resolveNote 对 null delta 会按「越界」处理 ⇒ fail-closed，不会因写了上限就吞掉）。
 */
export function buildRhythmRows(violations = [], notes = {}) {
  return (violations ?? []).map((v) => {
    const metric = `order.${v.side ?? "implementation"}`;
    const noteObj = resolveNote(notes[`rhythm.${metric}`] ?? notes["rhythm.*"]);
    return {
      region: "rhythm",
      label: `纵向节奏（${v.side ?? "implementation"} · ${v.panelType ?? "list"}）`,
      card: "卡 §三.A.4 纵向节奏",
      metric,
      prototype: v.expected,
      impl: v.actual,
      delta: null,
      tolerance: 0,
      gated: true,
      verdict: noteObj.applies ? noteObj.disposition : "off-spec",
      owner: noteObj.disposition === "blocked" && noteObj.applies ? noteObj.owner : "",
      note: noteObj.applies ? noteObj.text : "",
    };
  });
}

export function buildFontRows(violations = [], notes = {}) {
  return (violations ?? []).map((f) => {
    const noteObj = resolveNote(notes[`font.${f.role}.${f.metric}`] ?? notes[`font.${f.role}.*`] ?? notes["font.*"]);
    return {
      region: "font",
      label: `字体层级 · ${f.role}`,
      card: "卡 §三.A.4 字体层级",
      metric: `${f.role}.${f.metric}`,
      prototype: f.prototype,
      impl: f.impl,
      delta: null,
      tolerance: 0,
      gated: true,
      // 字体面逐字节（TOLERANCE.color=0、长度不进这里）⇒ 出现差行本身就是超口径，只有书面处置能让它不红
      verdict: noteObj.applies ? noteObj.disposition : "off-spec",
      owner: noteObj.disposition === "blocked" && noteObj.applies ? noteObj.owner : "",
      note: noteObj.applies ? noteObj.text : "",
    };
  });
}

/**
 * 状态签名的「主结构区」清单（按版式）。
 * 只收两侧**应当同有同无**的部位 ⇒ 签名相等才证明两张帧拍的是同一页面的同一状态；
 * 原型独有的对接条、实现独有的页内标题块属于结构性豁免，由差异表判，不进签名位向量
 * （否则每一页都会因为同一口径差而假红，签名就失去信号量）。
 */
export const PAGE_SIGNATURE_REGIONS = {
  list: ["pageRoot", "pageTitle", "statistics", "filterBar", "tableWrap", "table", "tableHeadCell", "tableCell", "pagination"],
  fuse: ["pageRoot", "pageTitle", "statistics", "filterBar", "tableWrap", "table", "pagination", "pageCard"],
  board: ["pageRoot", "pageTitle", "statistics", "boardGrid", "table", "pagination"],
  form: ["pageRoot", "pageTitle", "pageCard", "formField", "formActions"],
  detail: ["pageRoot", "pageTitle", "pageCard", "sectionTitle", "tableWrap"],
  print: ["pageRoot", "pageTitle", "sectionTitle", "tableWrap", "pageCard"],
  order: ["pageRoot", "pageTitle", "filterBar", "pageCard"],
  bill: ["pageRoot", "pageTitle", "statistics", "filterBar", "tableWrap"],
  pos: ["pageRoot", "pageTitle"],
};

/**
 * 逐页状态签名：视口 + 模块 + 页面 + 版式 + 活跃浮层数 + 主结构区「在场且可见」位向量。
 * 与 F3 §三.A.3 同一思路（由读数经同一函数派生、门禁可复算、写进 figcaption ⇒ 进 PNG 证据）。
 */
export function pageStateSignature(readings = {}, { viewport = "", moduleKey = "", pageKey = "", panelType = "list", overlays = null } = {}, contract = PAGE_CONTRACT, { sharedOnly = false } = {}) {
  const expectOf = (k) => contract.find((r) => r.key === k)?.expect ?? "both";
  const keys = (PAGE_SIGNATURE_REGIONS[panelType] ?? [])
    .filter((k) => contract.some((r) => r.key === k))
    // sharedOnly ⇒ 只保留「两侧应同有同无」的部位（expect=both）。
    // expect=either 的版式相关部位（KPI 区、分页、表体单元格、信息卡）本就可能一侧有一侧无
    // —— 那已经在差异表里按「缺一不判红」豁免；若再进签名相等面，每页都会因同一口径差判「状态不符」，
    // 签名就失去「两张帧是不是同一页同一状态」的信号量（只剩噪声）。完整位向量仍然逐侧入证据。
    .filter((k) => !sharedOnly || expectOf(k) === "both");
  const bits = keys.map((k) => {
    const reg = readings?.[k] ?? {};
    return `${k}:${reg.exists === true && reg.visible !== false ? 1 : 0}`;
  });
  return `vp=${viewport}|mod=${moduleKey}|page=${pageKey}|type=${panelType}|ov=${overlays}|${bits.join("|")}`;
}

/* ────────────────────────── 覆盖与采集完整性 ────────────────────────── */

/** 每模块每视口至少 1 页、每模块至少 1 页两档都采（卡 §三.A.3） */
export function findCoverageGaps(pairs = [], { modules, viewports, minPagesPerModuleViewport = 1 } = {}) {
  const out = [];
  for (const m of modules) {
    for (const vp of viewports) {
      const n = pairs.filter((p) => p.moduleKey === m.key && p.viewport === vp.id && p.status === "captured").length;
      if (n < minPagesPerModuleViewport) {
        out.push({ moduleKey: m.key, moduleName: m.name, viewport: vp.id, captured: n, need: minPagesPerModuleViewport });
      }
    }
  }
  return out;
}

/**
 * 帧去重：同一 PNG 不得同时充当多档/多页证据（卡 §三.A.3「每档不得复用同一帧」）。
 * 分组口径直接复用 uiux-scenarios-lib 的 findDuplicateHashes（按 viewport|sha 分组、
 * 忽略辅助帧），只是把「场景名」换成「配对/侧面」⇒ 与 F2a/F3 同一把尺子。
 */
export function findReusedFrames(frames = []) {
  const scenes = frames
    .filter((f) => f?.sha256)
    .map((f) => ({ scene: `${f.pair ?? f.file}|${f.side ?? "shot"}`, sha256: f.sha256, viewport: f.viewport ?? "" }));
  const groups = findDuplicateHashes(scenes);
  const dupHashes = new Set(groups.map((g) => g.sha256));
  return frames.filter((f) => dupHashes.has(f.sha256));
}

/**
 * 采集器 bundle 的机器门禁（专项测试只读这里，不接受采集器自我声明通过）。
 * 判红面：采集未完成 / 区域缺失 / 门禁指标超容差 / 帧复用 / 覆盖缺口 / 状态签名不符 / 注入态当生产态。
 */
export function collectModuleParityViolations(bundle = {}) {
  const out = [];
  const pairs = bundle.pairs ?? [];
  if (bundle.aborted) out.push({ kind: "aborted", reason: `采集器异常中止：${String(bundle.aborted).slice(0, 200)}` });

  for (const p of pairs) {
    if (p.status === "blocked") {
      if (!p.block?.reason || !p.block?.owner || !p.block?.followUp) {
        out.push({ kind: "blocked-incomplete", pair: p.id, reason: `BLOCKED 缺 reason/owner/followUp 之一（卡 §三.B.4 诚实阻断口径）` });
      }
      continue;
    }
    if (p.status !== "captured") {
      out.push({ kind: "not-captured", pair: p.id, reason: `页面配对状态为 ${p.status}，既未采集也未诚实阻断` });
      continue;
    }
    const rows = p.diff?.rows ?? [];
    if (rows.length === 0) out.push({ kind: "empty-diff", pair: p.id, reason: "差异表为空：没有可比读数" });
    for (const r of findPageOffSpec(rows)) {
      out.push({ kind: "off-spec", pair: p.id, region: r.region, metric: r.metric, prototype: r.prototype, impl: r.impl, delta: r.delta, tolerance: r.tolerance, card: r.card });
    }
    /* 节奏 / 字体差的判红口径改由差异表的处置行说话（buildRhythmRows / buildFontRows 并进 diff.rows）：
       · 有处置行 ⇒ 红不红取决于 verdict（已在上面 findPageOffSpec 出过），这里不再重复计一条，
         否则同一条差会既算 off-spec 又算 rhythm，门禁数虚高。
       · 没有处置行（处置通道上线之前采的旧片）⇒ 照旧直接判红，fail-closed 不给静默绿灯。 */
    const rowFor = (region, metric) => rows.find((r) => r.region === region && r.metric === metric);
    for (const f of p.rhythm ?? []) {
      if (!rowFor("rhythm", `order.${f.side ?? "implementation"}`)) out.push({ kind: "rhythm", pair: p.id, expected: f.expected, actual: f.actual, panelType: f.panelType });
    }
    for (const f of p.fonts ?? []) {
      if (!rowFor("font", `${f.role}.${f.metric}`)) out.push({ kind: "font", pair: p.id, role: f.role, metric: f.metric, prototype: f.prototype, impl: f.impl });
    }
    if (p.implementation?.overflowX > 0) out.push({ kind: "overflow", pair: p.id, side: "implementation", overflowX: p.implementation.overflowX });
    if (p.prototype?.overflowX > 0) out.push({ kind: "overflow", pair: p.id, side: "prototype", overflowX: p.prototype.overflowX });
    if (p.signatures?.equal !== true) {
      out.push({ kind: "signature", pair: p.id, prototype: p.signatures?.shared?.prototype ?? p.signatures?.prototype, impl: p.signatures?.shared?.implementation ?? p.signatures?.implementation, note: "两侧状态签名不符（§三.A.3：同视口·同页面·零活跃浮层·同有同无面逐位相等）" });
    }
    if (p.shots?.prototype?.sha256 && p.shots?.implementation?.sha256 && p.shots.prototype.sha256 === p.shots.implementation.sha256) {
      out.push({ kind: "identical-shots", pair: p.id, reason: "并排两张帧逐字节相同：至少一侧未真实渲染" });
    }
    if (p.implementation?.uiuxInject && !["absent", "off", "false"].includes(String(p.implementation.uiuxInject).toLowerCase())) {
      out.push({ kind: "injection", pair: p.id, reason: `实现侧证据带 UIUX 注入态（data-uiux-inject=${p.implementation.uiuxInject}）：注入态不得作生产视觉证据` });
    }
    /* 卡 §三.A.3「页面口径」+ §三.B fail-closed：读数必须落在业务页根内。
       rootSel 未命中时采集器会退回整屏口径（readScope 记 null），那种差异表的基准是「整个工作台」，
       拿它当逐页证据会把壳层容器算进页面区块 ⇒ 一律判红，不接受「已经点进该页」的口头声明。 */
    if (p.implementation?.readScope == null) {
      out.push({ kind: "scope-fallback", pair: p.id, reason: `实现侧读数未落在业务页根（readScope=null；${String(p.implementation?.readScopeFallback ?? "").slice(0, 60)}）⇒ 整屏口径不作页面证据` });
    }
    if (p.implementation?.paintGate && p.implementation.paintGate.ok !== true) {
      out.push({ kind: "paint-gate", pair: p.id, reason: `出帧行为门不过（${JSON.stringify(p.implementation.paintGate).slice(0, 180)}）` });
    }
    /* 卡 §三.A.4：进入模块页后，一级 rail 该模块项必须真的处于选中态（实现侧沿用 F2/F3 的实色主蓝口径） */
    const rs = p.railSelected;
    if (rs) {
      if (rs.implementation && rs.implementation.on !== true) out.push({ kind: "rail-not-selected", pair: p.id, side: "implementation", reason: `进入 ${p.moduleKey} 页面后一级栏该模块项没有 .on` });
      if (rs.prototype && rs.prototype.on !== true) out.push({ kind: "rail-not-selected", pair: p.id, side: "prototype", reason: `进入 ${p.moduleKey} 页面后原型一级栏该项没有 .on` });
      if (rs.implementation && rs.implementation.backgroundColor !== rs.expectBackground) {
        out.push({ kind: "rail-selected-color", pair: p.id, metric: "backgroundColor", expected: rs.expectBackground, actual: rs.implementation.backgroundColor, reason: "选中态主蓝与 F2/F3 已验收口径不符" });
      }
      if (rs.implementation && rs.implementation.color !== rs.expectForeground) {
        out.push({ kind: "rail-selected-color", pair: p.id, metric: "color", expected: rs.expectForeground, actual: rs.implementation.color, reason: "选中态前景色与 F2/F3 已验收口径不符" });
      }
    }
  }

  const reused = findReusedFrames(pairs.flatMap((p) => [p.shots?.prototype, p.shots?.implementation].filter(Boolean)));
  if (reused.length) {
    for (const f of reused) out.push({ kind: "reused-frame", file: f.file, sha256: f.sha256, reason: "同一 PNG 被当作多份证据（卡 §三.A.3）" });
  }
  const gaps = findCoverageGaps(pairs, { modules: bundle.modules ?? [], viewports: bundle.viewports ?? PAGE_VIEWPORTS });
  for (const g of gaps) out.push({ kind: "coverage", moduleKey: g.moduleKey, viewport: g.viewport, reason: `模块 ${g.moduleName} 在 ${g.viewport} 档只有 ${g.captured} 页（需 ≥${g.need}）` });

  const needModules = bundle.requiredModules ?? [];
  const doneModules = [...new Set(pairs.filter((p) => p.status === "captured").map((p) => p.moduleKey))];
  for (const m of needModules) if (!doneModules.includes(m)) out.push({ kind: "module-missing", moduleKey: m, reason: `该业务模块没有任何一页完成并排采集` });

  return out;
}
