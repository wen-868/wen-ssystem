import { ok } from "../../shared/response";
import { getSlowQueries } from "../../middleware/slow-query-monitor";

/** 获取慢查询列表 */
export async function listSlowQueries(_req: any, res: any) {
  const queries = getSlowQueries();
  res.json(ok({ total: queries.length, items: queries }));
}
