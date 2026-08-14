import { randomBytes } from "node:crypto";

export function makeBizNo(prefix: string) {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const seq = String(Math.floor(Math.random() * 90000) + 10000);
  return `${prefix}${stamp}${seq}`;
}

export function makeToken() {
  return randomBytes(24).toString("hex");
}
