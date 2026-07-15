import { describe, it, expect, vi, beforeEach } from "vitest";
import * as configService from "@services/platform/platform-config.service";
import * as announcementService from "@services/platform/platform-announcement.service";
import { listConfigs, updateConfig, listAnnouncements, createAnnouncement } from "@controllers/platform/platform-manage.controller";

vi.mock("@services/platform/platform-config.service");
vi.mock("@services/platform/platform-announcement.service");

describe("platform-manage.controller", () => {
  const mockReq = {
    query: {},
    body: {},
    user: { id: 1 },
  };

  const mockRes = {
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listConfigs", () => {
    it("should list configs without category", async () => {
      const mockResult = [{ key: "test", value: "value" }];
      (configService.listPlatformConfigs as vi.Mock).mockResolvedValue(mockResult);

      await listConfigs({ query: {} } as any, mockRes);

      expect(configService.listPlatformConfigs).toHaveBeenCalledWith(undefined);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });

    it("should list configs with category", async () => {
      const mockResult = [{ key: "test", value: "value" }];
      (configService.listPlatformConfigs as vi.Mock).mockResolvedValue(mockResult);

      await listConfigs({ query: { category: "system" } } as any, mockRes);

      expect(configService.listPlatformConfigs).toHaveBeenCalledWith("system");
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });
  });

  describe("updateConfig", () => {
    it("should update config successfully", async () => {
      const mockResult = { key: "test", value: "new_value" };
      (configService.updatePlatformConfig as vi.Mock).mockResolvedValue(mockResult);

      await updateConfig({ body: { key: "test", value: "new_value" } } as any, mockRes);

      expect(configService.updatePlatformConfig).toHaveBeenCalledWith("test", "new_value", "platform");
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });

    it("should handle validation error when key is missing", async () => {
      const mockNext = vi.fn();
      await updateConfig({ body: { value: "new_value" } } as any, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("listAnnouncements", () => {
    it("should list announcements with default params", async () => {
      const mockResult = { list: [], total: 0 };
      (announcementService.listAnnouncements as vi.Mock).mockResolvedValue(mockResult);

      await listAnnouncements({ query: {} } as any, mockRes);

      expect(announcementService.listAnnouncements).toHaveBeenCalledWith({
        status: undefined,
        type: undefined,
        page: 1,
        pageSize: 20,
      });
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });

    it("should list announcements with custom params", async () => {
      const mockResult = { list: [], total: 0 };
      (announcementService.listAnnouncements as vi.Mock).mockResolvedValue(mockResult);

      await listAnnouncements({ query: { page: 2, pageSize: 10, status: "ACTIVE", type: "NOTICE" } } as any, mockRes);

      expect(announcementService.listAnnouncements).toHaveBeenCalledWith({
        status: "ACTIVE",
        type: "NOTICE",
        page: 2,
        pageSize: 10,
      });
    });
  });

  describe("createAnnouncement", () => {
    it("should create announcement successfully", async () => {
      const mockResult = { id: 1, title: "Test", content: "Content" };
      (announcementService.createAnnouncement as vi.Mock).mockResolvedValue(mockResult);

      await createAnnouncement({
        body: { title: "Test", content: "Content", type: "NOTICE", topFlag: 0 },
        user: { id: 1 },
      } as any, mockRes);

      expect(announcementService.createAnnouncement).toHaveBeenCalledWith({
        title: "Test",
        content: "Content",
        type: "NOTICE",
        topFlag: 0,
        createdBy: 1,
      });
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });

    it("should create announcement with default values", async () => {
      const mockResult = { id: 1, title: "Test", content: "Content" };
      (announcementService.createAnnouncement as vi.Mock).mockResolvedValue(mockResult);

      await createAnnouncement({
        body: { title: "Test", content: "Content" },
        user: { id: 1 },
      } as any, mockRes);

      expect(announcementService.createAnnouncement).toHaveBeenCalledWith({
        title: "Test",
        content: "Content",
        type: "NOTICE",
        topFlag: 0,
        createdBy: 1,
      });
    });
  });
});
