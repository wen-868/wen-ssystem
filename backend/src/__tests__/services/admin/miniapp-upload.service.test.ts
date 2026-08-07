/**
 * miniapp-upload.service 单元测试（R96-05）
 *
 * 覆盖：AES-256-GCM 加解密往返、.key 扩展名校验、大小校验、未上传文件校验、
 * 上传/查询/解密读取的完整链路（存储目录通过 MINIAPP_KEY_STORAGE_DIR 注入临时目录）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MiniappUploadService,
  encryptBuffer,
  decryptBuffer,
  MAX_KEY_FILE_SIZE,
} from "../../../services/admin/miniapp-upload.service";

describe("services/admin/miniapp-upload", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.resetAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-key-test-"));
    process.env.MINIAPP_KEY_STORAGE_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.MINIAPP_KEY_STORAGE_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("加解密", () => {
    it("AES-256-GCM 加密后应能解密还原原文", () => {
      const original = Buffer.from("-----BEGIN PRIVATE KEY-----\nMOCKKEY\n-----END PRIVATE KEY-----\n");
      const encrypted = encryptBuffer(original);
      // 密文 = iv(12) + tag(16) + body，应不等于原文且更长
      expect(encrypted.equals(original)).toBe(false);
      expect(encrypted.length).toBeGreaterThan(original.length);
      expect(decryptBuffer(encrypted).toString("utf8")).toBe(original.toString("utf8"));
    });
  });

  describe("uploadKey 校验", () => {
    it("未接收到文件时应抛 400", async () => {
      await expect(
        MiniappUploadService.uploadKey("t1", "WECHAT", {} as never)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("非 .key 扩展名应抛 400", async () => {
      await expect(
        MiniappUploadService.uploadKey("t1", "WECHAT", {
          originalname: "upload.txt",
          buffer: Buffer.from("x"),
          size: 1,
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining(".key") });
    });

    it("超过 2MB 应抛 400", async () => {
      await expect(
        MiniappUploadService.uploadKey("t1", "WECHAT", {
          originalname: "private.key",
          buffer: Buffer.alloc(MAX_KEY_FILE_SIZE + 1),
          size: MAX_KEY_FILE_SIZE + 1,
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("过大") });
    });
  });

  describe("上传/查询/解密完整链路", () => {
    it("上传后应可查询状态并解密读取原文", async () => {
      const original = Buffer.from("-----BEGIN PRIVATE KEY-----\nMOCKKEY-123\n-----END PRIVATE KEY-----\n");
      const uploaded = await MiniappUploadService.uploadKey(
        "t1",
        "WECHAT",
        { originalname: "private.key", buffer: original, size: original.length },
        "password123"
      );

      expect(uploaded.configured).toBe(true);
      expect(uploaded.fileName).toBe("private.key");
      expect(uploaded.configuredAt).toBeTruthy();

      const status = MiniappUploadService.getKeyStatus("t1", "WECHAT");
      expect(status).toMatchObject({ configured: true, fileName: "private.key" });
      expect(status.configuredAt).toBeTruthy();

      const decrypted = MiniappUploadService.readDecryptedKey("t1", "WECHAT");
      expect(decrypted.toString("utf8")).toBe(original.toString("utf8"));

      // 落盘文件应为加密内容而非明文
      const keyPath = path.join(tempDir, "t1-WECHAT.key");
      const onDisk = fs.readFileSync(keyPath);
      expect(onDisk.includes(Buffer.from("MOCKKEY-123"))).toBe(false);
    });

    it("未配置时状态为未配置且解密读取抛 400", () => {
      const status = MiniappUploadService.getKeyStatus("t1", "ALIPAY");
      expect(status).toEqual({ configured: false, configuredAt: null, fileName: "" });
      expect(() => MiniappUploadService.readDecryptedKey("t1", "ALIPAY")).toThrow();
    });
  });
});
