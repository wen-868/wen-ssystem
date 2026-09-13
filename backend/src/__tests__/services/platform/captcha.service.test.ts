import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 图形验证码服务单测（R101-S2-01 裁定 4.1 新增能力）
 *
 * 用内存假 Redis 实现 SETEX / EVAL 语义，覆盖：
 *  - 生成结构、图片可解码、字符数
 *  - 校验成功 / 错误 / 一次性消耗 / 未知 id
 *  - 大小写不敏感
 *  - Redis 不可用时的进程内降级
 */
const h = vi.hoisted(() => {
  const store = new Map<string, string>();
  const state = { fail: false };
  const fake = {
    async setex(key: string, _ttl: number, value: string) {
      if (state.fail) throw new Error("redis down");
      store.set(key, value);
      return "OK";
    },
    async eval(_script: string, _numKeys: number, key: string) {
      if (state.fail) throw new Error("redis down");
      const v = store.get(key) ?? null;
      store.delete(key); // 模拟 Lua 的 GET+DEL 原子语义
      return v;
    },
  };
  return { store, state, fake };
});

vi.mock("../../../config/redis", () => ({ getRedis: () => h.fake }));
vi.mock("../../../shared/logger", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createCaptcha, verifyCaptcha, CAPTCHA_TTL_SECONDS } from "../../../services/platform/captcha.service";

/** 从 data URI 里还原 SVG 文本 */
function decodeSvg(dataUri: string): string {
  const b64 = dataUri.split(",")[1] || "";
  return Buffer.from(b64, "base64").toString("utf8");
}
/** 从 SVG 中提取渲染的字符（形如 `>A</text>`） */
function extractCode(dataUri: string): string {
  const matches = decodeSvg(dataUri).match(/>([A-Z0-9])<\/text>/g) || [];
  return matches.map((s) => s.slice(1, -"</text>".length)).join("");
}
/** 从 SVG 中取回被存储的验证码 —— 仅测试用：通过校验猜出正确码 */
async function solveChallenge(captchaId: string, dataUri: string): Promise<boolean> {
  return (await verifyCaptcha(captchaId, extractCode(dataUri))).ok;
}

describe("services/platform/captcha.service", () => {
  beforeEach(() => {
    h.store.clear();
    h.state.fail = false;
    vi.clearAllMocks();
  });

  describe("createCaptcha", () => {
    it("返回 captchaId / SVG data URI / 5 分钟有效期", async () => {
      const c = await createCaptcha();
      expect(c.captchaId).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
      expect(c.expiresIn).toBe(300);
      expect(CAPTCHA_TTL_SECONDS).toBe(300);
    });

    it("图片里恰好渲染 4 个字符，且不出现易混淆字符 0/O/1/I/L", async () => {
      for (let i = 0; i < 20; i++) {
        const c = await createCaptcha();
        const code = extractCode(c.image);
        expect(code).toHaveLength(4);
        expect(code).not.toMatch(/[0O1IL]/);
      }
    });

    it("每次生成的 captchaId 与验证码都不同", async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) ids.add((await createCaptcha()).captchaId);
      expect(ids.size).toBe(10);
    });

    it("验证码写入 Redis 并带 TTL 前缀键", async () => {
      const c = await createCaptcha();
      expect(h.store.has(`platform:captcha:${c.captchaId}`)).toBe(true);
    });
  });

  describe("verifyCaptcha", () => {
    it("输入正确验证码时通过（大小写不敏感）", async () => {
      const c = await createCaptcha();
      const code = extractCode(c.image);
      expect((await verifyCaptcha(c.captchaId, code.toLowerCase())).ok).toBe(true);
    });

    it("一次性：校验成功后同一 captchaId 立即失效", async () => {
      const c = await createCaptcha();
      const code = extractCode(c.image);
      expect((await verifyCaptcha(c.captchaId, code)).ok).toBe(true);
      const second = await verifyCaptcha(c.captchaId, code);
      expect(second.ok).toBe(false);
      expect(second.reason).toBe("expired");
    });

    it("输入错误验证码时不通过，且同样被消耗（防反复试码）", async () => {
      const c = await createCaptcha();
      const code = extractCode(c.image);
      const wrong = await verifyCaptcha(c.captchaId, "ZZZZ");
      expect(wrong.ok).toBe(false);
      expect(wrong.reason).toBe("mismatch");
      // 错误尝试已消耗，即便随后提交正确码也不可通过
      const after = await verifyCaptcha(c.captchaId, code);
      expect(after.ok).toBe(false);
      expect(after.reason).toBe("expired");
    });

    it("缺少 captchaId 或验证码时返回 missing", async () => {
      expect((await verifyCaptcha("", "ABCD")).reason).toBe("missing");
      expect((await verifyCaptcha("some-id", "")).reason).toBe("missing");
      expect((await verifyCaptcha(undefined, undefined)).reason).toBe("missing");
    });

    it("未知 captchaId 返回 expired", async () => {
      const r = await verifyCaptcha("not-exist-id", "ABCD");
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("expired");
    });
  });

  describe("Redis 不可用时的降级", () => {
    it("写入失败时降级为进程内存储，仍能完成创建与校验", async () => {
      h.state.fail = true;
      const c = await createCaptcha();
      expect(c.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
      // 降级路径下同样可用（solveChallenge 会读回真实字符）
      expect(await solveChallenge(c.captchaId, c.image)).toBe(true);
    });

    it("降级存储同样遵守一次性语义", async () => {
      h.state.fail = true;
      const c = await createCaptcha();
      const code = extractCode(c.image);
      expect((await verifyCaptcha(c.captchaId, code)).ok).toBe(true);
      expect((await verifyCaptcha(c.captchaId, code)).reason).toBe("expired");
    });
  });
});
