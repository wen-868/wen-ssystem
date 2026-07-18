import { get, post, put, del } from '../request'

export interface Supplier {
  id: number
  name: string
  code: string
  contactName: string
  contactPhone: string
  address: string
  bankName: string
  bankAccount: string
  taxNo: string
  paymentTerms: string
  status: string
  remark: string
  createdAt: string
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

export const supplierApi = {
  async getList(query: SupplierQuery): Promise<SupplierListResponse> {
    return get('/suppliers', query)
  },

  async getById(id: number): Promise<Supplier> {
    return get(`/suppliers/${id}`)
  },

  async create(data: Partial<Supplier>): Promise<Supplier> {
    return post('/suppliers', data)
  },

  async update(id: number, data: Partial<Supplier>): Promise<Supplier> {
    return put(`/suppliers/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    return del(`/suppliers/${id}`)
  }
}
