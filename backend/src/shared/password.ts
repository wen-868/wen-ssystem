import bcrypt from "bcryptjs";

// 密码哈希强度轮数（提升到 12 增强安全性）
const SALT_ROUNDS = 12;

// 哈希版本前缀，用于标识 v2 哈希格式（含 SALT_ROUNDS=12）
const HASH_VERSION_PREFIX = "v2$";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS).then((hash) => HASH_VERSION_PREFIX + hash);
}

export function hashPasswordSync(password: string): string {
  return HASH_VERSION_PREFIX + bcrypt.hashSync(password, SALT_ROUNDS);
}

// 去除版本前缀，得到原始 bcrypt 哈希以供 bcrypt.compare 使用
function stripVersionPrefix(passwordHash: string): string {
  if (passwordHash.startsWith(HASH_VERSION_PREFIX)) {
    return passwordHash.slice(HASH_VERSION_PREFIX.length);
  }
  return passwordHash;
}

export async function verifyPassword(inputPassword: string, passwordHash: string): Promise<boolean> {
  // v2$ 前缀的哈希去掉前缀后验证；旧密码（无前缀）直接验证
  const rawHash = stripVersionPrefix(passwordHash);
  return bcrypt.compare(inputPassword, rawHash);
}

export function verifyPasswordSync(inputPassword: string, passwordHash: string): boolean {
  const rawHash = stripVersionPrefix(passwordHash);
  return bcrypt.compareSync(inputPassword, rawHash);
}

// 检查哈希是否需要重新加密：不以 v2$ 开头（旧版本）或 SALT_ROUNDS 不匹配
export function needsRehash(passwordHash: string): boolean {
  // 旧密码（无 v2$ 前缀）需要重新加密
  if (!passwordHash.startsWith(HASH_VERSION_PREFIX)) {
    return true;
  }
  const rawHash = stripVersionPrefix(passwordHash);
  // 解析 bcrypt 哈希中的 cost 因子，格式为 $2a$<cost>$...
  const match = rawHash.match(/^\$2[ab]?\$(\d+)\$/);
  if (match) {
    const cost = parseInt(match[1], 10);
    return cost !== SALT_ROUNDS;
  }
  // 无法解析 cost，默认需要重新加密
  return true;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length === 0) {
    errors.push("密码不能为空");
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push("密码长度至少8位");
  }

  if (password.length > 32) {
    errors.push("密码长度不能超过32位");
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("密码必须包含字母");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("密码必须包含数字");
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("密码必须包含特殊字符");
  }

  return { valid: errors.length === 0, errors };
}

export function isStrongPassword(password: string): boolean {
  return validatePassword(password).valid;
}
