/**
 * 一次性初始口令生成（MS-SECURITY-BASELINE-01）
 *
 * 背景：员工/租户管理员/后台代建会员原先使用硬编码默认口令（如 "123456"），
 * 属可预测凭据，攻击者可用默认口令直接登录新建账号。
 *
 * 方案：创建账号时不再使用任何静态默认口令，改由 `crypto.randomInt`
 * 从无歧义字符集（剔除 0/O/1/I/l）随机生成一次性初始口令：
 *   - 12 位，字符集 57 个字符，熵约 70 bit，不可预测；
 *   - 仅在创建响应中返回一次，明文不落库（库里只有哈希）；
 *   - 首登后应通过既有改密入口自行更换。
 */
import { randomInt } from "crypto";

/** 剔除易混淆字符（0/O、1/I/l）的口令字符集 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 12;

/** 生成一次性初始口令（密码学安全随机源） */
export function generateInitialPassword(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
