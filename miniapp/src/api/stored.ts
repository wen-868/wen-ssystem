import { get, post } from './request'

export interface StoredCardInfo {
  cardNo: string
  balance: number
  totalRecharge: number
  totalConsume: number
  grade?: string
  gradeIcon?: string
}

export interface StoredRecord {
  id: number
  type: 'RECHARGE' | 'CONSUME'
  amount: number
  balance: number
  reason: string
  orderNo?: string
  createdAt: string
}

export interface RechargeOption {
  id: number
  amount: number
  giftAmount: number
  tag?: string
}

export interface RechargeRequest {
  amount: number
  payMethod: 'WECHAT'
}

export interface RechargeResponse {
  rechargeId: number
  amount: number
  payParams: {
    timeStamp: string
    nonceStr: string
    package: string
    signType: string
    paySign: string
  }
}

export const storedApi = {
  getStoredCardInfo: (): Promise<StoredCardInfo> => {
    return get('/miniapp/stored-card')
  },

  getStoredRecords: (params?: {
    type?: string
    page?: number
    pageSize?: number
  }): Promise<{
    total: number
    page: number
    pageSize: number
    records: StoredRecord[]
  }> => {
    return get('/miniapp/stored-card/records', params as Record<string, unknown>)
  },

  getRechargeOptions: (): Promise<RechargeOption[]> => {
    return get('/miniapp/stored-card/recharge-options')
  },

  recharge: (data: RechargeRequest): Promise<RechargeResponse> => {
    return post('/miniapp/stored-card/recharge', data as unknown as Record<string, unknown>)
  }
}
