import { randomBytes } from "node:crypto";

export function makeBizNo(prefix: string) {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}${stamp}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function makeToken() {
  return randomBytes(24).toString("hex");
}
