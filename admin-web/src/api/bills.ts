import { api } from "./request";

// ==================== 历史单据（单据管理） ====================

export interface HistoryBillParams {
  billType?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

/** 历史单据统一查询：销售单/销售订单/采购订单/采购入库，按日期筛选 */
export async function fetchHistoryBills(params?: HistoryBillParams) {
  const { data } = await api.get("/admin/bills/history", {
    params: { page: 1, pageSize: 20, ...params },
  });
  return data.data;
}
