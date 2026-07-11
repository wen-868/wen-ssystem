import { describe, it, expect } from "vitest";
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  needsRehash,
} from "../../shared/password.js";

describe("password", () => {
  describe("hashPassword", () => {
    it("应返回带 v2$ 前缀的 bcrypt 哈希字符串", async () => {
      const hash = await hashPassword("test123");
      expect(typeof hash).toBe("string");
      expect(hash).toMatch(/^v2\$\$2[ab]?\$/);
    });

    it("相同密码每次哈希结果不同（盐值随机）", async () => {
      const h1 = await hashPassword("test123");
      const h2 = await hashPassword("test123");
      expect(h1).not.toBe(h2);
    });

    it("空字符串也能正常哈希", async () => {
      const hash = await hashPassword("");
      expect(hash).toMatch(/^v2\$\$2[ab]?\$/);
    });
  });

  describe("hashPasswordSync", () => {
    it("同步哈希应返回带 v2$ 前缀的有效 bcrypt 格式", () => {
      const hash = hashPasswordSync("mypassword");
      expect(hash).toMatch(/^v2\$\$2[ab]?\$/);
    });

    it("长密码也能正常哈希", () => {
      const longPwd = "a".repeat(72);
      const hash = hashPasswordSync(longPwd);
      expect(hash).toMatch(/^v2\$\$2[ab]?\$/);
    });
  });

  describe("verifyPassword", () => {
    it("正确密码应返回 true", async () => {
      const hash = await hashPassword("correct123");
      const result = await verifyPassword("correct123", hash);
      expect(result).toBe(true);
    });

    it("错误密码应返回 false", async () => {
      const hash = await hashPassword("correct123");
      const result = await verifyPassword("wrong456", hash);
      expect(result).toBe(false);
    });

    it("空密码与哈希不匹配应返回 false", async () => {
      const hash = await hashPassword("realpassword");
      const result = await verifyPassword("", hash);
      expect(result).toBe(false);
    });

    it("旧密码（无 v2$ 前缀）也能正常验证", async () => {
      // 模拟旧版本哈希（无 v2$ 前缀）
      const bcrypt = await import("bcryptjs");
      const oldHash = await bcrypt.hash("legacy123", 10);
      const result = await verifyPassword("legacy123", oldHash);
      expect(result).toBe(true);
    });
  });

  describe("verifyPasswordSync", () => {
    it("同步验证正确密码应返回 true", () => {
      const hash = hashPasswordSync("password");
      expect(verifyPasswordSync("password", hash)).toBe(true);
    });

    it("同步验证错误密码应返回 false", () => {
      const hash = hashPasswordSync("password");
      expect(verifyPasswordSync("nope", hash)).toBe(false);
    });

    it("同步验证与异步哈希兼容", async () => {
      const hash = await hashPassword("compat");
      expect(verifyPasswordSync("compat", hash)).toBe(true);
    });
  });

  describe("needsRehash", () => {
    it("v2$ 前缀且 SALT_ROUNDS=12 的哈希不需要重新加密", async () => {
      const hash = await hashPassword("test123");
      expect(needsRehash(hash)).toBe(false);
    });

    it("无 v2$ 前缀的旧哈希需要重新加密", async () => {
      const bcrypt = await import("bcryptjs");
      const oldHash = await bcrypt.hash("old123", 10);
      expect(needsRehash(oldHash)).toBe(true);
    });

    it("v2$ 前缀但 cost 不匹配的哈希需要重新加密", async () => {
      const bcrypt = await import("bcryptjs");
      const lowCostHash = "v2$" + (await bcrypt.hash("test123", 10));
      expect(needsRehash(lowCostHash)).toBe(true);
    });
  });
});
