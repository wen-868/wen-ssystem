import { request } from '../request'
import { collectMenuCodes, type MenuCodeNode } from '../../config/function-menu'

/** 后端 GET /admin/menus/user 返回的菜单节点（t_sys_menu） */
export interface MenuItem {
  id: number
  parentId: number | null
  menuName: string
  menuCode: string
  menuType: string
  path: string
  icon: string
  sortNo: number
  status: string
  children?: MenuItem[]
}

/** 当前用户可见菜单（按角色过滤；超管全量） */
export async function getUserMenus(): Promise<MenuItem[]> {
  // silent：接口未就绪/网络异常时不弹「资源不存在」等丑 toast，由调用方（stores/menu.ts）决定回退策略
  return request<MenuItem[]>({ url: '/admin/menus/user', method: 'GET', silent: true })
}

/**
 * 拍平菜单树 → 取**页面 code 精确集合**（如 goods:inventory / sale:bill，不再取前缀）。
 * 实现委托给 config/function-menu 的 collectMenuCodes，保证前端渲染与"可见性对照表"脚本同一口径。
 */
export function toAllowedCodes(menus: MenuItem[]): Set<string> {
  return collectMenuCodes(menus as MenuCodeNode[])
}
