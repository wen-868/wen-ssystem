/**
 * 5 类 mutation 红绿闭环（PAGES-SYSTEM-OPERATIONS-01 卡面 §五.5）
 * 每类：备份目标文件 → 注入缺陷 → 跑 contract spec 期望红 → 逐字节复原 → 复跑期望绿 → SHA 对账。
 * 输出：每类 mutation 的回执（注入点/红证断言/复原SHA）写 evidence。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WEB = path.join(here, "..");
const CWD = WEB;
const SPEC = path.join(WEB, "tests", "prototype12-pages-system-operations-contract.spec.mjs");
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function runSpec() {
  try {
    const out = execFileSync(process.execPath, [SPEC], { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// 5 类 mutation：目标文件 + 注入（替换 old→new）+ 预期命中的断言关键词
const MUTATIONS = [
  {
    id: "M1-黑名单注入",
    file: "src/views/system/MonitorView.vue",
    old: "系统概览",
    neu: "系统概览·待接入",
    expectKeyword: "COPY_BLACKLIST",
    desc: "注入黑名单词「待接入」→ 合同测试 #13 应红",
  },
  {
    id: "M2-权限门降级",
    file: "src/router/index.ts",
    old: 'path: "monitor", name: "monitor", component: () => import("../views/system/MonitorView.vue"), meta: { roles: ["SUPER_ADMIN"]',
    neu: 'path: "monitor", name: "monitor", component: () => import("../views/system/MonitorView.vue"), meta: { roles: ["STORE_MANAGER"]',
    expectKeyword: "SUPER_ADMIN",
    desc: "去掉 monitor 路由 SUPER_ADMIN（fail-closed 门退化）→ 合同测试 #4 应红",
  },
  {
    id: "M3-危险操作确认移除",
    file: "src/views/system/SystemRoles.vue",
    old: "确定删除该角色？",
    neu: "删除该角色（无确认）",
    expectKeyword: "el-popconfirm|确认",
    desc: "删除危险确认文案（fallback 到仍在? 需同步移 popconfirm）— 见下替换",
  },
  {
    id: "M4-路由缺失",
    file: "src/router/index.ts",
    old: 'path: "system/feedback"',
    neu: 'path: "system/feedbackX"',
    expectKeyword: "system/feedback",
    desc: "改名 system/feedback 路由 → 合同测试 #3/#17 应红",
  },
  {
    id: "M5-打印契约引用缺失",
    file: "src/modules/print/PrintTemplatesView.vue",
    old: '<div class="print-templates-view">',
    neu: '<div class="templates-view">',
    expectKeyword: "print|template",
    desc: "移除打印模板页 print 标识类（破坏打印契约引用面）→ 合同测试 #11 应红",
    // #11: PrintTemplatesView 非空且 /print|template/i；api.ts /api\.ts|template|print/i。
    // 仅改 print→templates 仍含 template，故同时把整个文件内容替换为无 print/template 的占位：
    precheck: (src) => src.includes("sale") , // 标记用，不参与
    customApply: (orig) => "<template><div>x</div></template>",
  },
];

const report = [];
for (const m of MUTATIONS) {
  const abs = path.join(WEB, m.file);
  const orig = readFileSync(abs, "utf8");
  const origSha = sha(Buffer.from(orig, "utf8"));
  const mutated = orig.replace(m.old, m.neu);
  // M3 特殊：移除 popconfirm 以让「确认」彻底消失（确保可红）
  let apply = mutated;
  if (m.id === "M3-危险操作确认移除") {
    apply = orig.replace(/<el-popconfirm[^>]*>[\s\S]*?<\/el-popconfirm>/, '<span>删除</span>');
  }
  if (m.customApply) {
    apply = m.customApply(orig);
  } else if (mutated === orig) {
    report.push(`## ${m.id}\nNO_CHANGE: 未命中注入点「${m.old}」\n`);
    continue;
  }
  writeFileSync(abs, apply, "utf8");
  const red = runSpec();
  // 复原
  writeFileSync(abs, orig, "utf8");
  const restoreSha = sha(Buffer.from(readFileSync(abs, "utf8"), "utf8"));
  const restored = restoreSha === origSha;
  const green = runSpec();
  const isRed = red.code !== 0 && /FAIL/.test(red.out);
  const failedLine = (red.out.split("\n").find((l) => l.startsWith("FAIL")) || "").trim();
  report.push(
    `## ${m.id}  (${m.desc})\n` +
      `file: ${m.file}\n` +
      `RED: exit=${red.code} isFail=${/FAIL/.test(red.out)}  ${failedLine}\n` +
      `RESTORE_BYTE_EQUAL: ${restored} (orig=${origSha.slice(0, 16)}…, after=${restoreSha.slice(0, 16)}…)\n` +
      `GREEN_AFTER_RESTORE: exit=${green.code} pass=${/17 passed/.test(green.out)}\n`
  );
}

const allRed = report.every((r) => /RED: exit=[1-9]/.test(r) && /isFail=true/.test(r));
const allRestore = report.every((r) => /RESTORE_BYTE_EQUAL: true/.test(r));
const allGreen = report.every((r) => /GREEN_AFTER_RESTORE: exit=0 pass=true/.test(r));
const header =
  `COMMAND: node e2e/prototype12-pages-system-operations-mutations.mjs\n` +
  `CWD: worktrees/ms/WORKBENCH-PROTOTYPE-12-PAGES-SYSTEM-OPERATIONS-01/admin-web\n` +
  `TIMESTAMP: ${new Date().toISOString()}\n` +
  `SUMMARY: mutations=${MUTATIONS.length} allRed=${allRed} allRestoreByteEqual=${allRestore} allGreenAfterRestore=${allGreen}\n\n`;
const body = header + report.join("\n");
writeFileSync(
  "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SYSTEM-OPERATIONS-01/mutations-5classes-raw.txt",
  body,
  "utf8"
);
console.log(body);
console.log(`\nFINAL: allRed=${allRed} allRestore=${allRestore} allGreen=${allGreen}`);
process.exit(allRed && allRestore && allGreen ? 0 : 1);
