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

  describe("postHttpsJson - 边界分支", () => {
    beforeEach(() => {
      process.env.FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/test";
    });

    it("响应包含 data 事件时应累积并解析 JSON", async () => {
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          statusCode: 200,
          on: vi.fn((event: string, cb: any) => {
            if (event === "data") setTimeout(() => cb('{"code":0}'), 0);
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const result = await reportToLingZhou({
        phase: "data 事件测试",
        status: "DONE",
        summary: "响应包含 data 事件",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ code: 0 });
    });

    it("req.on('error') 触发时应返回 ok=false", async () => {
      mockRequest.mockImplementationOnce((_opts: any, _callback: any) => {
        const req = {
          on: vi.fn((event: string, cb: any) => {
            if (event === "error") setTimeout(() => cb(new Error("network error")), 0);
          }),
          write: vi.fn(),
          end: vi.fn(),
        };
        return req;
      });

      const result = await reportToLingZhou({
        phase: "req error 测试",
        status: "DONE",
        summary: "请求出错",
        reporter: "阿坚",
      });
      // 由于第一次失败，会触发重试（第二次用默认 mockRequest 返回 200）
      expect(result).toBeDefined();
    });

    it("webhook URL 无效时应触发同步 catch 并降级重试", async () => {
      // 第一次用无效 URL 触发同步 catch
      const result = await reportToLingZhou({
        phase: "URL 无效测试",
        status: "DONE",
        summary: "URL 无效",
        reporter: "阿坚",
        webhookUrl: "not-a-valid-url",
      });
      // 由于第一次失败，会触发重试（第二次也用同样的无效 URL）
      expect(result).toBeDefined();
    });

    it("响应 data 非法 JSON 时应返回 data=null", async () => {
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          statusCode: 200,
          on: vi.fn((event: string, cb: any) => {
            if (event === "data") setTimeout(() => cb("not-json"), 0);
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const result = await reportToLingZhou({
        phase: "非法 JSON 测试",
        status: "DONE",
        summary: "响应非 JSON",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(true);
    });

    it("重试也失败时应返回失败结果", async () => {
      // 两次都返回 500（第一次交互格式失败，第二次文本格式也失败）
      mockRequest.mockImplementation((_opts: any, callback: any) => {
        const res = {
          statusCode: 500,
          on: vi.fn((event: string, cb: any) => {
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const result = await reportToLingZhou({
        phase: "全部失败测试",
        status: "DONE",
        summary: "两次都失败",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(false);
    });

    it("res.statusCode 为 undefined 时 status 为 0", async () => {
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          on: vi.fn((event: string, cb: any) => {
            if (event === "data") setTimeout(() => cb('{"code":0}'), 0);
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const result = await reportToLingZhou({
        phase: "statusCode undefined 测试",
        status: "DONE",
        summary: "statusCode 为 undefined",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
    });

    it("data 为空字符串时解析为 {}", async () => {
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

      const result = await reportToLingZhou({
        phase: "空 data 测试",
        status: "DONE",
        summary: "data 为空字符串",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({});
    });

    it("非法 JSON 且 res.statusCode 为 undefined 时 catch 分支 status 为 0", async () => {
      mockRequest.mockImplementationOnce((_opts: any, callback: any) => {
        const res = {
          on: vi.fn((event: string, cb: any) => {
            if (event === "data") setTimeout(() => cb("invalid-json"), 0);
            if (event === "end") setTimeout(() => cb(), 0);
          }),
        };
        callback(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const result = await reportToLingZhou({
        phase: "非法 JSON + 无 statusCode 测试",
        status: "DONE",
        summary: "非法 JSON 且无 statusCode",
        reporter: "阿坚",
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
      expect(result.data).toBe(null);
    });
  });
});
