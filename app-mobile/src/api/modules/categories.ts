import { get, post, put, del } from '../request'

/** 商品分类信息 */
export interface CategoryInfo {
  id: number
  name: string
  parentId?: number
  sortNo?: number
  sortOrder?: number
  status?: number
  allowOnlineSale?: number
  children?: CategoryInfo[]
}

/** 分类表单（新建/编辑） */
export interface CategoryForm {
  id?: number
  name: string
  parentId?: number | null
  sortNo?: number
  status?: number
  allowOnlineSale?: number
}

/** 后端原始字段映射为前端驼峰结构 */
function mapCategory(c: any): CategoryInfo {
  return {
    id: c.id,
    name: c.name ?? '',
    parentId: c.parentId ?? c.parent_id,
    sortNo: c.sortNo ?? c.sort_no,
    sortOrder: c.sortNo ?? c.sort_no ?? c.sortOrder,
    status: c.status != null ? Number(c.status) : undefined,
    allowOnlineSale: c.allowOnlineSale ?? c.allow_online_sale,
    children: Array.isArray(c.children) ? c.children.map(mapCategory) : undefined,
  }
}

const categoriesApi = {
  /** 获取分类列表（扁平结构，前端构建树） */
  async list(params?: { parentId?: number; status?: number }): Promise<CategoryInfo[]> {
    const res: any = await get('/admin/products/categories', params as any)
    const rows: any[] = res?.list ?? res ?? (Array.isArray(res) ? res : [])
    return rows.map(mapCategory)
  },

  /** 新建分类 */
  async create(data: CategoryForm): Promise<any> {
    return post('/admin/products/categories', {
      name: data.name,
      parentId: data.parentId ?? null,
      sortNo: data.sortNo ?? 0,
      status: data.status ?? 1,
      allowOnlineSale: data.allowOnlineSale ?? 1,
    })
  },

  /** 更新分类 */
  async update(id: number, data: CategoryForm): Promise<any> {
    return put(`/admin/products/categories/${id}`, {
      name: data.name,
      parentId: data.parentId ?? null,
      sortNo: data.sortNo ?? 0,
      status: data.status ?? 1,
      allowOnlineSale: data.allowOnlineSale ?? 1,
    })
  },

  /** 删除分类 */
  async remove(id: number): Promise<any> {
    return del(`/admin/products/categories/${id}`)
  },

  /** 调整分类排序 */
  async sort(id: number, sortNo: number): Promise<any> {
    return put(`/admin/products/categories/${id}/sort`, { sortNo })
  },
}

export { categoriesApi }
