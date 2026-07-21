import { get, post, put, del } from '../request'

// 收货地址类型
export interface AddressInfo {
    id: number
    userId: number
    name: string
    mobile: string
    province: string
    city: string
    district: string
    detail: string
    isDefault: number
    createdAt?: string
    updatedAt?: string
}

export interface AddressListResult {
    list: AddressInfo[]
    total: number
}

export interface CreateAddressParams {
    name: string
    mobile: string
    province: string
    city: string
    district: string
    detail: string
    isDefault?: number
}

export type UpdateAddressParams = Partial<CreateAddressParams>

const addressApi = {
    // 地址列表
    async list(params?: { page?: number; pageSize?: number; userId?: number }): Promise<AddressListResult> {
        const res: any = await get('/retail-consumer-address/miniapp/addresses', params)
        return {
            list: res?.list ?? res?.result?.list ?? res ?? [],
            total: res?.total ?? res?.result?.total ?? 0,
        }
    },

    // 新增地址
    async create(data: CreateAddressParams): Promise<AddressInfo> {
        const res: any = await post('/retail-consumer-address/miniapp/addresses', data)
        return (res?.result ?? res) as AddressInfo
    },

    // 更新地址
    async update(id: number, data: UpdateAddressParams): Promise<AddressInfo> {
        const res: any = await put(`/retail-consumer-address/miniapp/addresses/${id}`, data)
        return (res?.result ?? res) as AddressInfo
    },

    // 删除地址
    async delete(id: number): Promise<void> {
        return del(`/retail-consumer-address/miniapp/addresses/${id}`)
    },

    // 设为默认
    async setDefault(id: number): Promise<void> {
        return put(`/retail-consumer-address/miniapp/addresses/${id}/default`, {})
    },
}

export { addressApi }
