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
  /** 门店类型：store 门店 / warehouse 仓库（后端未返回时回退 'store'） */
  type?: 'store' | 'warehouse' | string
  /** 是否默认（开单默认选中） */
  isDefault?: boolean
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
    type: r.type ?? r.storeType ?? r.store_type ?? 'store',
    isDefault: r.isDefault ?? r.is_default ?? false,
    longitude: r.longitude != null ? Number(r.longitude) : undefined,
    latitude: r.latitude != null ? Number(r.latitude) : undefined,
    createdAt: r.createdAt ?? r.created_at,
  }
}

const storesApi = {
  /** 门店列表 */
  async list(params?: { page?: number; pageSize?: number; keyword?: string; status?: number }): Promise<{ list: StoreInfo[]; total: number }> {
    // R94-03：原 /admin/stores 不存在，改为 /admin/system/stores（admin-store.routes.ts）
    const res: any = await get('/admin/system/stores', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapStore), total: raw?.total ?? rows.length }
  },

  /** 门店详情 */
  async detail(id: number): Promise<StoreInfo> {
    const res: any = await get(`/admin/system/stores/${id}`)
    const raw = res?.result ?? res
    return mapStore(raw?.store ?? raw ?? {})
  },

  /** 新建门店 */
  async create(data: StoreForm): Promise<any> {
    return post('/admin/system/stores', data)
  },

  /** 更新门店 */
  async update(id: number, data: StoreForm): Promise<any> {
    return put(`/admin/system/stores/${id}`, data)
  },

  /** 切换门店状态 */
  async updateStatus(id: number, status: number): Promise<any> {
    return put(`/admin/system/stores/${id}`, { status })
  },
}

/** 公司收款银行账户（后端 t_bank_account，GET /admin/bank-accounts） */
export interface CompanyBankAccount {
  id: number
  accountName: string
  bankName: string
  accountNo: string
  accountType?: string | null
  balance?: number
  status?: string
}

const bankAccountsApi = {
  /** 收款银行卡列表（按创建时间倒序） */
  async list(params?: { page?: number; pageSize?: number; status?: string }): Promise<{ list: CompanyBankAccount[]; total: number }> {
    const res: any = await get('/admin/bank-accounts', params)
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return {
      list: rows.map((r) => ({
        id: r.id,
        accountName: r.accountName ?? r.account_name ?? '',
        bankName: r.bankName ?? r.bank_name ?? '',
        accountNo: r.accountNo ?? r.account_no ?? '',
        accountType: r.accountType ?? r.account_type ?? null,
        balance: r.balance != null ? Number(r.balance) : undefined,
        status: r.status,
      })),
      total: res?.total ?? rows.length,
    }
  },
}

export { storesApi, bankAccountsApi }
