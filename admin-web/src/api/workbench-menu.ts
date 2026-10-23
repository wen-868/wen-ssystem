/**
 * 动态菜单取数（WORKBENCH-04）
 *
 * 唯一消费点：GET /api/admin/menus/user（后端 menu-permission.routes.ts:11）。
 * 解析/裁剪/fail-closed 全部在 shared/workbench/menu-access.ts，本文件只负责发请求。
 */
import { api } from "./request";
import { parseUserMenusPayload, type ServerMenuRow } from "../shared/workbench/menu-access";

export async function fetchUserMenus(): Promise<ServerMenuRow[]> {
  const { data } = await api.get("/admin/menus/user");
  return parseUserMenusPayload(data);
}