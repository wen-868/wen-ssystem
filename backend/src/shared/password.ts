import { createHash } from "node:crypto";

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function verifyPassword(inputPassword: string, passwordHash: string) {
  // 第 1 阶段开发环境支持两种形式：
  // 1. 推荐：数据库保存 SHA-256 哈希
  // 2. 兼容：本地调试可临时保存明文，后续正式版本替换为 bcrypt/argon2
  return passwordHash === sha256(inputPassword) || passwordHash === inputPassword;
}
