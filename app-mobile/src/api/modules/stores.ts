import { get, post, put } from '../request'

/** 门店信息 */
export interface StoreInfo {
  id: number
  name: string
  code?: string
  phone?: string
  address?: string
  contactName?: string
  status?: number
  businessHours?: string
  longitude?: number
  latitude?: number
  createdAt?: string
}

/** 门店表单 */
export interface StoreForm {
  id?: number
  name: string
  code?: string
  phone?: string
  address?: string
  contactName?: string
  status?: number
  businessHours?: string
  longitude?: number
  latitude?: number
}

function mapStore(r: any): StoreInfo {
  return {
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? r.storeCode ?? r.store_code,
    phone: r.phone ?? r.contactPhone ?? r.contact_phone,
    address: r.address,
    contactName: r.contactName ?? r.contact_name,
    status: r.status != null ? Number(r.status) : 1,
    businessHours: r.businessHours ?? r.business_hours,
    longitude: r.longitude != null ? Number(r.longitude) : undefined,
    latitude: r.latitude != null ? Number(r.latitude) : undefined,
    createdAt: r.createdAt ?? r.created_at,
  }
}

const storesApi = {
  /** 门店列表 */
  async list(params?: { page?: number; pageSize?: number; keyword?: string; status?: number }): Promise<{ list: StoreInfo[]; total: number }> {
    const res: any = await get('/admin/stores', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapStore), total: raw?.total ?? rows.length }
  },

  /** 门店详情 */
  async detail(id: number): Promise<StoreInfo> {
    const res: any = await get(`/admin/stores/${id}`)
    const raw = res?.result ?? res
    return mapStore(raw?.store ?? raw ?? {})
  },

  /** 新建门店 */
  async create(data: StoreForm): Promise<any> {
    return post('/admin/stores', data)
  },

  /** 更新门店 */
  async update(id: number, data: StoreForm): Promise<any> {
    return put(`/admin/stores/${id}`, data)
  },

  /** 切换门店状态 */
  async updateStatus(id: number, status: number): Promise<any> {
    return put(`/admin/stores/${id}`, { status })
  },
}

export { storesApi }
