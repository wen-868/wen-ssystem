/**
 * 工作台 UIUX 测试注入（WORKBENCH-10-UIUX-PARITY-F1 · 补齐项 6）
 *
 * 为什么要注入：`SERVER_MENU_BRIDGE` 只覆盖 12 组里的 4 组（其余 8 组的 serverCode
 * 无可对齐证据，见 `menu-access.ts:36` 的 10 条 evidence 行），真实权限交集会把
 * 另外 8 组裁掉 ⇒ UI/UX 走查无法逐组点击。补 8 组桥接是 WORKBENCH-11 的活，
 * 本卡红线明确禁止改桥接既有真值，所以这里只提供**测试态可见集**，不碰生产判定。
 *
 * 三条硬边界（缺一条即视为越权口子）：
 *   1. 只在 Vite 开发态生效（`import.meta.env.DEV`）：生产构建里 isDev=false ⇒ 恒不激活；
 *   2. 仍按角色裁剪：注入只跳过 `/menus/user` 交集这一步，`meta.roles` 照常过滤，
 *      STORE_OPERATOR 即使带上参数也看不到人工 12 组；
 *   3. 必须在 DOM 上留痕（`data-uiux-inject` + 角标文案），任何截图都能看出这是注入态，
 *      不得作为生产权限证据。
 */

/** 注入开关的 URL 参数名与值（Playwright 走查用，非用户可见功能） */
export const WB_UIUX_INJECT_PARAM = "wb_uiux";
export const WB_UIUX_INJECT_VALUE = "12-groups";

/** 角标文案：截图即自证「这不是生产权限态」 */
export const WB_UIUX_INJECT_WATERMARK = "测试注入·仅UIUX走查·非生产权限态";

export interface UiuxInjectionState {
  active: boolean;
  /** 未激活时的原因（可追：生产构建 / 缺参数 / 参数值不符） */
  reason: string;
}

/** 参数解析：只认 query 里的精确值，其他任何取值都不激活 */
function hasInjectFlag(search: string): boolean {
  try {
    return new URLSearchParams(search).get(WB_UIUX_INJECT_PARAM) === WB_UIUX_INJECT_VALUE;
  } catch {
    return false;
  }
}

/**
 * 判定当前是否处于 UIUX 注入态。
 * `isDev` 由调用方从 `import.meta.env.DEV` 传入，便于在 Node 侧直接断言两态。
 */
export function resolveUiuxInjection(input: { search: string; isDev: boolean }): UiuxInjectionState {
  if (!input.isDev) {
    return { active: false, reason: "生产构建（import.meta.env.DEV=false）不开放测试注入" };
  }
  if (!hasInjectFlag(input.search)) {
    return { active: false, reason: `未带注入参数（?${WB_UIUX_INJECT_PARAM}=${WB_UIUX_INJECT_VALUE}）` };
  }
  return { active: true, reason: "开发态 + 注入参数齐备：人工侧可见集按 12 组全展开（仍受角色裁剪）" };
}

/** 读当前地址的注入态（壳层调用；无 window 的环境一律判不激活） */
export function readUiuxInjection(): UiuxInjectionState {
  if (typeof window === "undefined") {
    return { active: false, reason: "无浏览器环境，按生产态处理" };
  }
  return resolveUiuxInjection({ search: window.location.search, isDev: import.meta.env.DEV === true });
}

/**
 * 注入态下是否跳过 `/menus/user` 交集裁剪。
 * 返回 false ⇒ 走生产链（resolveMenuAccess + restrictManifestGroups），一字不改。
 */
export function shouldSkipMenuBridgeTrimming(state: UiuxInjectionState): boolean {
  return state.active;
}
