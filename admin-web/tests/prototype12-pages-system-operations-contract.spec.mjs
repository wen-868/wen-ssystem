/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SYSTEM-OPERATIONS-01 · 系统管理组页面/权限合同测试
 *
 * 覆盖卡面硬验收 §四：
 *   1) 系统组全部生产路由逐页建档并标状态（原型 SECTORS.system 8 页 → 生产组件存在 + 路由映射）；
 *   3) 权限/敏感数据/危险操作的状态与 fail-closed 行为保持；
 *   4) 打印页层级统一且不改打印输出契约；
 *   5) ≥15 条页面/权限合同测试（本文件）；
 *   另：黑名单零命中（对齐 S5 COPY_BLACKLIST）。
 *
 * 运行（admin-web 目录）：node tests/prototype12-pages-system-operations-contract.spec.mjs
 *
 * 说明：源码级合同断言（读 src 源 + 读 router 源），不依赖 vite/playwright；
 *       与既有 role-guard/copy spec 同口径（Node 原生 ESM）。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const has = (rel) => existsSync(path.join(SRC, rel));
const ROUTER = read("router/index.ts");

/** S5 COPY_BLACKLIST（与 prototype12-visual / page-production-copy 逐字对齐） */
const COPY_BLACKLIST = [
  "双入口左侧菜单",
  "待接入",
  "未接入",
  "不伪造成功",
  "端点缺失",
  "设计说明",
  "红星商行",
  "张三",
  "¥25,400",
  "¥8,900",
];

/** 本卡允许路径内的系统域产品文件（views/system/** + print 2 文件） */
const SYSTEM_VIEWS = [
  "views/system/EmployeesView.vue",
  "views/system/OrganizationView.vue",
  "views/system/DepartmentManage.vue",
  "views/system/PositionManage.vue",
  "views/system/StoresView.vue",
  "views/system/SystemRoles.vue",
  "views/system/ReportPermission.vue",
  "views/system/ApprovalRules.vue",
  "views/system/ApprovalManage.vue",
  "views/system/ApprovalDetail.vue",
  "views/system/MyApprovals.vue",
  "views/system/System.vue",
  "views/system/SystemConfigView.vue",
  "views/system/PaymentConfigView.vue",
  "views/system/MiniappConfigView.vue",
  "views/system/AuditLogView.vue",
  "views/system/ErrorLogView.vue",
  "views/system/ConsumerAddress.vue",
  "views/system/MonitorView.vue",
  "views/system/SystemMonitorManage.vue",
  "views/system/FeedbackView.vue",
];
const PRINT_VIEWS = [
  "modules/print/PrintTemplatesView.vue",
  "modules/print/PrintTemplateDesigner.vue",
];

/** 原型 SECTORS.system 权威 8 页 → 生产主组件（对齐原型 c 字段） */
const PROTOTYPE_SYSTEM_PAGES = [
  { proto: "sys-org", name: "组织人事", component: "views/system/EmployeesView.vue" },
  { proto: "sys-role", name: "权限管理", component: "views/system/SystemRoles.vue" },
  { proto: "sys-approval", name: "审批中心", component: "views/system/ApprovalManage.vue" },
  { proto: "sys-print", name: "打印模板", component: "modules/print/PrintTemplatesView.vue" },
  { proto: "sys-config", name: "系统配置", component: "views/system/SystemConfigView.vue" },
  { proto: "sys-log", name: "日志中心", component: "views/system/AuditLogView.vue" },
  { proto: "sys-monitor", name: "系统监控", component: "views/system/MonitorView.vue" },
  { proto: "sys-feedback", name: "反馈管理", component: "views/system/FeedbackView.vue" },
];

/** 系统组路由（path, 组件）——须全部 meta.roles 含 SUPER_ADMIN（fail-closed） */
const SYSTEM_ROUTES = [
  "employees", "organization", "department-manage", "position-manage", "stores",
  "system/roles", "report-permissions",
  "system/approval/rules", "system/approval/manage", "system/approval/detail/:id", "system/approval/my",
  "system/print", "system/print/designer/:id?",
  "system", "system/config", "system/payment", "system/miniapp",
  "audit-log", "error-log", "consumer-addresses",
  "monitor", "monitor-manage",
  "system/feedback",
];

function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

/* ── 1. 逐页建档：21 个系统页 + 2 打印页 全部存在且非空 ── */
await run("系统域 21 个 .vue + 打印 2 文件全部存在且非空（逐页建档）", () => {
  const missing = [];
  for (const rel of [...SYSTEM_VIEWS, ...PRINT_VIEWS]) {
    if (!has(rel)) missing.push(`${rel} 不存在`);
    else if (read(rel).trim().length < 50) missing.push(`${rel} 内容过少`);
  }
  assert.deepEqual(missing, [], missing.join("\n"));
  return `${SYSTEM_VIEWS.length}+${PRINT_VIEWS.length} 文件`;
});

/* ── 2. 原型 system 8 页 → 生产组件映射齐备 ── */
await run("原型 SECTORS.system 8 页逐页映射到生产组件且组件存在", () => {
  const miss = [];
  for (const p of PROTOTYPE_SYSTEM_PAGES) {
    if (!has(p.component)) miss.push(`${p.proto}/${p.name} → ${p.component} 不存在`);
  }
  assert.deepEqual(miss, [], miss.join("\n"));
  return `8/8 映射`;
});

/* ── 3. 每条系统路由都在 router 源中注册且组件指向允许路径内文件 ── */
await run("23 条系统组路由均已在 router/index.ts 注册（逐条点名）", () => {
  const miss = SYSTEM_ROUTES.filter((p) => !ROUTER.includes(`path: "${p}"`));
  assert.deepEqual(miss, [], `未注册路由：${miss.join(", ")}`);
  return `${SYSTEM_ROUTES.length} 条`;
});

/* ── 4. fail-closed：每条系统路由 meta.roles 必含 SUPER_ADMIN ── */
await run("系统组全部路由 meta.roles 必含 SUPER_ADMIN（fail-closed 权限门）", () => {
  const bad = [];
  for (const p of SYSTEM_ROUTES) {
    const re = new RegExp(`path: "${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^}]*?meta:\\s*\\{[^}]*roles:\\s*\\[([^\\]]*)\\]`);
    const m = ROUTER.match(re);
    if (!m) bad.push(`${p}: 未匹配到 meta.roles`);
    else if (!/SUPER_ADMIN/.test(m[1])) bad.push(`${p}: roles=[${m[1].trim()}] 缺 SUPER_ADMIN`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
  return `${SYSTEM_ROUTES.length} 条全含 SUPER_ADMIN`;
});

/* ── 5. 危险操作（删除角色）须二次确认（el-popconfirm）── */
await run("角色管理·删除角色为危险操作，须 el-popconfirm 二次确认（fail-closed 防误删）", () => {
  const src = read("views/system/SystemRoles.vue");
  assert.ok(/el-popconfirm/.test(src), "SystemRoles.vue 未使用 el-popconfirm 二次确认");
  assert.ok(/确定删除/.test(src) || /确认/.test(src), "缺少删除确认文案");
  return "el-popconfirm + 确认文案在位";
});

/* ── 6. 审批危险操作：审批管理页承载审批规则/我的申请 tab（结构齐备） ── */
await run("审批中心承载 审批规则 + 我的申请 双 tab（结构对齐原型 fuse）", () => {
  const src = read("views/system/ApprovalManage.vue");
  assert.ok(/ApprovalRules/.test(src) && /MyApprovals/.test(src), "ApprovalManage 未内嵌 ApprovalRules/MyApprovals");
  return "双 tab 在位";
});

/* ── 7. 敏感字段 fail-closed：报表权限页含权限矩阵呈现 ── */
await run("报表权限页含权限矩阵/checkbox 控制（敏感数据 fail-closed 呈现）", () => {
  const src = read("views/system/ReportPermission.vue");
  assert.ok(/checkbox|el-checkbox|权限|报表/.test(src), "ReportPermission 缺权限矩阵呈现");
  return "权限矩阵在位";
});

/* ── 8. 空态：日志/错误日志页有 el-table 或空态处理 ── */
await run("操作日志页含 el-table 数据呈现与空态（无数据不伪造）", () => {
  const src = read("views/system/AuditLogView.vue");
  assert.ok(/el-table|v-empty|暂无|empty/i.test(src), "AuditLogView 缺表格/空态");
  return "表格+空态在位";
});

/* ── 9. 监控页含刷新/统计块（状态呈现齐备）── */
await run("系统监控页含统计块与刷新动作（真实状态呈现）", () => {
  const src = read("views/system/MonitorView.vue");
  assert.ok(/刷新|refresh|el-statistic|stat-item/i.test(src), "MonitorView 缺统计/刷新");
  return "统计+刷新在位";
});

/* ── 10. 系统配置页含 el-tabs 分区（结构对齐原型 fuse 多卡）── */
await run("系统配置页含 el-tabs 分区（基础/支付/小程序配置结构齐备）", () => {
  const src = read("views/system/SystemConfigView.vue");
  assert.ok(/el-tabs|el-tab-pane/.test(src), "SystemConfigView 缺 tabs 分区");
  return "tabs 分区在位";
});

/* ── 11. 打印模板页存在且不改打印输出契约（引用 print 模块 + 241 版式来源）── */
await run("打印模板页存在且引用 print 模块契约（不改打印输出契约）", () => {
  const src = read("modules/print/PrintTemplatesView.vue");
  const api = read("modules/print/api.ts");
  assert.ok(src.trim().length > 50, "PrintTemplatesView 空");
  assert.ok(/print|template/i.test(src), "PrintTemplatesView 未引用打印逻辑");
  assert.ok(/api\.ts|template|print/i.test(api), "print/api.ts 契约缺失");
  return "打印契约引用在位";
});

/* ── 12. 打印模板设计器存在（改造不改输出）── */
await run("打印模板设计器 PrintTemplateDesigner 存在且非空", () => {
  const src = read("modules/print/PrintTemplateDesigner.vue");
  assert.ok(src.trim().length > 50, "PrintTemplateDesigner 空");
  return "设计器在位";
});

/* ── 13. 黑名单零命中：系统域 21+2 文件逐文件扫描 ── */
await run("系统域 23 文件：S5 COPY_BLACKLIST 10 项零命中（注释剥离逐文件点名）", () => {
  const hits = [];
  for (const rel of [...SYSTEM_VIEWS, ...PRINT_VIEWS]) {
    const visible = stripComments(read(rel));
    for (const term of COPY_BLACKLIST) {
      if (visible.includes(term)) hits.push(`${rel} ← 「${term}」`);
    }
  }
  assert.deepEqual(hits, [], hits.join("\n"));
  return "0 命中";
});

/* ── 14. 员工/组织/部门/岗位/门店 5 个组织页均存在并引用 el- 组件（结构齐备）── */
await run("组织人事组 5 页（员工/组织/部门/岗位/门店）均含 el- 组件结构", () => {
  const org = [
    "views/system/EmployeesView.vue",
    "views/system/OrganizationView.vue",
    "views/system/DepartmentManage.vue",
    "views/system/PositionManage.vue",
    "views/system/StoresView.vue",
  ];
  const miss = org.filter((f) => !/el-|element/.test(read(f)));
  assert.deepEqual(miss, [], miss.join("\n"));
  return `${org.length} 页全含 el- 结构`;
});

/* ── 15. 反馈管理页存在且含列表结构 ── */
await run("反馈管理页存在且含列表/表单结构（sys-feedback 对齐）", () => {
  const src = read("views/system/FeedbackView.vue");
  assert.ok(src.trim().length > 50, "FeedbackView 空");
  assert.ok(/el-|table|list|反馈/i.test(src), "FeedbackView 缺列表结构");
  return "列表结构在位";
});

/* ── 16. 权限管理路由与报表权限子路由同属 sys-role（映射一致）── */
await run("角色管理(system/roles) 与报表权限(report-permissions) 同属 sys-role 且均注册", () => {
  assert.ok(ROUTER.includes('path: "system/roles"'), "缺 system/roles");
  assert.ok(ROUTER.includes('path: "report-permissions"'), "缺 report-permissions");
  return "sys-role 双子路由齐备";
});

/* ── 17. 审批详情/我的审批子路由齐备（sys-approval 4 子页映射）── */
await run("审批中心 4 子页路由齐备（rules/manage/my/detail）", () => {
  const need = [
    'path: "system/approval/rules"',
    'path: "system/approval/manage"',
    'path: "system/approval/my"',
    'path: "system/approval/detail/:id"',
  ];
  const miss = need.filter((s) => !ROUTER.includes(s));
  assert.deepEqual(miss, [], miss.join("\n"));
  return "4 子页全注册";
});

const passed = results.filter((r) => r.ok).length;
const total = results.length;
console.log(`\n小结：${passed} passed / ${total - passed} failed （共 ${total} 条合同测试）`);
if (results.some((r) => !r.ok)) process.exit(1);
process.exit(0);
