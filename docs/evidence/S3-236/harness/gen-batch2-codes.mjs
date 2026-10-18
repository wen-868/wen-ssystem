#!/usr/bin/env node
/**
 * S3-236 · 立码第二批（四域 38 码）**代码/迁移生成器**
 *
 * 为什么用生成器而不是手抄（2026-10-16 S3-234 的既教训）：38 个码 × 3 处（目录 / 迁移 / 断言）
 * 共 114 个落点，手抄必然错序错字；本文件是**唯一码表真相源**，产物由它逐字生成：
 *   ① `backend/src/shared/report-permission-codes.ts`
 *   ② `backend/src/shared/hardware-permission-codes.ts`
 *   ③ `backend/src/shared/miniapp-permission-codes.ts`
 *   ④ `backend/src/shared/dashboard-permission-codes.ts`
 *   ⑤ `backend/src/shared/batch2-permission-codes.ts`（四域汇总，供断言与门禁）
 *   ⑥ `docs/migrations/207_四域权限点立码.sql`
 *
 * 码表来源（**唯一，禁止自拟**）：`docs/tasks/R101-待立码清单-五域.md` §二
 *   2.1 报表域 11 码 / 2.2 硬件打印域 14 码 / 2.3 小程序域 5 码 / 2.4 工作台域 8 码 = 38 码
 *   （2.2 另 2 条回调 = 公开端点不立码；2.3 的 `miniapp:wechat:decrypt-phone` 按卡 §三 裁定不立码；
 *     2.4 的 `wb-notifications` 3 条自服务不立码）
 *
 * 用法（仓库根执行）：`node docs/evidence/S3-236/harness/gen-batch2-codes.mjs`
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

/**
 * 前端入口登记（落地面 4）的**实测读数**：由 `scan-frontend-entries.mjs` 落盘，
 * 生成器据此把每条码的 `frontendEntry` 写成"实测调用点 / 暂无入口"，**不手抄**。
 * 顺序：① `node docs/evidence/S3-236/harness/scan-frontend-entries.mjs`
 *      ② `node docs/evidence/S3-236/harness/gen-batch2-codes.mjs`
 */
const HITS_PATH = path.join(repoRoot, "docs/evidence/S3-236/raw/12-frontend-entry-hits.json");
const FRONTEND_HITS = fs.existsSync(HITS_PATH)
  ? JSON.parse(fs.readFileSync(HITS_PATH, "utf-8")).codes
  : {};

/** 逐码生成 frontendEntry 文案（实测命中优先；无命中写"暂无前端入口，仅后端授权位"） */
function frontendEntryFor(code) {
  const hits = FRONTEND_HITS[code] ?? [];
  if (hits.length === 0) return "暂无前端入口，仅后端授权位";
  return `${hits.join(" / ")}（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）`;
}

/**
 * 四域 38 码（顺序 = 迁移 `sort_no` 顺序 = 目录书写顺序，三者必须一致）
 * 字段：code / name（写进 t_sys_menu.menu_name，逐字来自清单）/ action / routeFile / endpoints
 *      menuParent（079 既有 CATALOG 码）/ frontendEntry（前端入口登记；本仓前端不引商家码）
 */
const DOMAINS = [
  {
    key: "report",
    file: "report-permission-codes.ts",
    exportPrefix: "REPORT",
    module: "report",
    title: "报表域（S3-236 · 11 码）",
    note: "粒度口径 = 语义粒度：4 条报表权限端点共用 `report:permission:edit` 一码（卡 §一 裁定，不按端点拆）",
    entries: [
      {
        code: "report:custom:create",
        name: "新建自定义报表",
        action: "create",
        routeFile: "custom-report-v2.routes.ts",
        endpoints: ["POST /api/admin/reports/", "POST /api/custom-report/templates"],
        routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
        frontendEntry: "暂无前端入口，仅后端授权位（清单 §2.1：v2 与模板同码，模板 = 报表定义）",
      },
      {
        code: "report:custom:edit",
        name: "编辑自定义报表",
        action: "edit",
        routeFile: "custom-report-v2.routes.ts",
        endpoints: ["PUT /api/admin/reports/:id", "PUT /api/custom-report/templates/:id"],
        routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:custom:delete",
        name: "删除自定义报表",
        action: "delete",
        routeFile: "custom-report-v2.routes.ts",
        endpoints: ["DELETE /api/admin/reports/:id", "DELETE /api/custom-report/templates/:id"],
        routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:custom:generate",
        name: "生成自定义报表",
        action: "generate",
        routeFile: "custom-report-v2.routes.ts",
        endpoints: ["POST /api/admin/reports/:id/generate", "POST /api/custom-report/templates/:id/execute"],
        routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
        frontendEntry: "暂无前端入口，仅后端授权位（清单 §2.1：execute 与 generate 同一语义 ⇒ 同名动作）",
      },
      {
        code: "report:schedule:create",
        name: "新建报表定时任务",
        action: "create",
        routeFile: "custom-report.routes.ts",
        endpoints: ["POST /api/custom-report/schedules"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:schedule:edit",
        name: "编辑报表定时任务",
        action: "edit",
        routeFile: "custom-report.routes.ts",
        endpoints: ["PUT /api/custom-report/schedules/:id"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:schedule:delete",
        name: "删除报表定时任务",
        action: "delete",
        routeFile: "custom-report.routes.ts",
        endpoints: ["DELETE /api/custom-report/schedules/:id"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:schedule:toggle",
        name: "启停报表定时任务",
        action: "toggle",
        routeFile: "custom-report.routes.ts",
        endpoints: ["PUT /api/custom-report/schedules/:id/toggle"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:schedule:run",
        name: "手动执行报表定时任务",
        action: "run",
        routeFile: "custom-report.routes.ts",
        endpoints: ["POST /api/custom-report/schedules/:id/run"],
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "report:permission:edit",
        name: "维护报表权限",
        action: "edit",
        routeFile: "report-permissions.routes.ts",
        endpoints: [
          "PUT /api/admin/report-permissions/matrix",
          "PUT /api/admin/report-permissions/data-scope",
          "POST /api/admin/report-permissions/batch",
          "PUT /api/admin/report-permissions/user/:userId",
        ],
        frontendEntry: "暂无前端入口，仅后端授权位（**1 码覆盖 4 端点**，语义粒度口径）",
      },
      {
        code: "report:export",
        name: "导出报表",
        action: "export",
        routeFile: "report.routes.ts",
        endpoints: ["POST /api/admin/reports/export"],
        frontendEntry: "暂无前端入口，仅后端授权位（动作取 079 既有规范动作 export）",
      },
    ],
  },
  {
    key: "hardware",
    file: "hardware-permission-codes.ts",
    exportPrefix: "HARDWARE",
    module: "mixed",
    title: "硬件 / 打印域（S3-236 · 14 码）",
    note: "模块码取 079 既有码族：打印留痕/模板落 `system`（与 app-mobile 菜单码 `system:print` 同域），硬件配置落 `store`（硬件挂在门店域）；另 2 条服务商回调是公开端点 ⇒ 不立码",
    entries: [
      {
        code: "system:print-record:create",
        name: "保存打印记录",
        action: "create",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["POST /api/admin/print/records"],
        menuParent: "system",
        frontendEntry: "app-mobile/src/config/function-menu.ts:142（单据打印，码 `system:print` 同域）",
      },
      {
        code: "system:print-record:reprint",
        name: "重打小票",
        action: "reprint",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["POST /api/admin/print/records/:id/reprint"],
        menuParent: "system",
        frontendEntry: "app-mobile/src/config/function-menu.ts:142（单据打印页内操作）",
      },
      {
        code: "system:print-template:create",
        name: "新建打印模板",
        action: "create",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["POST /api/admin/print/templates"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "system:print-template:edit",
        name: "编辑打印模板",
        action: "edit",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["PUT /api/admin/print/templates/:id"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "system:print-template:delete",
        name: "删除打印模板",
        action: "delete",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["DELETE /api/admin/print/templates/:id"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "system:print-template:reset",
        name: "重置打印模板",
        action: "reset",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["POST /api/admin/print/templates/:id/reset"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "system:print-template:set-default",
        name: "设为默认打印模板",
        action: "set-default",
        module: "system",
        routeFile: "print.routes.ts",
        endpoints: ["POST /api/admin/print/templates/:id/set-default"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:config-edit",
        name: "编辑硬件配置",
        action: "config-edit",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["PUT /api/store/hardware/configs/:category"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:config-test",
        name: "测试硬件配置",
        action: "config-test",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["POST /api/store/hardware/configs/:category/test"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:announce",
        name: "云喇叭播报",
        action: "announce",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["POST /api/store/hardware/cloud-speaker/announce"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:box-pay",
        name: "收银盒支付",
        action: "box-pay",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["POST /api/store/hardware/box/pay"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:box-config-edit",
        name: "编辑收银盒配置",
        action: "box-config-edit",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["PUT /api/store/hardware/box-config"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:box-config-test",
        name: "测试收银盒配置",
        action: "box-config-test",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["POST /api/store/hardware/box-config/test"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "store:hardware:unionpay-test",
        name: "测试云闪付",
        action: "unionpay-test",
        module: "store",
        routeFile: "store-hardware.routes.ts",
        endpoints: ["POST /api/store/hardware/unionpay/test"],
        menuParent: "store",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
    ],
  },
  {
    key: "miniapp",
    file: "miniapp-permission-codes.ts",
    exportPrefix: "MINIAPP",
    module: "miniapp",
    title: "小程序 / 移动端域（S3-236 · 5 码）",
    note: "消费者端 33 条不立商家码（S3-205 §10.3 改判）；`miniapp:wechat:decrypt-phone` 按卡 §三 裁定**本批不立码**（另立小单定门禁判据）。模块码取 079 既有码族 miniapp（079 角色种子的 CUSTOMER_SERVICE 已用 miniapp:*）；⚠️ 079 里**没有** `miniapp` CATALOG 行 ⇒ 父行按「必须存在、不得插孤儿行」的口径挂 `system` CATALOG（见迁移 207 §四）",
    entries: [
      {
        code: "miniapp:config:edit",
        name: "编辑小程序配置",
        action: "edit",
        routeFile: "miniapp-config.routes.ts",
        endpoints: ["PUT /api/miniapp-config/configs/:platform"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位（saas-admin 侧页面，本仓 admin-web 无调用点）",
      },
      {
        code: "miniapp:package:upload-key",
        name: "上传小程序密钥",
        action: "upload-key",
        routeFile: "miniapp-config.routes.ts",
        endpoints: ["POST /api/miniapp-config/upload-key"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位（⚠️ 上传密钥：接线时须按《密钥管理规范》复核密钥落点）",
      },
      {
        code: "miniapp:package:build",
        name: "构建小程序包",
        action: "build",
        routeFile: "miniapp-config.routes.ts",
        endpoints: ["POST /api/miniapp-config/packages"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "miniapp:package:publish",
        name: "发布小程序",
        action: "publish",
        routeFile: "miniapp-config.routes.ts",
        endpoints: ["POST /api/miniapp-config/publish"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位（⚠️ 发布属高危动作，接线时建议限超管/运营）",
      },
      {
        code: "miniapp:order-sync:retry",
        name: "小程序订单同步重试",
        action: "retry",
        routeFile: "miniapp-order-sync.routes.ts",
        endpoints: ["POST /api/miniapp-order-sync/:orderNo/retry"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
    ],
  },
  {
    key: "dashboard",
    file: "dashboard-permission-codes.ts",
    exportPrefix: "DASHBOARD",
    module: "dashboard",
    title: "工作台 / 待办消息域（S3-236 · 8 码）",
    note: "模块码取 079 既有模块码 `dashboard`（工作台）；`wb-notifications` 3 条自服务不立码（与 `/api/admin/notifications/*` 不是同一组端点，勿混一码）",
    entries: [
      {
        code: "dashboard:todo:create",
        name: "新建待办",
        action: "create",
        routeFile: "workbench.routes.ts",
        endpoints: ["POST /api/admin/todos"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:todo:complete",
        name: "完成待办",
        action: "complete",
        routeFile: "workbench.routes.ts",
        endpoints: ["PUT /api/admin/todos/:id/complete"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:todo:dismiss",
        name: "忽略待办",
        action: "dismiss",
        routeFile: "workbench.routes.ts",
        endpoints: ["PUT /api/admin/todos/:id/dismiss"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:todo:delete",
        name: "删除待办",
        action: "delete",
        routeFile: "workbench.routes.ts",
        endpoints: ["DELETE /api/admin/todos/:id"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:quick-entry:create",
        name: "新建快捷入口",
        action: "create",
        routeFile: "workbench.routes.ts",
        endpoints: ["POST /api/admin/quick-entries"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:quick-entry:sort",
        name: "调整快捷入口排序",
        action: "sort",
        routeFile: "workbench.routes.ts",
        endpoints: ["PUT /api/admin/quick-entries/sort"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:quick-entry:edit",
        name: "编辑快捷入口",
        action: "edit",
        routeFile: "workbench.routes.ts",
        endpoints: ["PUT /api/admin/quick-entries/:id"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
      {
        code: "dashboard:quick-entry:delete",
        name: "删除快捷入口",
        action: "delete",
        routeFile: "workbench.routes.ts",
        endpoints: ["DELETE /api/admin/quick-entries/:id"],
        menuParent: "system",
        frontendEntry: "暂无前端入口，仅后端授权位",
      },
    ],
  },
];

/** 展开成带 sort_no / menuParent 的扁平列表（sort_no 从 1 连续编号） */
function flatEntries() {
  const out = [];
  for (const domain of DOMAINS) {
    for (const entry of domain.entries) {
      out.push({
        ...entry,
        domain: domain.key,
        module: entry.module ?? domain.module,
        menuParent: entry.menuParent ?? entry.module ?? domain.module,
        sortNo: out.length + 1,
      });
    }
  }
  return out;
}

const FLAT = flatEntries();

if (FLAT.length !== 38) {
  console.error(`✗ 生成失败：码数 ${FLAT.length} ≠ 卡面 38`);
  process.exit(2);
}
const codeSet = new Set(FLAT.map((e) => e.code));
if (codeSet.size !== FLAT.length) {
  console.error("✗ 生成失败：码名有重复");
  process.exit(2);
}

// ── 一、per-域常量文件 ─────────────────────────────────────────────
const HEADER = (domain, count) => `/**
 * S3-236（立码第二批）：${domain.title}的**唯一出处**
 *
 * 一、本文件是什么（形态照抄先例）
 *   本仓口径：**目录走代码常量、迁移只做数据登记**（先例 \`system-permission-codes.ts\`（S3-232 D6）、
 *   \`goods-permission-codes.ts\` / \`sale-permission-codes.ts\` / \`library-permission-codes.ts\`）。
 *   本批为四域各建一个 per-域常量文件，再由 \`batch2-permission-codes.ts\` 汇总（断言只认汇总文件）。
 *
 * 二、码表来源（**照抄，禁止自拟**）
 *   \`docs/tasks/R101-待立码清单-五域.md\` §二 —— ${domain.note}
 *
 * 三、本批**不接任何业务路由**（\`backend/src/routes/**\` 零改动）：只立码本身，
 *   即「目录 + 迁移 207 + 断言 + 前端入口登记」；接线留给后续批次。
 *
 * 四、持有者口径：本批**默认不给任何角色发码**（同 S3-232 裁定）；如需发给某在用角色，
 *   只登记并在回传卡请凌舟裁，**不得自行发码**。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

`;
void HEADER;

function renderDomainFile(domain) {
  const prefix = domain.exportPrefix;
  const lines = [];
  const quoted = (arr) => arr.map((e) => `"${e.replace(/\\/g, "\\\\")}"`).join(", ");
  lines.push(`/** ${domain.title} —— 码表来源：\`docs/tasks/R101-待立码清单-五域.md\` §二 */`);
  lines.push(`export const ${prefix}_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = [`);
  for (const entry of domain.entries) {
    const flat = FLAT.find((f) => f.code === entry.code);
    // 端点即真实路径字面量：生成前先卡住占位符（F1 返工：首版把检索装置的 `#id#`/`#tail#` 写进了 endpoints，
    //   与同文件另一半的 `:id` 两套占位符并存，出厂用例因此判红）
    for (const ep of entry.endpoints) {
      if (ep.includes("#")) {
        throw new Error(`端点不得含占位符（#…#）：${entry.code} → ${ep}`);
      }
    }
    const endpointsLiteral = quoted(entry.endpoints);
    const callPatternsLiteral = quoted(entry.endpoints);
    const requestPatternsLiteral = quoted(
      entry.endpoints.map((e) => {
        const [method, p] = e.split(" ");
        return `${method} ${p.replace(/^\/api/, "")}`;
      }),
    );
    lines.push("  defineBatch2Entry({");
    lines.push(`    code: "${entry.code}",`);
    lines.push(`    module: "${flat.module}",`);
    lines.push(`    name: "${entry.name}",`);
    lines.push(`    action: "${entry.action}",`);
    lines.push(`    routeFile: "${entry.routeFile}",`);
    if (entry.routeFiles) {
      lines.push(`    routeFiles: [${quoted(entry.routeFiles)}],`);
    }
    lines.push(`    endpoints: [${endpointsLiteral}],`);
    lines.push(`    callPatterns: [${callPatternsLiteral}],`);
    lines.push(`    requestPatterns: [${requestPatternsLiteral}],`);
    lines.push(`    menuParent: "${flat.menuParent}",`);
    lines.push(`    frontendEntry: "${frontendEntryFor(entry.code)}",`);
    lines.push("  }),");
  }
  lines.push("];");
  lines.push("");
  lines.push(`/** ${domain.title}的码名（顺序同目录） */`);
  lines.push(
    `export const ${prefix}_PERMISSION_CODES: ReadonlyArray<string> = ${prefix}_PERMISSION_CATALOG.map((e) => e.code);`,
  );
  lines.push("");
  lines.push(`/** ${domain.title}的条数 */`);
  lines.push(`export const ${prefix}_PERMISSION_COUNT = ${prefix}_PERMISSION_CATALOG.length;`);
  lines.push("");
  return lines.join("\n");
}

function renderBatch2EntryFile() {
  return `/**
 * S3-236（立码第二批 · 四域 38 码）：目录条目的**共用形状与校验**
 *
 * 为什么单独一个文件：四域各一个 per-域常量文件 + 一个汇总文件，共用同一个 entry 形状与
 * \`模块:子域:动作\` 形态校验，避免"五个文件各写一套形状"造成断言看不全。
 * 形状逐字对照 S3-232 的 \`SystemPermissionEntry\`（先例），**只增不改**：
 *   \`code / module / name / action / routeFile / endpoints / menuParent / frontendEntry\`。
 */
export interface Batch2PermissionEntry {
  /** 权限码（\`模块:子域:动作\`） */
  code: string;
  /** 模块名（取 079_权限矩阵.sql 的既有模块码：report / system / store / miniapp / dashboard） */
  module: string;
  /** 中文名（写进 \`t_sys_menu.menu_name\`，与迁移 207 逐字同值） */
  name: string;
  /** 动作（\`模块:子域:动作\` 的第三段） */
  action: string;
  /** 路由文件（相对 \`backend/src/routes/\`）：与 \`endpoints\` 一一对应 */
  routeFile: string;
  /** 该码覆盖的写端点（\`METHOD /api/...\`，路径字面量，供断言逐条核对） */
  endpoints: ReadonlyArray<string>;
  /**
   * 逐端点对应的路由文件（**与 \`endpoints\` 同下标同序**）。
   * 只有"一个码覆盖多个不同路由文件"的条目才需要（本批 = 报表域 4 条：v2 与模板同码）。
   * 缺省时断言按 \`routeFile\` 单个文件核对。
   */
  routeFiles?: ReadonlyArray<string>;
  /** 注册进 \`t_sys_menu\` 的父行 menu_code（必须取自 079 的既有 CATALOG 码） */
  menuParent: string;
  /**
   * 前端调用点检索用的**宽松形状**（落地面 4）：断言要求的端点字面量含 \`:id(\\\\d+)\` 这类
   * Express 正则段，前端不会那样写 ⇒ 另给一份按 \`:id\` 检索的形状，供扫描装置使用。
   */
  callPatterns?: ReadonlyArray<string>;
  /**
   * 前端**请求路径**字面量（多数前端的 api 层写**相对前缀**，如 app-mobile 的
   * \`post("/admin/print/records")\`，不带 \`/api\`）⇒ 供落地面 4 的检索装置使用，
   * 避免"扫不到就登记成无入口"的**假读数**。
   */
  requestPatterns?: ReadonlyArray<string>;
  /** 前端入口（有则写页面/调用点，无则写"暂无前端入口，仅后端授权位"） */
  frontendEntry: string;
}

/** 允许的模块白名单：**只允许 079 既有模块码**（不许自造模块名，提案 §三） */
export const BATCH2_PERMISSION_MODULES: ReadonlyArray<string> = [
  "dashboard",
  "report",
  "store",
  "system",
  "miniapp",
];

/** 禁止的"万能码"动作（授权模型提案 §三：商家侧不再新增 \`xxx:manage\`） */
export const BATCH2_FORBIDDEN_PERMISSION_ACTIONS: ReadonlyArray<string> = ["manage"];

/**
 * 允许的 **两段式** 码形态（\`模块:动作\`）。
 *
 * 为什么要有这个白名单：本仓命名规范是 \`模块:子域:动作\`，但 **079 既有码族里有两段式先例**
 * （\`store:list\` / \`store:create\` / \`store:edit\`，079 第 169/216/217 行），
 * 且本批清单 §2.1 明确要求 \`report:export\`（"动作取 079 规范动作 \`export\`"）
 * ⇒ 断言不能一律要求三段（否则把"照抄清单"判成违规）。两段式的**动作段**限定在本表内。
 */
export const BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS: ReadonlyArray<string> = [
  "backup",
  "batch",
  "cancel",
  "check",
  "create",
  "delete",
  "edit",
  "export",
  "handle",
  "import",
  "list",
  "print",
  "publish",
  "read",
  "reset",
  "restore",
  "run",
  "send",
  "test",
  "toggle",
  "view",
];

/**
 * 声明一条目录条目：形状合法性与命名规范**在这里统一校验**（写错当场抛，不留给运行时）。
 * 校验项：① 码是 \`模块:子域:动作\`（三段）**或** \`模块:动作\`（两段，动作在白名单内）；
 *        ② 模块在白名单内且与码首段同值；③ 无 \`*\` / 无 \`manage\` / 段内只允许 \`[a-z0-9-]\`；
 *        ④ 末段 = \`action\`；⑤ 端点非空且形如 \`METHOD /api/...\`。
 */
export function defineBatch2Entry(entry: Batch2PermissionEntry): Batch2PermissionEntry {
  const segments = entry.code.split(":");
  if (segments.length !== 3 && segments.length !== 2) {
    throw new Error(\`权限码必须是 模块:子域:动作（三段）或 模块:动作（两段）：\${entry.code}\`);
  }
  if (segments[0] !== entry.module) {
    throw new Error(\`权限码首段与 module 不一致：\${entry.code} / \${entry.module}\`);
  }
  if (!BATCH2_PERMISSION_MODULES.includes(entry.module)) {
    throw new Error(\`模块不在 079 既有模块码白名单内：\${entry.module}\`);
  }
  if (segments[segments.length - 1] !== entry.action) {
    throw new Error(\`权限码末段与 action 不一致：\${entry.code} / \${entry.action}\`);
  }
  if (segments.length === 2 && !BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS.includes(entry.action)) {
    throw new Error(\`两段式码的动作不在白名单内（079 既有动作先例）：\${entry.code}\`);
  }
  for (const segment of segments) {
    if (segment === "*") throw new Error(\`权限码不得含通配符：\${entry.code}\`);
    if (BATCH2_FORBIDDEN_PERMISSION_ACTIONS.includes(segment)) {
      throw new Error(\`权限码不得含万能动作：\${entry.code}\`);
    }
    if (!/^[a-z0-9-]+$/.test(segment)) {
      throw new Error(\`权限码段只允许 [a-z0-9-]：\${entry.code}\`);
    }
  }
  if (entry.endpoints.length === 0) throw new Error(\`权限码必须声明至少一个端点：\${entry.code}\`);
  for (const endpoint of entry.endpoints) {
    if (!/^(GET|POST|PUT|PATCH|DELETE) \\/api\\//.test(endpoint)) {
      throw new Error(\`端点必须形如 "METHOD /api/..."：\${entry.code} → \${endpoint}\`);
    }
  }
  return entry;
}
`;
}

function renderIndexFile() {
  const importLines = DOMAINS.map(
    (d, i) =>
      `import {\n  ${d.exportPrefix}_PERMISSION_CATALOG,\n  ${d.exportPrefix}_PERMISSION_CODES,\n  ${d.exportPrefix}_PERMISSION_COUNT,\n} from "./${d.file.replace(/\.ts$/, "")}";`,
  ).join("\n");
  const spread = DOMAINS.map((d) => `  ...${d.exportPrefix}_PERMISSION_CATALOG,`).join("\n");
  const codesSpread = DOMAINS.map((d) => `  ...${d.exportPrefix}_PERMISSION_CODES,`).join("\n");
  const countSum = DOMAINS.map((d) => `${d.exportPrefix}_PERMISSION_COUNT`).join(" + ");
  return `/**
 * S3-236（立码第二批 · 四域 38 码）：**汇总目录**（断言与门禁只认本文件）
 *
 * 一、为什么要有汇总层：四域各一个 per-域常量文件（report / hardware / miniapp / dashboard），
 *   断言要的是"整批 38 码"这一个数字与一份顺序，故用本文件把四域**按迁移 207 的 sort_no 顺序**
 *   拼成一个目录；顺带在这里重导出处（\`batch2-entry.ts\`）的类型，减少各域文件的样板 import。
 *
 * 二、条数口径（可复算）：报表 11 + 硬件打印 14 + 小程序 5 + 工作台 8 = **38**（卡 §一）。
 *   端点条数 45 = 报表 18 + 硬件 14 + 小程序 5 + 工作台 8（报表 4 条权限端点共用 1 码 ⇒ 码数 38 < 端点数 45）。
 *
 * 三、本批**不接任何业务路由**：\`backend/src/routes/**\` 零改动；本文件只被断言与后续接线批引用。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

export type { Batch2PermissionEntry };
export {
  BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS,
  BATCH2_FORBIDDEN_PERMISSION_ACTIONS,
  BATCH2_PERMISSION_MODULES,
  defineBatch2Entry,
} from "./batch2-entry";

${importLines}

// 汇总前逐条重跑形状校验：per-域文件即使被手改错，汇总层也会当场抛（不留给断言才发现）
const __ENTRIES: ReadonlyArray<Batch2PermissionEntry> = [
${spread}
];
for (const entry of __ENTRIES) defineBatch2Entry(entry);

/** 四域 38 码的汇总目录（顺序 = 迁移 207 的 sort_no 顺序 = 各 per-域文件的书写顺序） */
export const BATCH2_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = __ENTRIES;

/** 四域 38 码（顺序同目录） */
export const BATCH2_PERMISSION_CODES: ReadonlyArray<string> = [
${codesSpread}
];

/** 牌面码数：**域数/条数断言**的唯一出处（卡 §一：38） */
export const BATCH2_PERMISSION_COUNT = ${countSum};

/** 本批立码覆盖的**写端点**条数（一码可覆盖多端点，故 ≥ 码数） */
export const BATCH2_PERMISSION_ENDPOINT_COUNT = BATCH2_PERMISSION_CATALOG.reduce(
  (sum, entry) => sum + entry.endpoints.length,
  0,
);

/** 逐域条数（供断言核对"11 / 14 / 5 / 8"逐域可复算） */
export const BATCH2_DOMAIN_COUNTS = {
  report: ${DOMAINS[0].exportPrefix}_PERMISSION_COUNT,
  hardware: ${DOMAINS[1].exportPrefix}_PERMISSION_COUNT,
  miniapp: ${DOMAINS[2].exportPrefix}_PERMISSION_COUNT,
  dashboard: ${DOMAINS[3].exportPrefix}_PERMISSION_COUNT,
} as const;

/** 本批立码的迁移文件（断言"目录 ↔ 迁移一致"时读取的**唯一**文件） */
export const BATCH2_PERMISSION_MIGRATION = "207_四域权限点立码.sql";

/** 本批立码迁移的编号（断言快照用） */
export const BATCH2_PERMISSION_MIGRATION_NO = 207;
`;
}

// ── 二、迁移 207 ───────────────────────────────────────────────────
function renderMigration() {
  const rows = FLAT.map((entry, index) => {
    const head = index === 0 ? "  SELECT" : "  UNION ALL SELECT";
    const tail = index === FLAT.length - 1 ? "\n" : "";
    return `${head} '${entry.code}' AS code, '${entry.name}' AS name, ${entry.sortNo} AS sort_no, '${entry.menuParent}' AS parent_code${tail}`;
  }).join("\n");

  const parentList = [...new Set(FLAT.map((e) => e.menuParent))];
  const codeList = FLAT.map((e) => `'${e.code}'`).join(", ");
  const byDomain = DOMAINS.map(
    (d) =>
      `--   · ${d.key === "report" ? "报表域" : d.key === "hardware" ? "硬件/打印域" : d.key === "miniapp" ? "小程序/移动端域" : "工作台/待办消息域"} ${d.entries.length} 码：` +
      d.entries.map((e) => `\`${e.code}\``).join("、"),
  ).join("\n");

  return `INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, c.code, c.name, 'BUTTON', NULL, NULL, NULL, c.sort_no, 1, 1, p.tenant_id
FROM t_sys_menu p
JOIN (
${rows}
) c
WHERE p.menu_code = c.parent_code
  AND p.menu_type = 'CATALOG'
  AND p.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = p.tenant_id AND d.menu_code = c.code
  );

SELECT CONCAT('207 立码核对：38 码全租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN (${codeList})),
  ' 行；default 租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code IN (${codeList})),
  ' 行；本批父行缺失的码数 ', (SELECT COUNT(*) FROM (
     SELECT c.code,
            (SELECT COUNT(*) FROM t_sys_menu p
              WHERE p.menu_code = c.parent_code AND p.menu_type = 'CATALOG' AND p.parent_id IS NULL) AS parents,
            (SELECT COUNT(*) FROM t_sys_menu n WHERE n.menu_code = c.code) AS inserted
     FROM (
${FLAT.map((e, i) => `${i === 0 ? "       SELECT" : "       UNION ALL SELECT"} '${e.code}' AS code, '${e.menuParent}' AS parent_code`).join("\n")}
     ) c
   ) x WHERE x.parents > 0 AND x.inserted = 0),
  '（父行要求取 079 既有 CATALOG 码：${parentList.join(" / ")}）') AS result;

SELECT CONCAT('207 幂等自证：本批码重复行数（应为 0）= ',
  (SELECT COUNT(*) FROM (
     SELECT menu_code, tenant_id FROM t_sys_menu WHERE menu_code IN (${codeList})
     GROUP BY menu_code, tenant_id HAVING COUNT(*) > 1
   ) dup)) AS result;

SELECT CONCAT('207 零角色授权自证：持本批任一新码的角色行数（应为 0）= ',
  (SELECT COUNT(*) FROM (
     SELECT r.id FROM t_sys_role r
      WHERE r.permissions IS NOT NULL
        AND JSON_VALID(r.permissions) = 1
        AND EXISTS (
          SELECT 1 FROM (
${FLAT.map((e) => `            SELECT '${e.code}' AS code`).join("\n            UNION ALL\n")}
          ) c
           WHERE JSON_CONTAINS(r.permissions, JSON_QUOTE(c.code)) = 1
        )
   ) holder), '（另附机读读数：0 即零角色授权）') AS result;

SELECT (SELECT COUNT(*) FROM (
     SELECT r.id FROM t_sys_role r
      WHERE r.permissions IS NOT NULL
        AND JSON_VALID(r.permissions) = 1
        AND EXISTS (
          SELECT 1 FROM (
${FLAT.map((e) => `            SELECT '${e.code}' AS code`).join("\n            UNION ALL\n")}
          ) c
           WHERE JSON_CONTAINS(r.permissions, JSON_QUOTE(c.code)) = 1
        )
   ) holder) AS roles_holding_new_codes,
  (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN (${codeList})) AS total_38codes,
  (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code IN (${codeList})) AS default_tenant_rows,
  (SELECT COUNT(*) FROM (
     SELECT menu_code, tenant_id FROM t_sys_menu WHERE menu_code IN (${codeList})
     GROUP BY menu_code, tenant_id HAVING COUNT(*) > 1
   ) dup) AS duplicate_pairs;

-- ============================================
-- 迁移编号：207
-- 单号：S3-236（立码第二批 · 四域 38 码）
-- 描述：把四域 38 个新权限码登记进 t_sys_menu（BUTTON 行，父行 = 各租户的域 CATALOG 行）
-- 创建人：阿坚（后端 / 权限）｜执行卡：docs/tasks/inbox/ACTIVE-S3-236.md（+ DSH 派单卡的三条更正）
-- 日期：2026-10-17
--
-- 一、本迁移只做一件事：**立码**（38 个新码登记进 t_sys_menu），**不接任何业务路由**
--   · 本仓"权限码靠 t_sys_menu 行登记才可授权 / 可发现"（同 S3-209 \`sale:cancel\`、S3-232 的 204 口径）；
--   · 38 码与 backend/src/shared/batch2-permission-codes.ts 的 BATCH2_PERMISSION_CATALOG **逐字同源**
--     （目录↔迁移双向一致断言见 backend/src/__tests__/shared/batch2-permission-codes.test.ts）；
--   · 码表来源 = docs/tasks/R101-待立码清单-五域.md §二（照抄，禁止自拟）：
${byDomain}
--   · 不立码的既有裁定（卡 §三，本迁移**不涉及**）：硬件回调 2 条（公开端点）、
--     \`miniapp:wechat:decrypt-phone\`（requireWxAuth 域，另立小单）、\`wb-notifications\` 3 条（自服务）。
--
-- 二、本批**默认不发任何角色码**（卡 §二.3）：本迁移**没有任何 UPDATE t_sys_role / INSERT t_sys_role_permission**；
--   末尾第 3 条只读 SELECT 就是"零授权"的自证读数（按生产同一份 matchPermission 语义的 JSON_OVERLAPS 复算）。
--   · 为什么不补 t_sys_role_permission：该表全仓无人读，授权判定只读 t_sys_role.permissions（S3-232 裁定 3）。
--   · 若某码必须发给某在用角色 ⇒ **只登记、在回传卡请凌舟裁**，不得自行发码（卡 §二.3）。
--
-- 三、幂等（可重复执行，第二遍**零行变更**）
--   · 菜单行按 (menu_code, tenant_id) 判定（与唯一键 uk_sys_menu_code_tenant 同口径，NOT EXISTS 守卫）；
--   · 父行按 menu_code = 'report' / 'system' / 'store' / 'dashboard'（079 既有 CATALOG 码）逐租户定位
--     ⇒ default 与各租户克隆行各自补自己的按钮行；父行缺失的租户（尚未克隆菜单的空库/灾备库）
--     该条整条跳过，**不插孤儿行、不报错**；
--   · 为什么用 NOT EXISTS 而不是 INSERT IGNORE：INSERT IGNORE 会把**其它**错误（列不匹配、超长）
--     一起吞掉，留下"看起来成功其实没插"的假绿（技术债铁律：绕过 ≠ 修复）。
--
-- 四、⚠️ 父行口径（本迁移的**唯一自主判定**，已登记回传卡"待裁定项"）
--   · 报表 11 码 → 079 第 90 号 CATALOG \`report\`（报表中心）；
--   · 硬件/打印 14 码 → 打印留痕/模板 7 码挂 079 第 100 号 CATALOG \`system\`（与 app-mobile 菜单码
--     \`system:print\` 同域），硬件配置 7 码挂 079 第 70 号 CATALOG \`store\`（硬件配置挂在门店域）；
--   · 工作台 8 码 → 079 第 1 号 CATALOG \`dashboard\`（仪表盘/工作台）；
--   · 小程序 5 码 → ⚠️ **079 里没有 \`miniapp\` CATALOG 行**（\`miniapp:*\` 只作为模块码族出现在
--     079 第 92 行 CUSTOMER_SERVICE 的角色权限串里）⇒ 本迁移按"父行必须存在、不得插孤儿行"的口径
--     把 5 码挂到 \`system\` CATALOG（管理面系统配置），**不新建目录行**（新建目录=改菜单结构，越出"只立码"）。
--     备选方案（凌舟裁）：另立小单加 \`miniapp\` CATALOG 行后再把这 5 行改挂过去。
--
-- 五、⚠️ 必须用 run-migration.mjs 执行（否则本文件的数据写语句会被静默跳过）
--   本文件是**数据写语句**（INSERT ... SELECT），后端启动期外部迁移段（backend/src/shared/migration.ts
--   第 8 步）有 MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block ⇒ INSERT 会被跳过并打一行日志，
--   只剩末尾三条 SELECT。正确执行方式（由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对末尾 SELECT 的三个读数：38 码全租户命中 = 租户数 × 38、default 租户命中 38、
--   重复行 0、持本批新码的角色行 0。
--
-- 六、回滚（逐条给出）
--   DELETE FROM t_sys_menu WHERE menu_code IN (
--     ${FLAT.map((e) => `'${e.code}'`).join(", ")});
--   本迁移无角色授权变更 ⇒ **无需**回滚任何 t_sys_role.permissions。
-- ============================================
`;
}

// ── 三、落盘 ───────────────────────────────────────────────────────
const sharedDir = path.join(repoRoot, "backend", "src", "shared");
const written = [];
fs.writeFileSync(path.join(sharedDir, "batch2-entry.ts"), renderBatch2EntryFile(), "utf-8");
written.push("backend/src/shared/batch2-entry.ts");
for (const domain of DOMAINS) {
  // import 行已在 HEADER 末尾（这里不再重复拼接，否则会出现两行相同 import）
  const content = HEADER(domain, domain.entries.length) + renderDomainFile(domain);
  fs.writeFileSync(path.join(sharedDir, domain.file), content, "utf-8");
  written.push(`backend/src/shared/${domain.file}`);
}
fs.writeFileSync(path.join(sharedDir, "batch2-permission-codes.ts"), renderIndexFile(), "utf-8");
written.push("backend/src/shared/batch2-permission-codes.ts");

const migrationPath = path.join(repoRoot, "docs", "migrations", "207_四域权限点立码.sql");
fs.writeFileSync(migrationPath, renderMigration(), "utf-8");
written.push("docs/migrations/207_四域权限点立码.sql");

console.log(`已生成 ${written.length} 个文件（四域 ${FLAT.length} 码）：`);
for (const w of written) console.log(`  · ${w}`);
for (const domain of DOMAINS) console.log(`  ${domain.key}: ${domain.entries.length} 码`);
