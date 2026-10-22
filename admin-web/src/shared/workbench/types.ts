/** 工作台 route manifest 类型定义（WORKBENCH-02） */

export type ManifestComponentLoader = () => Promise<unknown>;

export interface ManifestItem {
  /** 前端白名单菜单码（前缀 web.，与后端 menuCode 明确区分） */
  menuCode: string;
  /** 路由名；本地动作项为 null */
  routeName: string | null;
  /** 路由绝对路径；本地动作项为 null */
  path: string | null;
  title: string;
  component: ManifestComponentLoader;
  /** 本地动作标识（如收银台打印设置），非路由项专用 */
  action?: string;
  /** 无路由项的角色来源（从该路由的 meta.roles 派生可见性） */
  visibilityFrom?: string;
}

export interface ManifestGroup {
  groupCode: string;
  title: string;
  items: ManifestItem[];
}

/** 路由角色解析器：返回 null 表示路由不存在（fail-closed，一律不可见） */
export type RouteRolesResolver = (routeName: string) => string[] | null;

export function item(
  menuCode: string,
  routeName: string,
  path: string,
  title: string,
  component: ManifestComponentLoader,
): ManifestItem {
  return { menuCode, routeName, path, title, component };
}
