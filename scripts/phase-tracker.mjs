#!/usr/bin/env node
/**
 * 阶段追踪器 —— 记录和管理每个阶段的汇报状态
 *
 * 用法:
 *   node scripts/phase-tracker.mjs start "S103 集成测试" "开始端到端集成测试"
 *   node scripts/phase-tracker.mjs update "S103 集成测试" "完成 50%，API 联调中"
 *   node scripts/phase-tracker.mjs done "S103 集成测试" "全部 74 个用例通过" -d "用例数" "74"
 *   node scripts/phase-tracker.mjs list
 *   node scripts/phase-tracker.mjs show "S103 集成测试"
 *
 * 数据保存在 .reports/phase-log.json（不会提交到 git）
 * 每个阶段的状态变化都会自动发送飞书汇报（如果配置了 webhook）
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, "..", ".reports");
const LOG_FILE = path.join(REPORTS_DIR, "phase-log.json");
const STATE_FILE = path.join(REPORTS_DIR, "phase-state.json");

const REPORTER = "苏然";

function ensureDir() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch { return fallback; }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function uid() {
  return "P" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function postHttpsJson(url, body) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const payload = JSON.stringify(body);
      const req = https.request({
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ ok: res.statusCode === 200, status: res.statusCode, data: JSON.parse(data || "{}") }); }
          catch { resolve({ ok: res.statusCode === 200, status: res.statusCode, data: null }); }
        });
      });
      req.on("error", (err) => resolve({ ok: false, status: 0, data: { error: String(err) } }));
      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, data: { error: String(err) } });
    }
  });
}

function buildTextContent(opts) {
  const emoji = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[opts.status] || "📌";
  const label = { TODO: "待开始", IN_PROGRESS: "进行中", DONE: "已完成", BLOCKED: "阻塞" }[opts.status] || "未知";
  const lines = [
    `【工作汇报】${emoji} ${label}`,
    "",
    `📌 阶段: ${opts.phase}`,
    `📝 汇总: ${opts.summary}`,
    `👤 汇报人: ${REPORTER}`,
    `🕐 时间: ${now()}`
  ];
  if (opts.details && opts.details.length) {
    lines.push("", "--- 明细 ---");
    for (const d of opts.details) lines.push(`• ${d.label}: ${d.value}`);
  }
  if (opts.nextSteps && opts.nextSteps.length) {
    lines.push("", "--- 下一步 ---");
    for (const s of opts.nextSteps) lines.push(`→ ${s}`);
  }
  if (opts.risks && opts.risks.length) {
    lines.push("", "--- 风险/阻塞 ---");
    for (const r of opts.risks) lines.push(`⚠ ${r}`);
  }
  return lines.join("\n");
}

function buildCard(opts) {
  const emoji = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[opts.status] || "📌";
  const template = opts.status === "DONE" ? "green" : opts.status === "BLOCKED" ? "red" : "blue";
  const elements = [
    { tag: "div", text: { tag: "lark_md", content: `**📌 ${opts.phase}**` } },
    { tag: "div", text: { tag: "lark_md", content: `**📝 汇总:** ${opts.summary}` } }
  ];
  if (opts.details && opts.details.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `---\n${opts.details.map((d) => `**${d.label}:** ${d.value}`).join("\n")}` }
    });
  }
  if (opts.nextSteps && opts.nextSteps.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `**→ 下一步:**\n${opts.nextSteps.map((s) => `• ${s}`).join("\n")}` }
    });
  }
  if (opts.risks && opts.risks.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `**⚠ 风险/阻塞:**\n${opts.risks.map((r) => `• ${r}`).join("\n")}` }
    });
  }
  elements.push({ tag: "hr" });
  elements.push({ tag: "div", text: { tag: "lark_md", content: `👤 ${REPORTER} · ${now()}` } });
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template,
        title: { tag: "plain_text", content: `${emoji} ${opts.phase} — 工作汇报` }
      },
      elements
    }
  };
}

async function sendReport(opts) {
  const webhook = opts.webhook || process.env.FEISHU_WEBHOOK_URL;
  if (!webhook) {
    console.warn("\n⚠ 未配置 FEISHU_WEBHOOK_URL，飞书消息未发送。");
    console.log("───────── 汇报预览 ─────────");
    console.log(buildTextContent(opts));
    console.log("─────────────────────────\n");
    return { ok: false, status: 0, data: { error: "NO_WEBHOOK" } };
  }
  let result = await postHttpsJson(webhook, buildCard(opts));
  if (!result.ok) {
    console.warn("⚠ 富文本发送失败，降级为纯文本…");
    result = await postHttpsJson(webhook, { msg_type: "text", content: { text: buildTextContent(opts) } });
  }
  if (result.ok) console.log("✅ 已发送飞书汇报：", opts.phase, "·", opts.status);
  else console.warn("⚠ 飞书汇报未发送成功：", result.status, result.data);
  return result;
}

function recordPhaseEvent(phase, status, summary, extra = {}) {
  ensureDir();
  const state = loadJson(STATE_FILE, { phases: {} });
  if (!state.phases[phase]) {
    state.phases[phase] = { id: uid(), phase, startedAt: now(), events: [] };
  }
  const p = state.phases[phase];
  p.lastStatus = status;
  p.lastSummary = summary;
  p.updatedAt = now();
  if (status === "DONE") p.completedAt = now();
  p.events.push({ status, summary, at: now(), ...extra });
  saveJson(STATE_FILE, state);

  const log = loadJson(LOG_FILE, []);
  log.push({ id: p.id, phase, status, summary, at: now(), ...extra });
  saveJson(LOG_FILE, log);
  return p;
}

function printList() {
  const state = loadJson(STATE_FILE, { phases: {} });
  const names = Object.keys(state.phases);
  if (!names.length) { console.log("暂无阶段记录。使用 'start' 命令开始。"); return; }
  console.log(`\n📋 阶段列表（共 ${names.length} 个阶段）\n`);
  for (const name of names) {
    const p = state.phases[name];
    const emoji = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[p.lastStatus] || "📌";
    console.log(`${emoji} ${name}  [${p.lastStatus}]  更新于 ${p.updatedAt}`);
    console.log(`   📝 ${p.lastSummary}`);
    console.log(`   🕐 开始: ${p.startedAt}${p.completedAt ? `  ✅ 完成: ${p.completedAt}` : ""}`);
    console.log();
  }
}

function printShow(phase) {
  const state = loadJson(STATE_FILE, { phases: {} });
  const p = state.phases[phase];
  if (!p) { console.log(`未找到阶段: ${phase}`); return; }
  console.log(`\n📌 ${phase}  [${p.lastStatus}]`);
  console.log(`   ID: ${p.id}`);
  console.log(`   开始: ${p.startedAt}`);
  console.log(`   更新: ${p.updatedAt}`);
  if (p.completedAt) console.log(`   完成: ${p.completedAt}`);
  console.log(`   最新汇总: ${p.lastSummary}\n`);
  console.log(`  ━ 事件流水 (共 ${p.events.length} 条) ━`);
  for (const ev of p.events) {
    const emo = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[ev.status] || "📌";
    console.log(`   ${emo} ${ev.at}  ${ev.status}  ${ev.summary}`);
    if (ev.details) for (const d of ev.details) console.log(`     • ${d.label}: ${d.value}`);
  }
  console.log();
}

function parseArgs(argv) {
  const out = { details: [], nextSteps: [], risks: [], webhook: null, reporter: REPORTER };
  let cursor = 0;
  while (cursor < argv.length) {
    const a = argv[cursor];
    if (a === "-d" || a === "--detail") { out.details.push({ label: argv[++cursor], value: argv[++cursor] }); }
    else if (a === "-n" || a === "--next") { out.nextSteps.push(argv[++cursor]); }
    else if (a === "-r" || a === "--risk") { out.risks.push(argv[++cursor]); }
    else if (a === "--webhook") { out.webhook = argv[++cursor]; }
    else if (a === "--reporter") { out.reporter = argv[++cursor]; }
    else if (a === "--no-send") { out.noSend = true; }
    cursor++;
  }
  return out;
}

function printHelp() {
  console.log(`阶段追踪器 —— 为每个阶段记录并发送飞书汇报

用法:
  node scripts/phase-tracker.mjs <cmd> [phase] [summary] [options...]

命令:
  start    启动一个新阶段（状态 IN_PROGRESS）
  update   更新阶段进度（状态 IN_PROGRESS）
  done     标记阶段完成（状态 DONE）
  block    标记阶段阻塞（状态 BLOCKED）
  list     列出所有阶段
  show     显示阶段详情

选项:
  -d, --detail  <label> <value>    添加明细项，可重复
  -n, --next    <plan>             添加下一步计划，可重复
  -r, --risk    <risk>             添加风险项，可重复
  --webhook    <url>               指定飞书 webhook（也可通过环境变量 FEISHU_WEBHOOK_URL）
  --no-send                        仅记录，不发送飞书
  --reporter   <name>              汇报人姓名（默认 苏然）

示例:
  node scripts/phase-tracker.mjs start "S103 集成测试" "开始端到端集成测试" \\
    -n "API 联调" -n "UI 测试"
  node scripts/phase-tracker.mjs update "S103 集成测试" "完成 50%，API 联调中" \\
    -d "已通过用例" "37/74"
  node scripts/phase-tracker.mjs done "S103 集成测试" "全部用例通过" \\
    -d "总用例数" "74/74" -d "耗时" "2h 30m"
  node scripts/phase-tracker.mjs list
  node scripts/phase-tracker.mjs show "S103 集成测试"

数据存储: .reports/phase-state.json（不会提交到 git）
环境变量:
  FEISHU_WEBHOOK_URL   飞书群机器人 webhook（必填，否则仅在控制台打印）
`);
}

async function main() {
  ensureDir();
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }

  const cmd = argv[0];

  if (cmd === "list") { printList(); return; }
  if (cmd === "show") {
    if (!argv[1]) { console.error("❌ 缺少阶段名。用法: show <phase>"); process.exit(1); }
    printShow(argv[1]);
    return;
  }

  if (!["start", "update", "done", "block"].includes(cmd)) {
    console.error("❌ 未知命令:", cmd);
    printHelp();
    process.exit(1);
  }

  const phase = argv[1];
  const summary = argv[2];
  if (!phase) { console.error("❌ 缺少阶段名"); process.exit(1); }
  if (!summary) { console.error("❌ 缺少汇总描述"); process.exit(1); }

  const opts = parseArgs(argv.slice(3));
  const statusMap = { start: "IN_PROGRESS", update: "IN_PROGRESS", done: "DONE", block: "BLOCKED" };
  const status = statusMap[cmd];

  recordPhaseEvent(phase, status, summary, {
    details: opts.details,
    nextSteps: opts.nextSteps,
    risks: opts.risks
  });

  console.log(`${status === "DONE" ? "✅" : status === "BLOCKED" ? "🚧" : "🔧"} [${phase}] ${status} — ${summary}`);

  if (!opts.noSend) {
    await sendReport({
      phase, status, summary,
      details: opts.details,
      nextSteps: opts.nextSteps,
      risks: opts.risks,
      reporter: opts.reporter,
      webhook: opts.webhook
    });
  } else {
    console.log("ℹ --no-send 已设置，仅记录本地状态，不发送飞书。");
  }
}

main().catch((err) => { console.error("❌ 阶段追踪器异常:", err); process.exit(1); });
