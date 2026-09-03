import { get, post, put, del } from '../request'

/** 供应商联系人（对齐后端 SupplierContact，getDetail 返回） */
export interface SupplierContact {
  id: number
  name: string
  mobile?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
  isPrimary?: number | boolean
  position?: string | null
  remark?: string | null
}

/** 对齐后端 SupplierDetailVO（supplier.service.ts getDetail） */
export interface Supplier {
  id: number
  supplierCode: string
  name: string
  shortName?: string | null
  supplyType?: string | null
  contactPerson?: string | null
  contactMobile?: string | null
  status: number
  creditLevel?: string
  province?: string | null
  city?: string | null
  district?: string | null
  createdAt?: string
  /** 结算信息 */
  settlementType?: 'CASH' | 'MONTHLY' | 'QUARTERLY' | string
  settlementDay?: number | null
  taxRate?: number | string | null
  /** 结算银行卡（存于供应商行本身，非独立接口） */
  bankName?: string | null
  bankAccount?: string | null
  bankAccountName?: string | null
  /** 其他 */
  address?: string | null
  remark?: string | null
  contacts?: SupplierContact[]
}

/** 供应商统计（GET /admin/suppliers/:id/stats，totalAmount = SUM(payable_amount) 应付账款） */
export interface SupplierStats {
  orderCount: number
  totalAmount: number
}

export interface SupplierQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
}

export interface SupplierListResponse {
  list: Supplier[]
  total: number
}

/** 新增/编辑入参（对齐 createSupplier / updateSupplier zod 契约的字段集合） */
export interface SupplierSaveParams {
  name: string
  shortName?: string
  /** 分类（后端 t_supplier.category，列表 supplyType 同源） */
  supplyType?: string
  address?: string
  settlementType?: 'CASH' | 'MONTHLY' | 'QUARTERLY'
  settlementDay?: number
  taxRate?: number
  contactPerson?: string
  contactMobile?: string
  bankName?: string
  bankAccount?: string
  bankAccountName?: string
  remark?: string
}

export const supplierApi = {
  async getList(query: SupplierQuery): Promise<SupplierListResponse> {
    return get('/admin/suppliers', query)
  },

  async getById(id: number): Promise<Supplier> {
    return get(`/admin/suppliers/${id}`)
  },

  /** 供应商统计（应付账款 = SUM(payable_amount)） */
  async getStats(id: number): Promise<SupplierStats> {
    return get(`/admin/suppliers/${id}/stats`)
  },

  async create(data: SupplierSaveParams): Promise<Supplier> {
    return post('/admin/suppliers', data)
  },

  async update(id: number, data: Partial<SupplierSaveParams>): Promise<Supplier> {
    return put(`/admin/suppliers/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    return del(`/admin/suppliers/${id}`)
  }
}
