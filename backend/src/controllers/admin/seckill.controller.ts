import { ok } from "../../shared/response";
import * as seckillService from "../../services/admin/seckill.service";

/** 获取秒杀商品列表 */
export async function getSeckillProducts(req: any, res: any) {
  const data = await seckillService.getSeckillProducts(req.tenantId, req.query);
  res.json(ok(data));
}

/** 创建秒杀商品 */
export async function createSeckillProduct(req: any, res: any) {
  const data = await seckillService.createSeckillProduct({ ...req.body, tenantId: req.tenantId });
  res.json(ok(data));
}

/** 更新秒杀商品 */
export async function updateSeckillProduct(req: any, res: any) {
  const data = await seckillService.updateSeckillProduct(Number(req.params.id), { ...req.body, tenantId: req.tenantId });
  res.json(ok(data));
}

/** 删除秒杀商品 */
export async function deleteSeckillProduct(req: any, res: any) {
  const data = await seckillService.deleteSeckillProduct(Number(req.params.id), req.tenantId);
  res.json(ok(data));
}
