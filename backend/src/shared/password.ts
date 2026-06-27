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