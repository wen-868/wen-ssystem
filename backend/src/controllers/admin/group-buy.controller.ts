import { ok } from "../../shared/response";
import * as groupBuyService from "../../services/admin/group-buy.service";

/** 获取拼团活动列表 */
export async function getGroupBuyActivities(req: any, res: any) {
  const data = await groupBuyService.getGroupBuyActivities(req.tenantId, req.query);
  res.json(ok(data));
}

/** 创建拼团活动 */
export async function createGroupBuyActivity(req: any, res: any) {
  const data = await groupBuyService.createGroupBuyActivity(req.body);
  res.json(ok(data));
}

/** 更新拼团活动 */
export async function updateGroupBuyActivity(req: any, res: any) {
  const data = await groupBuyService.updateGroupBuyActivity(Number(req.params.id), req.body);
  res.json(ok(data));
}

/** 删除拼团活动 */
export async function deleteGroupBuyActivity(req: any, res: any) {
  const data = await groupBuyService.deleteGroupBuyActivity(Number(req.params.id));
  res.json(ok(data));
}

/** 获取拼团记录列表 */
export async function getGroupBuyRecords(req: any, res: any) {
  const data = await groupBuyService.getGroupBuyRecords(req.tenantId, req.query);
  res.json(ok(data));
}

/** 获取拼团记录详情 */
export async function getGroupBuyRecordDetail(req: any, res: any) {
  const data = await groupBuyService.getGroupBuyRecordDetail(req.params.groupNo);
  res.json(ok(data));
}

/** 取消拼团记录 */
export async function cancelGroupBuyRecord(req: any, res: any) {
  const data = await groupBuyService.cancelGroupBuyRecord(req.params.groupNo);
  res.json(ok(data));
}
