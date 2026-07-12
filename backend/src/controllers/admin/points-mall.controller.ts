import { ok } from "../../shared/response";
import * as pointsMallService from "../../services/admin/points-mall.service";

/** 获取积分商城商品列表 */
export async function getPointsMallItems(req: any, res: any) {
  const data = await pointsMallService.getPointsMallItems(req.tenantId, req.query);
  res.json(ok(data));
}

/** 创建积分商城商品 */
export async function createPointsMallItem(req: any, res: any) {
  const data = await pointsMallService.createPointsMallItem(req.body);
  res.json(ok(data));
}

/** 更新积分商城商品 */
export async function updatePointsMallItem(req: any, res: any) {
  const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body);
  res.json(ok(data));
}

/** 删除积分商城商品 */
export async function deletePointsMallItem(req: any, res: any) {
  const data = await pointsMallService.deletePointsMallItem(Number(req.params.id));
  res.json(ok(data));
}

/** 更新积分商城商品状态 */
export async function updatePointsMallItemStatus(req: any, res: any) {
  const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body);
  res.json(ok(data));
}

/** 获取积分兑换订单列表 */
export async function getPointsMallOrders(req: any, res: any) {
  const data = await pointsMallService.getPointsMallOrders(req.tenantId, req.query);
  res.json(ok(data));
}

/** 积分兑换订单发货 */
export async function deliverPointsMallOrder(req: any, res: any) {
  const data = await pointsMallService.deliverPointsMallOrder(Number(req.params.id), req.body);
  res.json(ok(data));
}

/** 取消积分兑换订单 */
export async function cancelPointsMallOrder(req: any, res: any) {
  const data = await pointsMallService.cancelPointsMallOrder(Number(req.params.id));
  res.json(ok(data));
}
