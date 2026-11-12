#!/usr/bin/env node
/**
 * PAGES-ORDER-FINANCE-REPORT-01 · 独立 mutation 取证（红→SHA256复原→复绿）
 * 对真实源码做 4 类注入，每类：先记录 SHA256 → 注入 → 跑合同 spec 必须 FAIL(点名) → 复原 → 校验 SHA256 一致 → 复跑必须 PASS。
 * 不修改任何生产文件为最终态（每类复原并核对 SHA256）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SPEC = path.join(here, "prototype12-pages-order-finance-report-contract.spec.mjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const run = () => {
  try {
    execFileSync(process.execPath, [SPEC], { cwd: WEB, stdio: "pipe", encoding: "utf8" });
    return { code: 0, out: "PASS" };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
};

const cases = [
  {
    name: "copy-blacklist",
    file: path.join(WEB, "src/views/finance/FinanceCollection.vue"),
    mutate: (s) => s.replace('class="page-title">收款链接<', 'class="page-title">收款链接（待接入）<'),
    expect: "模板中命中黑名单",
  },
  {
    name: "empty-anchor",
    file: path.join(WEB, "src/views/order/Orders.vue"),
    mutate: (s) => s.replace(/<template #empty>[\s\S]*?<\/template>/g, ""),
    expect: "缺 empty 态",
  },
  {
    name: "loading-anchor",
    file: path.join(WEB, "src/views/order/OrderRoutingView.vue"),
    mutate: (s) => s.replace(/v-loading="loading"/g, ""),
    expect: "缺 loading 锚点",
  },
  {
    name: "mock-comment",
    file: path.join(WEB, "src/views/order/OrderSyncView.vue"),
    mutate: (s) => s.replace("// ─── 渠道与状态映射 ───", "// ─── Mock 数据 ───"),
    expect: "残留 Mock 数据 注释",
  },
];

let bad = 0;
for (const c of cases) {
  const orig = readFileSync(c.file);
  const h0 = sha(orig);
  const mutated = Buffer.from(c.mutate(orig.toString("utf8")), "utf8");
  if (sha(mutated) === h0) {
    console.log(`SKIP ${c.name}: 注入未改变文件`);
    bad++;
    continue;
  }
  writeFileSync(c.file, mutated);
  const red = run();
  const redOk = red.code !== 0 && red.out.includes(c.expect);
  writeFileSync(c.file, orig); // 复原
  const h1 = sha(readFileSync(c.file));
  const green = run();
  const greenOk = green.code === 0 && h1 === h0;
  const verdict = redOk && greenOk ? "OK" : "FAIL";
  if (verdict === "FAIL") bad++;
  console.log(`${verdict} ${c.name}: 红=${red.code}(点名:${redOk}) 复原SHA一致=${h1 === h0} 复绿=${green.code}(${greenOk})`);
  if (redOk) {
    const line = red.out.split(/\r?\n/).find((l) => l.includes(c.expect)) || "";
    console.log(`     点名行: ${line.trim()}`);
  }
}
console.log(`\n小结：${bad === 0 ? "4/4 mutation OK" : `${bad} 类失败`}`);
process.exit(bad === 0 ? 0 : 1);
