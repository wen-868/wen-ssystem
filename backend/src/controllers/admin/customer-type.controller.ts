import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/customer-type.service";

/** 客户类型列表 */
export async function listCustomerTypes(req: any, res: any) {
    const status = req.query.status !== undefined
        ? Number(req.query.status)
        : undefined;
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
