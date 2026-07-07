import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 在 vi.hoisted 中创建可共享的 mock request 函数
const { mockRequest } = vi.hoisted(() => {
  const mockRequest = vi.fn((_options: any, callback: any) => {
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: any) => {
        if (event === "end") setTimeout(() => cb(), 0);
      }),
    };
    callback(res);
    return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
  });
  return { mockRequest };
});

vi.mock("https", () => ({
  default: { request: mockRequest },
}));

vi.mock("../../shared/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { reportToLingZhou, buildTextReport } from "../../shared/feishu-report.js";

describe("feishu-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FEISHU_WEBHOOK_URL;
    delete process.env.FEISHU_ALERT_WEBHOOK_URL;
  });

  afterEach(() => {
    delete process.env.FEISHU_WEBHOOK_URL;
    delete process.env.FEISHU_ALERT_WEBHOOK_URL;
  });

  describe("buildTextReport", () => {
    it("应包含阶段和汇总信息", () => {
      const text = buildTextReport({
        phase: "测试阶段",
        status: "DONE",
        summary: "测试完成",
        reporter: "阿坚",
      });
      expect(text).toContain("测试阶段");
      expect(text).toContain("测试完成");
      expect(text).toContain("阿坚");
    });

    it("应包含明细信息", () => {
      const text = buildTextReport({
        phase: "P1",
        status: "IN_PROGRESS",
        summary: "进行中",
        reporter: "苏然",
        details: [
          { label: "通过", value: 80 },
          { label: "失败", value: 2 },
        ],
      });
      expect(text).toContain("通过");
      expect(text).toContain("80");
    });

    it("应包含下一步信息", () => {
      const text = buildTextReport({
        phase: "P2",
        status: "TODO",
        summary: "待开始",
        reporter: "墨",
        nextSteps: ["编写组件", "集成测试"],
      });
      expect(text).toContain("编写组件");
    });

    it("应包含风险信息", () => {
      const text = buildTextReport({
        phase: "P3",
        status: "BLOCKED",
        summary: "阻塞中",
        reporter: "阿澈",
        risks: ["依赖未就绪"],
      });
      expect(text).toContain("依赖未就绪");
    });

    it("无可选字段时只输出基本信息", () => {
      const text = buildTextReport({
        phase: "P4",
        status: "DONE",
        summary: "简单汇报",
        reporter: "凌舟",
      });
      expect(text).toContain("P4");
    });
  });

  describe("reportToLingZhou - 无 webhook", () => {
    it("无 webhookUrl 时返回 ok=false", async () => {
      const result = await reportToLingZhou({
        phase: "测试",
        status: "DONE",
        summary: "无 webhook 测试",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(false);
      expect(result.data.error).toBe("NO_WEBHOOK");
    });
  });

  describe("reportToLingZhou - 有 webhook（成功）", () => {
    beforeEach(() => {
      process.env.FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/test";
    });

    it("有 webhook 且返回 200 时应成功", async () => {
      const result = await reportToLingZhou({
        phase: "成功测试",
        status: "DONE",
        summary: "webhook 成功",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("IN_PROGRESS 状态应正常发送", async () => {
      const result = await reportToLingZhou({
        phase: "进行中",
        status: "IN_PROGRESS",
        summary: "正在执行",
        reporter: "墨",
        details: [{ label: "进度", value: "50%" }],
      });
      expect(result.ok).toBe(true);
    });

    it("BLOCKED 状态应正常发送", async () => {
      const result = await reportToLingZhou({
        phase: "阻塞",
        status: "BLOCKED",
        summary: "遇到阻塞",
        reporter: "阿澈",
        risks: ["API 不稳定"],
        nextSteps: ["等待修复"],
      });
      expect(result.ok).toBe(true);
    });

    it("使用 opts.webhookUrl 优先于环境变量", async () => {
      const result = await reportToLingZhou({
        phase: "自定义 webhook",
        status: "DONE",
        summary: "使用 opts.webhookUrl",
        reporter: "阿坚",
        webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/custom",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("reportToLingZhou - 失败重试", () => {
    beforeEach(() => {
      process.env.FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/test";

      // 第一次调用返回 500（失败）
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          statusCode: 500,
          on: vi.fn((event: string, cb: any) => {
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });
      // 第二次调用（重试）返回 200
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          statusCode: 200,
          on: vi.fn((event: string, cb: any) => {
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });
    });

    it("第一次失败应降级为文本格式重试", async () => {
      const result = await reportToLingZhou({
        phase: "重试测试",
        status: "DONE",
        summary: "第一次失败，重试成功",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(true);
    });
  });
});
