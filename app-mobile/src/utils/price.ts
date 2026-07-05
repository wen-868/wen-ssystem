/**
 * 价格权限工具函数
 * 统一的价格可见性判断，禁止在业务代码中手写 customerType === "WHOLESALE" 等判断
 *
 * 标准依据：项目统一标准 第五章 5.1 节（价格隔离）
 */

/** 客户类型 */
export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'SUPPLIER'

/** 价格字段 */
export type PriceField = 'retailPrice' | 'wholesalePrice' | 'costPrice' | 'supplyPrice'

/**
 * 判断是否为批发客户
 */
export function isWholesaleCustomer(customerType?: string): boolean {
  return customerType === 'WHOLESALE'
}

/**
 * 判断是否为零售客户
 */
export function isRetailCustomer(customerType?: string): boolean {
  return customerType === 'RETAIL'
}

/**
 * 根据客户类型获取可见价格字段列表
 * - 零售商: 零售价
 * - 批发商: 批发价
 * - 供应商: 供货价
 * - 管理员: 全部价格
 */
export function getVisiblePriceFields(customerType?: string, roles?: string[]): PriceField[] {
  const isAdmin = roles?.includes('SUPER_ADMIN') || roles?.includes('ADMIN')

  if (isAdmin) {
    return ['retailPrice', 'wholesalePrice', 'costPrice', 'supplyPrice']
  }

  switch (customerType) {
    case 'WHOLESALE':
      return ['wholesalePrice']
    case 'SUPPLIER':
      return ['supplyPrice']
    case 'RETAIL':
    default:
      return ['retailPrice']
  }
}

/**
 * 判断指定价格字段是否对当前客户可见
 */
export function isPriceFieldVisible(
  field: PriceField,
  customerType?: string,
  roles?: string[]
): boolean {
  return getVisiblePriceFields(customerType, roles).includes(field)
}