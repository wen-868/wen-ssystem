#!/usr/bin/env node
/**
 * 阶段工作汇报 —— CLI 发送器
 * 自动读取项目根目录 .env 文件中的 FEISHU_WEBHOOK_URL
 *
 * 用法:
 *   node scripts/send-report.mjs --phase "S103 集成测试" --status DONE \
 *     --summary "74/74 测试用例全部通过"
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";

// 自动加载项目根目录 .env
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    phase: "",
    status: "IN_PROGRESS",
    summary: "",
    details: [],
    nextSteps: [],
    risks: [],
    reporter: "苏然",
    webhook: process.env.FEISHU_WEBHOOK_URL || ""
  };

  let cursor = 0;
  while (cursor < argv.length) {
    const a = argv[cursor];
    if (a === "--phase" || a === "-p") {
      args.phase = argv[++cursor];
    } else if (a === "--status" || a === "-s") {
      args.status = argv[++cursor];
    } else if (a === "--summary" || a === "-m") {
      args.summary = argv[++cursor];
    } else if (a === "--detail" || a === "-d") {
      args.details.push({ label: argv[++cursor], value: argv[++cursor] });
    } else if (a === "--next" || a === "-n") {
      args.nextSteps.push(argv[++cursor]);
    } else if (a === "--risk" || a === "-r") {
      args.risks.push(argv[++cursor]);
    } else if (a === "--reporter") {
      args.reporter = argv[++cursor];
    } else if (a === "--webhook" || a === "-w") {
      args.webhook = argv[++cursor];
    } else {
      cursor++;
    }
    cursor++;
  }
  return args;
}

function postJson(url, body) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const payload = JSON.stringify(body);

      const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;

      if (proxy) {
        const proxyUrl = new URL(proxy);
        http.request({
          hostname: proxyUrl.hostname,
          port: proxyUrl.port || 8080,
          method: "CONNECT",
          path: urlObj.hostname + ":" + (urlObj.port || 443)
        }).on("connect", (res, socket) => {
          if (res.statusCode !== 200) {
            resolve({ ok: false, status: res.statusCode, data: { error: "CONNECT failed: " + res.statusCode } });
            return;
          }
          const req = https.request({
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            socket,
            agent: false,
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
        }).on("error", (err) => {
          resolve({ ok: false, status: 0, data: { error: String(err) } });
        }).end();
        return;
      }

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

function formatText(opts) {
  const now = new Date();
  const emoji = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[opts.status] || "📌";
  const label = { TODO: "待开始", IN_PROGRESS: "进行中", DONE: "已完成", BLOCKED: "阻塞" }[opts.status] || "未知";
  const lines = [
    `【工作汇报】${emoji} ${label}`,
    "",
    `📌 阶段: ${opts.phase}`,
    `📝 汇总: ${opts.summary}`,
    `👤 汇报人: ${opts.reporter}`,
    `🕐 时间: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  ];
  if (opts.details.length) {
    lines.push("", "--- 明细 ---");
    for (const d of opts.details) lines.push(`• ${d.label}: ${d.value}`);
  }
  if (opts.nextSteps.length) {
    lines.push("", "--- 下一步 ---");
    for (const s of opts.nextSteps) lines.push(`→ ${s}`);
  }
  if (opts.risks.length) {
    lines.push("", "--- 风险/阻塞 ---");
    for (const r of opts.risks) lines.push(`⚠ ${r}`);
  }
  return lines.join("\n");
}

function buildCard(opts) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const template = opts.status === "DONE" ? "green" : opts.status === "BLOCKED" ? "red" : "blue";
  const emoji = { TODO: "📋", IN_PROGRESS: "🔧", DONE: "✅", BLOCKED: "🚧" }[opts.status] || "📌";
  const label = { TODO: "待开始", IN_PROGRESS: "进行中", DONE: "已完成", BLOCKED: "阻塞" }[opts.status] || "未知";

  const elements = [
    { tag: "div", text: { tag: "lark_md", content: `**${emoji} ${label} · ${opts.phase}**` } },
    { tag: "div", text: { tag: "lark_md", content: `**📝 汇总:** ${opts.summary}` } }
  ];

  if (opts.details.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `---\n${opts.details.map((d) => `**${d.label}:** ${d.value}`).join("\n")}` }
    });
  }
  if (opts.nextSteps.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `**→ 下一步:**\n${opts.nextSteps.map((s) => `• ${s}`).join("\n")}` }
    });
  }
  if (opts.risks.length) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `**⚠ 风险/阻塞:**\n${opts.risks.map((r) => `• ${r}`).join("\n")}` }
    });
  }
  elements.push({ tag: "hr" });
  elements.push({ tag: "div", text: { tag: "lark_md", content: `👤 ${opts.reporter} · ${dateStr}` } });

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

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(`阶段工作汇报发送器

使用方式:
  node scripts/send-report.mjs --phase "阶段名称" --status DONE --summary "摘要" \\
    --detail "模块A" "10个用例通过" --detail "模块B" "接口已就绪" \\
    --next "S103 集成测试" --reporter "苏然"

参数:
  --phase, -p       阶段名称（必填）
  --status, -s      状态: TODO / IN_PROGRESS / DONE / BLOCKED（默认 IN_PROGRESS）
  --summary, -m     一句话摘要（必填）
  --detail, -d      明细项，格式: <label> <value>，可重复
  --next, -n        下一步计划，可重复
  --risk, -r        风险/阻塞，可重复
  --reporter        汇报人（默认 苏然）
  --webhook, -w     飞书机器人 webhook URL（也可通过 FEISHU_WEBHOOK_URL 环境变量）

示例:
  node scripts/send-report.mjs -p "S102 接口自动化测试" -s DONE \\
    -m "74/74 测试用例全部通过" -d "采购模块" "50个新增测试用例" -d "总用例数" "74个" \\
    -n "S103 端到端集成测试" -n "前端联调" --reporter "苏然"
`);
    process.exit(0);
  }

  const opts = parseArgs(argv);

  if (!opts.phase) { console.error("❌ 缺少 --phase"); process.exit(1); }
  if (!opts.summary) { console.error("❌ 缺少 --summary"); process.exit(1); }
  if (!["TODO", "IN_PROGRESS", "DONE", "BLOCKED"].includes(opts.status)) {
    console.error("❌ --status 必须是 TODO / IN_PROGRESS / DONE / BLOCKED");
    process.exit(1);
  }

  if (!opts.webhook) {
    console.warn("⚠ 未配置 FEISHU_WEBHOOK_URL，仅在控制台打印：");
    console.log("\n" + formatText(opts) + "\n");
    process.exit(0);
  }

  console.log(`📤 发送汇报: ${opts.status} · ${opts.phase}`);

  const result = await postJson(opts.webhook, buildCard(opts));
  if (result.ok) {
    console.log("✅ 飞书消息已发送");
  } else {
    console.warn("⚠ 富文本发送失败，降级为纯文本重试…");
    const fallback = await postJson(opts.webhook, {
      msg_type: "text",
      content: { text: formatText(opts) }
    });
    if (fallback.ok) {
      console.log("✅ 已以文本格式发送");
    } else {
      console.error("❌ 发送全部失败:", fallback.status, fallback.data);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("❌ 发送过程异常:", err);
  process.exit(1);
});
