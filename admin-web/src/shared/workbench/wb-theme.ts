/**
 * 明暗主题（WORKBENCH-10-UIUX-PARITY-F1 · 卡 §三.E.3「明暗主题切换与恢复」）
 *
 * 本文件刻意保持**无全局依赖**：localStorage 与 matchMedia 由调用方注入。
 * 原因有二 —— 一是 `admin-web/tests/*.spec.mjs` 直接 import src 下的 .ts，
 * 模块级触碰 `document` / `window` 会让用例在 Node 里加载即崩；
 * 二是纯函数才能被 §五.6 的 mutation 反测逐条钉红。
 *
 * 「恢复」有两层，都必须是真行为：
 *   - 恢复上次选择：启动时读 wb.theme 并应用；
 *   - 恢复默认：清除本地记录，回到 tokens.css 的浅色真相源（不是再写一个 dark=false 的假状态）。
 */

export type WbTheme = "light" | "dark";

export const WB_THEME_STORAGE_KEY = "wb.theme";

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readStoredTheme(storage: ThemeStorage): WbTheme | null {
  const raw = storage.getItem(WB_THEME_STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

export function writeStoredTheme(storage: ThemeStorage, theme: WbTheme): void {
  storage.setItem(WB_THEME_STORAGE_KEY, theme);
}

/** 恢复默认：删键，而不是写入 "light" —— 否则「跟随系统」与「强制亮色」将无法区分。 */
export function clearStoredTheme(storage: ThemeStorage): void {
  storage.removeItem(WB_THEME_STORAGE_KEY);
}

export function resolveTheme(
  storage: ThemeStorage,
  systemPrefersDark: boolean,
): WbTheme {
  return readStoredTheme(storage) ?? (systemPrefersDark ? "dark" : "light");
}

export function oppositeTheme(theme: WbTheme): WbTheme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * 属性名与 src/styles/wb-theme.css 的选择器一一对应；
 * 返回 null 表示该主题就是 tokens.css 的默认值，属性必须摘掉，
 * 免得 `data-wb-theme="light"` 与无属性两套状态在 DOM 里并存。
 */
export function themeDataAttribute(theme: WbTheme): string | null {
  return theme === "dark" ? "dark" : null;
}
