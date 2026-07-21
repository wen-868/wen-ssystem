import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/supplier-contact.service";

/** 按供应商ID查询联系人列表 */
export async function listContacts(req: any, res: any) {
    const rows = await service.listBySupplierId(
        Number(req.params.supplierId),
        req.tenantId!
    );
    res.json(ok(rows));
}

/** 获取联系人详情 */
export async function getContact(req: any, res: any) {
    const row = await service.getById(Number(req.params.id), req.tenantId!);
    res.json(ok(row));
}

/** 新增供应商联系人 */
export async function createContact(req: any, res: any) {
    const body = z.object({
        name: z.string().min(1).max(64),
        mobile: z.string().max(20).optional(),
        phone: z.string().max(32).optional(),
        email: z.string().email().max(128).optional(),
        wechat: z.string().max(64).optional(),
        isPrimary: z.boolean().default(false),
        position: z.string().max(64).optional(),
        remark: z.string().max(255).optional(),
    }).parse(req.body);
    const result = await service.create(
        Number(req.params.supplierId),
        body,
        req.tenantId!
    );
    res.json(ok(result));
}

/** 修改供应商联系人 */
export async function updateContact(req: any, res: any) {
    const body = z.object({
        name: z.string().min(1).max(64).optional(),
        mobile: z.string().max(20).optional(),
        phone: z.string().max(32).optional(),
        email: z.string().email().max(128).optional(),
        wechat: z.string().max(64).optional(),
        isPrimary: z.boolean().optional(),
        position: z.string().max(64).optional(),
        remark: z.string().max(255).optional(),
    }).parse(req.body);
    const result = await service.update(
        Number(req.params.id),
        body,
        req.tenantId!
    );
    res.json(ok(result));
}

/** 删除供应商联系人 */
export async function deleteContact(req: any, res: any) {
    const result = await service.remove(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
}
