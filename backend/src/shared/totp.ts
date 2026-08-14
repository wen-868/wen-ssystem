import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP（RFC 6238 / RFC 4226）实现——双因素认证动态码
 * - 算法：HMAC-SHA1，时间步长 30 秒，6 位数字
 * - Secret：Base32 编码（RFC 4648，无填充）
 * - 校验容忍 ±1 个时间窗口（前后 30 秒）
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;
const WINDOW = 1;

/** 生成随机 Base32 Secret（20 字节 → 32 字符） */
export function generateSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/** Base32 编码 */
export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Base32 解码（忽略空白与小写差异） */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error("无效的 Base32 字符");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 生成指定时间的 TOTP 动态码 */
export function generateTOTP(secret: string, timestamp: number = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return (code % 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

/** 校验动态码（容忍 ±WINDOW 个时间窗口） */
export function verifyTOTP(secret: string, code: string, timestamp: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const expected = generateTOTP(secret, timestamp + offset * STEP_SECONDS * 1000);
    // 恒定时间比较，防时序攻击
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** 生成 otpauth:// 标准 URI（供 Google Authenticator / 微信小程序等扫码） */
export function buildOtpAuthUri(secret: string, account: string, issuer = "智享全链"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${CODE_DIGITS}&period=${STEP_SECONDS}`;
}
