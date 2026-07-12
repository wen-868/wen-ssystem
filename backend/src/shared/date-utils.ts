import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateParam(value: unknown, fallback?: string): string {
  const str = String(value ?? "");
  if (str === "" && fallback !== undefined) return fallback;
  if (!DATE_REGEX.test(str)) {
    throw new z.ZodError([
      { code: z.ZodIssueCode.custom, path: ["date"], message: `日期格式不正确，应为 YYYY-MM-DD，实际为: ${str || "空"}` }
    ]);
  }
  return str;
}

export function getDefaultDateStart(daysAgo: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function getDefaultDateEnd(): string {
  return new Date().toISOString().slice(0, 10);
}
