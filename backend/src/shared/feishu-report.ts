import https from "node:https";
import { URL } from "node:url";

/**
 * 飞书工作汇报 — 通过群机器人 webhook 发送消息
 *
 * 用法:
 *   import { reportToLingZhou } from "./feishu-report.js";
 *   await reportToLingZhou({
 *     phase: "S102 接口自动化测试",
 *     status: "DONE",
 *     summary: "74 个测试用例全部通过",
 *     details: [...],
 *     reporter: "苏然",
 *     webhookUrl: process.env.FEISHU_WEBHOOK_URL
 *   });
 */

export interface ReportItem {
  label: string;
  value: string | number | boolean;
}

export interface ReportOptions {
  phase: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  summary: string;
  details?: ReportItem[];
  nextSteps?: string[];
  risks?: string[];
  reporter: string;
  webhookUrl?: string;
}

const STATUS_EMOJI: Record<ReportOptions["status"], string> = {
  TODO: "📋",
  IN_PROGRESS: "🔧",
  DONE: "✅",
  BLOCKED: "🚧"
};

const STATUS_LABEL: Record<ReportOptions["status"], string> = {
  TODO: "待开始",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
  BLOCKED: "阻塞"
};

function buildTextContent(opts: ReportOptions): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const lines: string[] = [
    `【工作汇报】${STATUS_EMOJI[opts.status]} ${STATUS_LABEL[opts.status]}`,
    "",
    `📌 阶段: ${opts.phase}`,
    `📝 汇总: ${opts.summary}`,
    `👤 汇报人: ${opts.reporter}`,
    `🕐 时间: ${dateStr}`
  ];

  if (opts.details && opts.details.length > 0) {
    lines.push("", "--- 明细 ---");
    for (const d of opts.details) {
      lines.push(`• ${d.label}: ${d.value}`);
    }
  }

  if (opts.nextSteps && opts.nextSteps.length > 0) {
    lines.push("", "--- 下一步 ---");
    for (const step of opts.nextSteps) {
      lines.push(`→ ${step}`);
    }
  }

  if (opts.risks && opts.risks.length > 0) {
    lines.push("", "--- 风险/阻塞 ---");
    for (const r of opts.risks) {
      lines.push(`⚠ ${r}`);
    }
  }

  return lines.join("\n");
}

function buildInteractiveContent(opts: ReportOptions): object {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const elements: any[] = [];

  elements.push({
    tag: "div",
    text: {
      tag: "lark_md",
      content: `**${STATUS_EMOJI[opts.status]} ${STATUS_LABEL[opts.status]} · ${opts.phase}**`
    }
  });

  elements.push({
    tag: "div",
    text: {
      tag: "lark_md",
      content: `**📝 汇总:** ${opts.summary}`
    }
  });

  if (opts.details && opts.details.length > 0) {
    const detailLines = opts.details
      .map((d) => `**${d.label}:** ${d.value}`)
      .join("\n");
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `---\n${detailLines}`
      }
    });
  }

  if (opts.nextSteps && opts.nextSteps.length > 0) {
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**→ 下一步:**\n${opts.nextSteps.map((s) => `• ${s}`).join("\n")}`
      }
    });
  }

  if (opts.risks && opts.risks.length > 0) {
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**⚠ 风险/阻塞:**\n${opts.risks.map((r) => `• ${r}`).join("\n")}`
      }
    });
  }

  elements.push({
    tag: "hr"
  });

  elements.push({
    tag: "div",
    text: {
      tag: "lark_md",
      content: `👤 ${opts.reporter} · ${dateStr}`
    }
  });

  return {
    msg_type: "interactive",
    card: {
      config: {
        wide_screen_mode: true
      },
      header: {
        template: opts.status === "DONE" ? "green" : opts.status === "BLOCKED" ? "red" : "blue",
        title: {
          tag: "plain_text",
          content: `${STATUS_EMOJI[opts.status]} ${opts.phase} — 工作汇报`
        }
      },
      elements
    }
  };
}

async function postHttpsJson(url: string, body: object): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const payload = JSON.stringify(body);

      const req = https.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data: JSON.parse(data || "{}") });
            } catch {
              resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data: null });
            }
          });
        }
      );
      req.on("error", (err) => {
        resolve({ ok: false, status: 0, data: { error: String(err) } });
      });
      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, data: { error: String(err) } });
    }
  });
}

export async function reportToLingZhou(opts: ReportOptions): Promise<{ ok: boolean; status: number; data: any }> {
  const webhook = opts.webhookUrl || process.env.FEISHU_WEBHOOK_URL;
  if (!webhook) {
    console.warn("⚠ [feishu-report] 未配置 FEISHU_WEBHOOK_URL，跳过飞书消息发送。");
    console.info("— 汇报摘要 —\n" + buildTextContent(opts) + "\n— — —");
    return { ok: false, status: 0, data: { error: "NO_WEBHOOK" } };
  }

  const body = buildInteractiveContent(opts);
  const result = await postHttpsJson(webhook, body);

  if (result.ok) {
    console.info("✅ [feishu-report] 已发送汇报到飞书群：", opts.phase);
  } else {
    console.warn("⚠ [feishu-report] 飞书消息发送失败:", result.status, result.data);
    // 降级为纯文本格式重试一次
    const fallback = await postHttpsJson(webhook, {
      msg_type: "text",
      content: { text: buildTextContent(opts) }
    });
    if (fallback.ok) {
      console.info("✅ [feishu-report] 已以文本格式重新发送汇报。");
      return fallback;
    }
  }

  return result;
}

export function buildTextReport(opts: ReportOptions): string {
  return buildTextContent(opts);
}
