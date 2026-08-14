import { describe, it, expect } from "vitest";
import {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  base32Encode,
  base32Decode,
  buildOtpAuthUri,
} from "../../shared/totp";

describe("totp - RFC 4226 标准向量验证", () => {
  // RFC 4226 附录 D：ASCII secret "12345678901234567890" 对应 Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("counter=1（time=30s）生成 287082", () => {
    expect(generateTOTP(SECRET, 30_000)).toBe("287082");
  });

  it("counter=37037036 生成 081804", () => {
    expect(generateTOTP(SECRET, 37037036 * 30_000)).toBe("081804");
  });

  it("counter=37037037 生成 050471", () => {
    expect(generateTOTP(SECRET, 37037037 * 30_000)).toBe("050471");
  });
});

describe("totp - 生成与校验", () => {
  it("generateSecret 返回 32 位 Base32 字符", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("正确验证码校验通过（容忍 ±30s 窗口）", () => {
    const secret = generateSecret();
    const code = generateTOTP(secret);
    expect(verifyTOTP(secret, code)).toBe(true);
    expect(verifyTOTP(secret, code, Date.now() - 30_000)).toBe(true);
    expect(verifyTOTP(secret, code, Date.now() + 30_000)).toBe(true);
  });

  it("错误验证码/非 6 位输入校验失败", () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, "000000")).toBe(false);
    expect(verifyTOTP(secret, "12345")).toBe(false);
    expect(verifyTOTP(secret, "abcdef")).toBe(false);
  });

  it("base32 编码解码往返一致且容忍小写与空格", () => {
    const raw = Buffer.from("hello-mfa");
    const encoded = base32Encode(raw);
    expect(base32Decode(encoded)).toEqual(raw);
    expect(base32Decode(`${encoded.toLowerCase()} `)).toEqual(raw);
  });

  it("buildOtpAuthUri 生成标准 otpauth URI", () => {
    const uri = buildOtpAuthUri("ABC234", "admin", "智享全链");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
