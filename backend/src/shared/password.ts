import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export async function verifyPassword(inputPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(inputPassword, passwordHash);
}

export function verifyPasswordSync(inputPassword: string, passwordHash: string): boolean {
  return bcrypt.compareSync(inputPassword, passwordHash);
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