import { request } from '../request'

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

/** 当前用户可见菜单（按角色过滤；超管全量；失败不阻断回退全量） */
export async function getUserMenus(): Promise<MenuItem[]> {
  // silent：接口未就绪/网络异常时静默失败，调用方回退全量，不弹「资源不存在」等丑 toast
  return request<MenuItem[]>({ url: '/admin/menus/user', method: 'GET', silent: true })
}

/** 拍平菜单树 → 取模块前缀集合（如 goods / sale / finance） */
export function toAllowedModules(menus: MenuItem[]): Set<string> {
  const set = new Set<string>()
  const walk = (list: MenuItem[]) => {
    for (const m of list) {
      if (m.menuCode) {
        const prefix = m.menuCode.split(':')[0]
        if (prefix) set.add(prefix)
      }
      if (m.children && m.children.length) walk(m.children)
    }
  }
  walk(menus)
  return set
}
