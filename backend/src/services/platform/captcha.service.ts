/**
 * 平台登录图形验证码（R101-S2-01 裁定 4.1）
 *
 * 背景：
 *  - 后端原先完全没有验证码实现；前端 PlatformLogin.vue 的 captchaText 写死「待接入」，
 *    只做非空校验 —— 等于没有验证码。
 *  - 平台登录接口目前不限流（server.ts:172 注释「应用户要求不限流」），
 *    因此图形验证码是当前唯一的爆破防护手段，裁定明确「安全相关，必须做」。
 *
 * 存储策略：
 *  - 主路径 Redis：key = platform:captcha:<id>，SETEX TTL 300s（5 分钟，裁定要求）。
 *  - 取值与删除用 Lua 脚本保证原子（本机 Redis 3.0.504 无 GETDEL，须兼容 < 6.2）。
 *  - Redis 不可用时降级为进程内 Map（可用性优先）并打 warn 日志；
 *    多实例部署下进程内存储不共享，需改用共享存储 —— 已在回传中如实报备。
 * 一次性：取出即删。无论校验成功与否都不保留，防止同一张图被反复试码。
 */

import { randomUUID, randomInt } from "crypto";
import { getRedis } from "../../config/redis";
import logger from "../../shared/logger";

/** 验证码有效期（秒）—— 裁定 4.1 要求 5 分钟 */
export const CAPTCHA_TTL_SECONDS = 300;

const KEY_PREFIX = "platform:captcha:";
/** 字符集：剔除 0/O/1/I/L 等易混淆字符，降低正常用户误判率 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 4;

/** 原子「取值并删除」：兼容 Redis < 6.2（该版本无 GETDEL 命令） */
const TAKE_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

// ── 验证码图片渲染参数（本模块专属的固定常量，非前端设计令牌体系） ──
const IMG_W = 120;
const IMG_H = 40;
/** 字符与干扰元素的配色（深色系，保证浅底可读） */
const INK_COLORS = ["#0E2B8C", "#1e3a8a", "#166534", "#7c2d12", "#581c87"];
const INK_SUBTLE = "rgba(30,58,138,.35)";
const INK_FAINT = "rgba(30,58,138,.25)";
const BG_FILL = "#f1f5f9";

export interface CaptchaChallenge {
  captchaId: string;
  /** data:image/svg+xml;base64,... —— 前端可直接放进 <img src> */
  image: string;
  expiresIn: number;
}

export type CaptchaVerifyReason = "ok" | "missing" | "expired" | "mismatch";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 生成验证码 SVG（零依赖：不引入 svg-captcha / canvas） */
function renderCaptchaSvg(code: string): string {
  const step = IMG_W / (code.length + 0.6);
  let glyphs = "";
  for (let i = 0; i < code.length; i++) {
    const x = 14 + i * step;
    const y = IMG_H / 2 + rnd(-3, 3);
    const rotate = rnd(-22, 22).toFixed(1);
    const size = randomInt(22, 27);
    const color = INK_COLORS[randomInt(0, INK_COLORS.length)];
    glyphs +=
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Verdana,Arial,Helvetica,sans-serif"` +
      ` font-size="${size}" font-weight="bold" fill="${color}"` +
      ` transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`;
  }
  let noise = "";
  for (let i = 0; i < 3; i++) {
    noise +=
      `<line x1="${rnd(0, IMG_W).toFixed(1)}" y1="${rnd(0, IMG_H).toFixed(1)}"` +
      ` x2="${rnd(0, IMG_W).toFixed(1)}" y2="${rnd(0, IMG_H).toFixed(1)}"` +
      ` stroke="${INK_SUBTLE}" stroke-width="1"/>`;
  }
  for (let i = 0; i < 24; i++) {
    noise +=
      `<circle cx="${rnd(0, IMG_W).toFixed(1)}" cy="${rnd(0, IMG_H).toFixed(1)}"` +
      ` r="1" fill="${INK_FAINT}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMG_W}" height="${IMG_H}"` +
    ` viewBox="0 0 ${IMG_W} ${IMG_H}" role="img" aria-label="图形验证码">` +
    `<rect width="${IMG_W}" height="${IMG_H}" fill="${BG_FILL}"/>${noise}${glyphs}</svg>`
  );
}

function svgToDataUri(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

// ── Redis 不可用时的进程内降级存储 ──
const memoryStore = new Map<string, { code: string; expireAt: number }>();

function memStore(id: string, code: string): void {
  // 惰性清理：顺带清掉已过期的条目，避免 Map 无限增长
  const now = Date.now();
  for (const [k, v] of memoryStore) if (v.expireAt <= now) memoryStore.delete(k);
  memoryStore.set(id, { code, expireAt: now + CAPTCHA_TTL_SECONDS * 1000 });
}

function memTake(id: string): string | null {
  const entry = memoryStore.get(id);
  memoryStore.delete(id);
  if (!entry) return null;
  return entry.expireAt > Date.now() ? entry.code : null;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function storeCode(captchaId: string, code: string): Promise<void> {
  try {
    await getRedis().setex(KEY_PREFIX + captchaId, CAPTCHA_TTL_SECONDS, code);
  } catch (err) {
    logger.warn(`[Captcha] Redis 写入失败，降级为进程内存储: ${errText(err)}`);
    memStore(captchaId, code);
  }
}

async function takeCode(captchaId: string): Promise<string | null> {
  try {
    const value = await getRedis().eval(TAKE_SCRIPT, 1, KEY_PREFIX + captchaId);
    return typeof value === "string" && value ? value : null;
  } catch (err) {
    logger.warn(`[Captcha] Redis 读取失败，改查进程内存储: ${errText(err)}`);
    return memTake(captchaId);
  }
}

/** 生成一张新验证码（图片 + 唯一 id） */
export async function createCaptcha(): Promise<CaptchaChallenge> {
  const code = randomCode();
  const captchaId = randomUUID();
  await storeCode(captchaId, code);
  return {
    captchaId,
    image: svgToDataUri(renderCaptchaSvg(code)),
    expiresIn: CAPTCHA_TTL_SECONDS,
  };
}

/**
 * 校验验证码（一次性：无论对错都会消耗掉本次验证码）
 * 返回结构化原因，交由调用方决定用户可见文案。
 */
export async function verifyCaptcha(
  captchaId: unknown,
  code: unknown
): Promise<{ ok: boolean; reason: CaptchaVerifyReason }> {
  const id = typeof captchaId === "string" ? captchaId.trim() : "";
  const input = typeof code === "string" ? code.trim() : "";
  if (!id || !input) return { ok: false, reason: "missing" };

  const expected = await takeCode(id);
  if (!expected) return { ok: false, reason: "expired" };

  // 大小写不敏感（字符集已剔除易混淆字母，放宽大小写不牺牲安全性）
  if (expected.toUpperCase() !== input.toUpperCase()) return { ok: false, reason: "mismatch" };
  return { ok: true, reason: "ok" };
}
