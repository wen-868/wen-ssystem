export interface Product {
  id: number
  name: string
  image: string
  price: number
  originalPrice?: number
  sales: number
  brand?: string
  categoryId?: number
  sku?: string
  description?: string
}

export interface Category {
  id: number
  name: string
  icon?: string
  image?: string
  parentId?: number
  sortOrder?: number
}

export interface Banner {
  id: number
  image: string
  title?: string
  linkType?: string
  linkUrl?: string
  sortOrder?: number
}

export interface Activity {
  id: number
  title: string
  image: string
  startTime: string
  endTime: string
  description?: string
  linkUrl?: string
}

export interface SearchHistory {
  keyword: string
  timestamp: number
}

export interface HotSearch {
  id: number
  keyword: string
  sortOrder?: number
}

export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}