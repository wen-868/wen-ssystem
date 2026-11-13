/**
 * 设置中心 Tab 台账（WORKBENCH-10-UIUX-PARITY-F1 · 卡 §三.E）
 *
 * 口径来源：
 *   - Tab 名称按卡 §三.E.1 的七个用词（凌舟 2026-11-01 裁定：全按卡面命名，
 *     不沿用原型 SW_TABS 的「连接与对接 / 模型与推理」字面）；原型对应 key 保留在
 *     `prototypeKey`，便于与冻结原型对账，不改原型文件本体。
 *   - 可见性差异按原型 `SW_TABS[].admin` + `swVisible()`（L1192-1199）的规则：
 *     敏感配置仅管理员，外观与账号人人可见。
 *   - capability 按 `src/api/` 的真实导出核定，不按页面需要填写：
 *     `fetchAiModels` / `fetchAiTools` 在（ai.ts L215/L235）⇒ AI 模型 live；
 *     打印走 hardware.ts 的 fetch/save/test + modules/print/localConfig.ts ⇒ live；
 *     系统接入与运营在 api/ 全域无端点 ⇒ unavailable，UI 必须显示未接线。
 */

export type SettingTabKey =
  | "conn"
  | "model"
  | "print"
  | "appear"
  | "acct"
  | "ops"
  | "config";

export type SettingCapability = "live" | "partial" | "unavailable";

export interface SettingTab {
  key: SettingTabKey;
  /** 卡 §三.E.1 用词 */
  label: string;
  /** 冻结原型 SW_TABS 的对应 key；卡面新增的两块为 null */
  prototypeKey: string | null;
  /** 原型 admin:true 语义：仅管理员可见 */
  adminOnly: boolean;
  capability: SettingCapability;
  /** unavailable / partial 时给用户的诚实说明，不得用于包装假数据 */
  note: string;
}

export const SETTINGS_TABS: readonly SettingTab[] = [
  {
    key: "conn",
    label: "系统接入",
    prototypeKey: "conn",
    adminOnly: true,
    capability: "unavailable",
    note: "业务系统 / 运营系统对接状态暂不可用（api/ 未提供对应能力）",
  },
  {
    key: "model",
    label: "AI 模型",
    prototypeKey: "model",
    adminOnly: true,
    capability: "live",
    note: "模型与工具清单取真实枚举端点",
  },
  {
    key: "print",
    label: "打印",
    prototypeKey: "print",
    adminOnly: true,
    capability: "live",
    note: "本机打印配置与硬件配置走真实读写端点",
  },
  {
    key: "appear",
    label: "外观",
    prototypeKey: "appear",
    adminOnly: false,
    capability: "live",
    note: "明暗主题本地持久化，人人可调",
  },
  {
    key: "acct",
    label: "账号与安全",
    prototypeKey: "acct",
    adminOnly: false,
    capability: "partial",
    note: "身份与登出取真实会话；登录密码由业务系统管理，工作台无改密端点",
  },
  {
    key: "ops",
    label: "运营",
    prototypeKey: null,
    adminOnly: true,
    capability: "unavailable",
    note: "运营系统（短视频 / 电商 / 私域）暂未开放（api/ 未提供对应能力）",
  },
  {
    key: "config",
    label: "系统配置",
    prototypeKey: null,
    adminOnly: true,
    capability: "live",
    note: "跳真实 /system 配置页，不在弹层内复制其真值",
  },
];

export type RoleResolver = (routeName: string) => readonly string[] | null;

/**
 * 管理员判定复用「设置」入口的同一把尺子：路由 meta.roles（未知路由 fail-closed）。
 * 不在此处硬编码 SUPER_ADMIN 等角色名，避免与权限码真值分叉。
 */
export function canSeeAdminTabs(
  routeName: string,
  userRoles: readonly string[],
  resolveRoles: RoleResolver,
): boolean {
  const allowed = resolveRoles(routeName);
  if (allowed === null) return false;
  return allowed.length > 0 && userRoles.some((role) => allowed.includes(role));
}

export function visibleSettingTabs(
  userRoles: readonly string[],
  resolveRoles: RoleResolver,
  adminRouteName = "system",
): SettingTab[] {
  const isAdmin = canSeeAdminTabs(adminRouteName, userRoles, resolveRoles);
  return SETTINGS_TABS.filter((tab) => !tab.adminOnly || isAdmin);
}

export interface CapabilityState {
  state: "loading" | "ready" | "unavailable" | "error";
  message: string;
}

/** 与 shared/workbench/agent-directory.ts 同构：缺端点即 unavailable，不返回伪造条目。 */
export function unavailableCapability(tab: SettingTab): CapabilityState {
  return { state: "unavailable", message: `${tab.label} · 暂不可用：${tab.note}` };
}
