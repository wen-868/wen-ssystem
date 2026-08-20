import { listHistoryBills, BILL_TYPE_LABELS } from "../../services/admin/history-bill.service";
import { ok } from "../../shared/response";

/** 历史单据列表（单据管理）：类型 + 日期筛选 */
export async function handleListHistoryBills(req: any, res: any) {
  const billType = (req.query.billType as string) || "";
  const startDate = (req.query.startDate as string) || "";
  const endDate = (req.query.endDate as string) || "";
  const keyword = (req.query.keyword as string) || "";
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));

  const result = await listHistoryBills({
    tenantId: req.tenantId as string,
    billType: billType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    keyword: keyword || undefined,
    page,
    pageSize,
  });

  res.json(
    ok({
      ...result,
      billTypes: BILL_TYPE_LABELS,
    })
  );
}
