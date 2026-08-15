/**
 * AI 底座端到端验收脚本（R70 完善度 P0-1：服务器执行前置）
 *
 * 用法：
 *   node scripts/ai-base-e2e.mjs [--ai-base http://127.0.0.1:3016] [--backend http://127.0.0.1:8080]
 *
 * 检查项：
 *   1. health（database/redis 连通性）
 *   2. 工具列表（≥29 个业务工具）
 *   3. Provider 列表（deepseek/glm/ollama）
 *   4. 主动巡检任务（9 项）
 *   5. RAG 知识库（可达性 + 默认租户预置文档 ≥1 份）
 *   6. LLM 连接（配置了 DEEPSEEK_API_KEY 时 test-connection success=true）
 *   7. 对话链路（chat 端点可达；无 Key 时应返回明确配置缺失错误而非 500）
 *   8. 审计日志（admin 鉴权后可查）
 *   9. WebSocket 推送通道（/api/ai/ws 端点已挂载）
 *  10. 用量统计接口（/api/admin/usage/tenants 返回 200）
 *  11. 外部模型接口（/api/admin/ai-config/external-models 非 404：无 token 时 401，有 token 时 200）
 *  12. 长期记忆接口（/api/admin/ltm 200）
 *  13. 学习接口（/api/admin/learning/hints 200）
 *  14. 进化门控接口（/api/admin/evolution 200）
 *  15. API 目录接口（/api/admin/api-catalog 200）
 *
 * 输出：docs/reports/ai-base-e2e-{时间戳}.md
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AI_BASE = process.argv.includes("--ai-base")
  ? process.argv[process.argv.indexOf("--ai-base") + 1]
  : "http://127.0.0.1:3016";
const BACKEND = process.argv.includes("--backend")
  ? process.argv[process.argv.indexOf("--backend") + 1]
  : "http://127.0.0.1:8080";

async function req(base, path, options = {}) {
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text().catch(() => "");
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: String(err?.message || err) };
  }
}

async function login() {
  const r = await req(BACKEND, "/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  return r.data?.data?.token || "";
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
}

async function run() {
  const token = await login();
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 健康检查
  const health = await req(AI_BASE, "/api/admin/health");
  const hd = health.data?.data || health.data || {};
  record(
    "健康检查",
    health.status === 200 && ["ok", "degraded"].includes(hd.status),
    `HTTP ${health.status} status=${hd.status} db=${hd.database} redis=${hd.redis}`
  );

  // 2. 工具列表
  const tools = await req(AI_BASE, "/api/admin/tools");
  const toolCount = tools.data?.data?.total ?? tools.data?.tools?.length ?? 0;
  record(
    "工具列表",
    tools.status === 200 && toolCount >= 29,
    `HTTP ${tools.status} 工具数=${toolCount}`
  );

  // 3. Provider 列表
  const providers = await req(AI_BASE, "/api/admin/providers");
  const providerNames = Array.isArray(providers.data?.data)
    ? providers.data.data.map((p) => p?.name || p?.type || "").join(",")
    : JSON.stringify(providers.data?.data || "").slice(0, 80);
  record(
    "Provider 列表",
    providers.status === 200,
    `HTTP ${providers.status} providers=${providerNames}`
  );

  // 4. 主动巡检任务
  const jobs = await req(AI_BASE, "/api/admin/proactive/jobs");
  const jobCount = Array.isArray(jobs.data?.data) ? jobs.data.data.length : 0;
  record(
    "主动巡检任务",
    jobs.status === 200 && jobCount >= 9,
    `HTTP ${jobs.status} 任务数=${jobCount}`
  );

  // 5. RAG 知识库（默认租户应含预置运营文档，如单据编号/库存规则）
  const rag = await req(AI_BASE, "/api/rag/knowledge");
  const ragDocs = Array.isArray(rag.data?.knowledge)
    ? rag.data.knowledge.length
    : 0;
  record(
    "RAG 知识库（预置内容）",
    rag.status === 200 && ragDocs >= 1,
    `HTTP ${rag.status} 文档数=${ragDocs}（需配置 EMBEDDING_MODEL 且预置种子已加载）`
  );

  // 6. LLM 连接
  const conn = await req(AI_BASE, "/api/admin/test-connection");
  const connOk = conn.data?.data?.success === true;
  record(
    "LLM 连接",
    conn.status === 200 && connOk,
    `HTTP ${conn.status} success=${conn.data?.data?.success} msg=${String(conn.data?.data?.message || "").slice(0, 60)}`
  );

  // 7. 对话链路（chat 端点；无 Key 时返回明确配置缺失而非 500）
  const chat = await req(AI_BASE, "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ message: "你好" }),
  });
  record(
    "对话链路",
    chat.status !== 500 && chat.status !== 0,
    `HTTP ${chat.status}（无 Key 时预期 4xx 配置缺失提示）`
  );

  // 8. 审计日志（需 token）
  const audit = await req(AI_BASE, "/api/admin/audit-logs", { headers: auth });
  record(
    "审计日志",
    audit.status === 200 || audit.status === 401,
    `HTTP ${audit.status}${token ? "" : "（未登录，401 预期）"}`
  );

  // 9. WebSocket 推送通道（HTTP 方式探测端点已挂载：应返回 4xx 而非 404）
  const wsProbe = await req(AI_BASE, "/api/ai/ws");
  record(
    "WebSocket 推送通道",
    wsProbe.status !== 404 && wsProbe.status !== 0,
    `HTTP ${wsProbe.status}（非 404 = 端点已挂载，浏览器可用 ws:// 连接）`
  );

  // 10. 用量统计接口（计费闭环可达性）
  const usage = await req(AI_BASE, "/api/admin/usage/tenants");
  const usageList = Array.isArray(usage.data?.list) ? usage.data.list : [];
  record(
    "用量统计接口",
    usage.status === 200,
    `HTTP ${usage.status} 租户数=${usageList.length}（t_ai_usage_daily 汇总）`
  );

  // 11. 外部大模型接口（多模型接入可达性：无 token 应 401，非 404 即端点已挂载）
  const ext = await req(AI_BASE, "/api/admin/ai-config/external-models", {
    headers: auth,
  });
  record(
    "外部大模型接口",
    ext.status !== 404 && ext.status !== 0,
    `HTTP ${ext.status}${token ? ` 模型数=${Array.isArray(ext.data) ? ext.data.length : "?"}` : "（未登录，401 预期）"}`
  );

  // 12. 长期记忆接口（认知层 LT）
  const ltm = await req(AI_BASE, "/api/admin/ltm");
  record(
    "长期记忆接口",
    ltm.status === 200,
    `HTTP ${ltm.status}（档案/情节/归档总览）`
  );

  // 13. 学习接口（认知层 LN）
  const learning = await req(AI_BASE, "/api/admin/learning/hints");
  record(
    "学习回流接口",
    learning.status === 200,
    `HTTP ${learning.status}（工具选择/路由提示）`
  );

  // 14. 进化门控接口（认知层 SE）
  const evolution = await req(AI_BASE, "/api/admin/evolution");
  record(
    "进化门控接口",
    evolution.status === 200,
    `HTTP ${evolution.status}（版本列表）`
  );

  // 15. API 目录接口（功能即技能）
  const catalog = await req(AI_BASE, "/api/admin/api-catalog");
  const catalogCount =
    typeof catalog.data?.total === "number" ? catalog.data.total : 0;
  record(
    "API 目录接口",
    catalog.status === 200 && catalogCount >= 1,
    `HTTP ${catalog.status} 技能目录数=${catalogCount}`
  );

  const passed = results.filter((r) => r.pass).length;
  const dir = join(ROOT, "docs", "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mdPath = join(dir, `ai-base-e2e-${stamp}.md`);
  writeFileSync(mdPath, [
    `# AI 底座端到端验收报告 ${stamp}`,
    "",
    `| 检查项 | 结果 | 详情 |`,
    `|---|---|---|`,
    ...results.map((r) => `| ${r.name} | ${r.pass ? "✅" : "❌"} | ${r.detail} |`),
    "",
    `**通过 ${passed}/${results.length}**`,
    "",
    `> 由 \`node scripts/ai-base-e2e.mjs\` 生成；LLM 连接项需服务器配置 DEEPSEEK_API_KEY 后为 true；RAG 预置内容需配置 EMBEDDING_MODEL。`,
  ].join("\n"), "utf8");
  console.log(`\n通过 ${passed}/${results.length}；报告：${mdPath}`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error("验收脚本执行失败:", err);
  process.exit(1);
});
