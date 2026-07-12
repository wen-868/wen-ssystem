/**
 * 系统资源监控服务单元测试
 * 被测文件：src/services/admin/system-monitor.service.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 使用 vi.hoisted 提升 mock，确保在 import 之前注册
const osMock = vi.hoisted(() => ({
  loadavg: vi.fn(() => [1.5, 1.0, 0.8]),
}));

const dbMock = vi.hoisted(() => ({
  queryOne: vi.fn(),
}));

vi.mock("node:os", () => ({
  default: {
    loadavg: osMock.loadavg,
  },
}));

vi.mock("../../../shared/db", () => ({
  queryOne: dbMock.queryOne,
  query: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import {
  getMemoryUsage,
  getCpuUsage,
  getProcessInfo,
  getSystemHealth,
} from "../../../services/admin/system-monitor.service";

describe("system-monitor.service", () => {
  let memorySpy: ReturnType<typeof vi.spyOn>;
  let uptimeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    memorySpy = vi.spyOn(process, "memoryUsage").mockReturnValue({
      rss: 100,
      heapTotal: 200,
      heapUsed: 150,
      external: 50,
      arrayBuffers: 10,
    });
    uptimeSpy = vi.spyOn(process, "uptime").mockReturnValue(3600);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getMemoryUsage", () => {
    it("返回正确格式的内存信息", () => {
      const mem = getMemoryUsage();
      expect(mem).toEqual({
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
      });
      expect(memorySpy).toHaveBeenCalled();
    });

    it("所有字段均为数字", () => {
      const mem = getMemoryUsage();
      expect(typeof mem.rss).toBe("number");
      expect(typeof mem.heapTotal).toBe("number");
      expect(typeof mem.heapUsed).toBe("number");
      expect(typeof mem.external).toBe("number");
    });
  });

  describe("getCpuUsage", () => {
    it("返回正确格式的 CPU 负载信息", () => {
      const cpu = getCpuUsage();
      expect(cpu).toEqual({
        loadAverage1: 1.5,
        loadAverage5: 1.0,
        loadAverage15: 0.8,
      });
      expect(osMock.loadavg).toHaveBeenCalled();
    });

    it("所有字段均为数字", () => {
      const cpu = getCpuUsage();
      expect(typeof cpu.loadAverage1).toBe("number");
      expect(typeof cpu.loadAverage5).toBe("number");
      expect(typeof cpu.loadAverage15).toBe("number");
    });
  });

  describe("getProcessInfo", () => {
    it("返回正确格式的进程信息", () => {
      const info = getProcessInfo();
      expect(typeof info.pid).toBe("number");
      expect(info.uptime).toBe(3600);
      expect(typeof info.nodeVersion).toBe("string");
      expect(uptimeSpy).toHaveBeenCalled();
    });

    it("pid 为当前进程 ID", () => {
      const info = getProcessInfo();
      expect(info.pid).toBe(process.pid);
    });
  });

  describe("getSystemHealth", () => {
    it("数据库连接成功时返回 UP 状态", async () => {
      dbMock.queryOne.mockResolvedValue({ "1": 1 });
      const health = await getSystemHealth();
      expect(health.status).toBe("UP");
      expect(health.database.status).toBe("connected");
      expect(health.memory).toEqual({
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
      });
      expect(health.cpu).toEqual({
        loadAverage1: 1.5,
        loadAverage5: 1.0,
        loadAverage15: 0.8,
      });
      expect(typeof health.timestamp).toBe("string");
    });

    it("数据库连接失败时返回 DOWN 状态", async () => {
      dbMock.queryOne.mockRejectedValue(new Error("DB connection failed"));
      const health = await getSystemHealth();
      expect(health.status).toBe("DOWN");
      expect(health.database.status).toBe("disconnected");
    });

    it("包含 memory、cpu、database、status、timestamp 字段", async () => {
      dbMock.queryOne.mockResolvedValue(null);
      const health = await getSystemHealth();
      expect(health).toHaveProperty("memory");
      expect(health).toHaveProperty("cpu");
      expect(health).toHaveProperty("database");
      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("timestamp");
    });

    it("调用 queryOne 执行 SELECT 1 检查数据库连接", async () => {
      dbMock.queryOne.mockResolvedValue({ "1": 1 });
      await getSystemHealth();
      expect(dbMock.queryOne).toHaveBeenCalledWith("SELECT 1");
    });
  });
});
