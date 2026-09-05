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
  storeType?: 'STORE' | 'WAREHOUSE'
  isDefault?: boolean
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
    type: String(r.type ?? r.storeType ?? r.store_type ?? 'store').toLowerCase(),
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
    // 键位对齐后端 zod：contactName→contact, storeType 新增
    return post('/admin/system/stores', {
      name: data.name,
      address: data.address ?? '',
      contact: data.contactName,
      phone: data.phone,
      storeType: data.storeType,
      longitude: data.longitude,
      latitude: data.latitude,
    })
  },

  /** 更新门店 */
  async update(id: number, data: StoreForm): Promise<any> {
    return put(`/admin/system/stores/${id}`, {
      name: data.name,
      address: data.address,
      contact: data.contactName,
      phone: data.phone,
      storeCode: data.code,
      storeType: data.storeType,
      isDefault: data.isDefault != null ? (data.isDefault ? 1 : 0) : undefined,
      status: data.status,
      longitude: data.longitude,
      latitude: data.latitude,
    })
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

  /** 新增收款银行卡 */
  async create(data: { accountName?: string; bankName: string; accountNo: string; accountType?: string }): Promise<any> {
    return post('/admin/bank-accounts', data)
  },

  /** 注销收款银行卡（后端无硬删除，close 即业务删除） */
  async close(id: number): Promise<any> {
    return post(`/admin/bank-accounts/${id}/close`)
  },
}

export { storesApi, bankAccountsApi }
