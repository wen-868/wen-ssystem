export interface ServiceContext {
  tenantId: string;
  userId: number;
  username: string;
  storeId?: number | null;
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery extends PageParams {
  keyword?: string;
  status?: string;
  [key: string]: any;
}
