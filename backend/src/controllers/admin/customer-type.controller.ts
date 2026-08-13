import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/customer-type.service";

/** 客户类型列表 */
export async function listCustomerTypes(req: any, res: any) {
    const rawStatus = req.query.status;
    // 兼容数字 1/0 与字符串 ENABLED/DISABLED
    let status: number | undefined;
    if (rawStatus === "ENABLED" || rawStatus === "true" || rawStatus === "1" || rawStatus === 1) {
        status = 1;
    } else if (rawStatus === "DISABLED" || rawStatus === "false" || rawStatus === "0" || rawStatus === 0) {
        status = 0;
    }
    const rows = await service.list({
        status,
        tenantId: req.tenantId!,
    });
    res.json(ok(rows));
}

/** 客户类型详情 */
export async function getCustomerType(req: any, res: any) {
    const row = await service.getById(Number(req.params.id), req.tenantId!);
    res.json(ok(row));
}

/** 新增客户类型 */
export async function createCustomerType(req: any, res: any) {
    const body = z.object({
        name: z.string().min(1).max(50),
        code: z.string().min(1).max(32),
        sort: z.number().int().default(0),
        status: z.number().int().min(0).max(1).default(1),
    }).parse(req.body);
    const result = await service.create(body, req.tenantId!);
    res.json(ok(result));
}

/** 修改客户类型 */
export async function updateCustomerType(req: any, res: any) {
    const body = z.object({
        name: z.string().min(1).max(50).optional(),
        code: z.string().min(1).max(32).optional(),
        sort: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
    }).parse(req.body);
    const result = await service.update(Number(req.params.id), body, req.tenantId!);
    res.json(ok(result));
}

/** 删除客户类型 */
export async function deleteCustomerType(req: any, res: any) {
    const result = await service.remove(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
}
