/**
 * 二级栏「常用功能」使用频率。
 *
 * 口径：
 * - 只记录真实业务路由名，不记录临时页面开关或折叠动作；
 * - 持久化在用户本机 localStorage，不新增后端接口，也不扩权限；
 * - 使用次数优先、最近使用时间次优；没有使用记录时不展示预置常用项。
 */
import type { ManifestItem } from "./types";

export const MENU_USAGE_STORAGE_KEY = "wb.menu.usage.v1";
export const FREQUENT_MENU_LIMIT = 6;

export interface MenuUsageRecord {
  count: number;
  lastUsedAt: number;
}

export type MenuUsageMap = Record<string, MenuUsageRecord>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMenuUsage(payload: unknown): MenuUsageMap {
  if (!isRecord(payload)) return {};
  const out: MenuUsageMap = {};
  for (const [routeName, raw] of Object.entries(payload)) {
    if (!routeName.trim() || !isRecord(raw)) continue;
    const count = Number(raw.count);
    const lastUsedAt = Number(raw.lastUsedAt);
    if (!Number.isFinite(count) || count <= 0) continue;
    out[routeName] = {
      count: Math.min(Math.floor(count), 999_999),
      lastUsedAt: Number.isFinite(lastUsedAt) && lastUsedAt > 0 ? Math.floor(lastUsedAt) : 0,
    };
  }
  return out;
}

export function readMenuUsage(
  storage: Pick<Storage, "getItem"> | null =
    typeof localStorage === "undefined" ? null : localStorage,
): MenuUsageMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(MENU_USAGE_STORAGE_KEY);
    return raw ? normalizeMenuUsage(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function recordMenuUsage(
  routeName: string,
  now = Date.now(),
  storage: Pick<Storage, "getItem" | "setItem"> | null =
    typeof localStorage === "undefined" ? null : localStorage,
): MenuUsageMap {
  const key = routeName.trim();
  const current = readMenuUsage(storage);
  if (!key || !storage) return current;
  const previous = current[key];
  current[key] = {
    count: Math.min((previous?.count ?? 0) + 1, 999_999),
    lastUsedAt: now,
  };
  try {
    storage.setItem(MENU_USAGE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* 本机存储不可用时只保留本次返回值，不影响导航 */
  }
  return current;
}

export function rankFrequentMenuItems(
  items: readonly ManifestItem[],
  usage: MenuUsageMap,
  limit = FREQUENT_MENU_LIMIT,
): ManifestItem[] {
  const unique = new Map<string, ManifestItem>();
  for (const item of items) {
    if (!item.routeName || !item.path) continue;
    if (!unique.has(item.routeName)) unique.set(item.routeName, item);
  }
  return [...unique.values()]
    .filter((item) => (usage[item.routeName as string]?.count ?? 0) > 0)
    .sort((a, b) => {
      const ua = usage[a.routeName as string];
      const ub = usage[b.routeName as string];
      return ub.count - ua.count || ub.lastUsedAt - ua.lastUsedAt || a.title.localeCompare(b.title, "zh-CN");
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}
