/**
 * 动态菜单取数（WORKBENCH-04 / MS-WB-CONTENT-WIRING-B-01）
 *
 * 唯一消费点：GET /api/admin/menus/user（后端 menu-permission.routes.ts:11）。
 * 后端返回 buildTree 树（menu-permission.service.ts:134，顶层 CATALOG + children 嵌套）；
 * 本文件负责**递归扁平化**树载荷为平铺行，再交 shared/workbench/menu-access.ts 解析——
 * 只解析顶层会把嵌套子码（finance:expenses / goods:stock-warning 等）全部丢出桥外。
 * 裁剪/fail-closed 全部在 shared/workbench/menu-access.ts。
 */
import { api } from "./request";
import {
  parseUserMenusPayload,
  MenuPayloadError,
  type ServerMenuRow,
} from "../shared/workbench/menu-access";

/** 后端 buildTree 树节点（MenuItem 的运行时形状；行字段与 ServerMenuRow 对齐 + children） */
interface ServerMenuNode extends ServerMenuRow {
  children?: ServerMenuNode[];
}

/**
 * 递归扁平化树载荷：
 *  1. 顶层形状与行字段校验复用 shared/workbench/menu-access.ts 的 parseUserMenusPayload
 *     （非数组 / 行缺 menuCode 一律抛 MenuPayloadError，fail-closed 与桥层一致）；
 *  2. children 从**原始节点**读取——parseUserMenusPayload 重建行时不携带 children，
 *     深度优先展开，每个子节点同样交 parseUserMenusPayload 逐行校验；
 *  3. 输出顺序 = 顶层顺序 + 各节点子树顺序（与后端 sort_no 排序一致）；
 *     行字段（menuCode/menuName/menuType/path/status）原样保留；未知码不过滤，由桥层登记 unmapped。
 */
export function flattenUserMenusPayload(payload: unknown): ServerMenuRow[] {
  // 顶层校验：形状不对（非数组 / 包装无 data）或缺 menuCode 一律抛错，不猜数据
  parseUserMenusPayload(payload);
  const candidate =
    payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload
      ? (payload as { data: unknown[] }).data
      : (payload as unknown[]);
  const out: ServerMenuRow[] = [];
  const walk = (raw: unknown) => {
    if (!raw || typeof raw !== "object") {
      throw new MenuPayloadError("children 含非对象行");
    }
    // 单行复用 shared 行校验（缺 menuCode 即抛错，与顶层同语义）
    const [row] = parseUserMenusPayload([raw]);
    out.push({ menuCode: row.menuCode, menuName: row.menuName, menuType: row.menuType, path: row.path, status: row.status });
    const children = (raw as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) walk(child);
    }
  };
  for (const root of candidate) walk(root);
  return out;
}

export async function fetchUserMenus(): Promise<ServerMenuRow[]> {
  const { data } = await api.get("/admin/menus/user");
  return flattenUserMenusPayload(data);
}

export type { ServerMenuNode };
