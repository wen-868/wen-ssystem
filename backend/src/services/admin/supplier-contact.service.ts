import { queryWithTenant, queryOneWithTenant, query } from "../../shared/db";

export interface SupplierContactRow {
    id: number;
    supplier_id: number;
    name: string;
    mobile: string | null;
    phone: string | null;
    email: string | null;
    wechat: string | null;
    is_primary: number;
    position: string | null;
    remark: string | null;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

/** 供应商 ID 行 */
interface SupplierIdRow {
    id: number;
}

/**
 * 按供应商ID查询联系人列表
 * @param supplierId 供应商ID
 */
export async function listBySupplierId(supplierId: number, tenantId: string) {
    return queryWithTenant<SupplierContactRow>(
        `SELECT id, supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark, created_at, updated_at
     FROM t_supplier_contact
     WHERE supplier_id = ? AND tenant_id = ?
     ORDER BY is_primary DESC, id ASC`,
        [supplierId, tenantId],
        tenantId
    );
}

/** 获取联系人详情 */
export async function getById(id: number, tenantId: string) {
    return queryOneWithTenant<SupplierContactRow>(
        `SELECT id, supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark, created_at, updated_at
     FROM t_supplier_contact
     WHERE id = ? AND tenant_id = ?`,
        [id, tenantId],
        tenantId
    );
}

/** 设置联系人为主联系人（同供应商其他联系人取消主标识） */
export async function setPrimary(id: number, tenantId: string) {
    const contact = await getById(id, tenantId);
    if (!contact) {
        throw Object.assign(new Error("联系人不存在"), { statusCode: 404 });
    }
    // 事务内：清除同供应商其他主联系人 + 设置当前为主
    await query(
        "UPDATE t_supplier_contact SET is_primary = 0 WHERE supplier_id = ? AND tenant_id = ?",
        [contact.supplier_id, tenantId],
        tenantId
    );
    await query(
        "UPDATE t_supplier_contact SET is_primary = 1 WHERE id = ? AND tenant_id = ?",
        [id, tenantId],
        tenantId
    );
    return getById(id, tenantId);
}

/** 检查供应商是否存在 */
async function supplierExists(supplierId: number, tenantId: string): Promise<boolean> {
    const row = await queryOneWithTenant<SupplierIdRow>(
        "SELECT id FROM t_supplier WHERE id = ? AND tenant_id = ?",
        [supplierId, tenantId],
        tenantId
    );
    return !!row;
}

/** 新增供应商联系人 */
export async function create(supplierId: number, body: {
    name: string;
    mobile?: string;
    phone?: string;
    email?: string;
    wechat?: string;
    isPrimary?: boolean;
    position?: string;
    remark?: string;
}, tenantId: string) {
    // 检查供应商是否存在
    const exists = await supplierExists(supplierId, tenantId);
    if (!exists) {
        throw Object.assign(new Error("供应商不存在"), { statusCode: 404 });
    }

    // 如果设为主联系人，先清除其他主联系人
    if (body.isPrimary) {
        await query(
            "UPDATE t_supplier_contact SET is_primary = 0 WHERE supplier_id = ? AND tenant_id = ?",
            [supplierId, tenantId]
        );
    }

    const result = await queryWithTenant<{ insertId: number }>(
        `INSERT INTO t_supplier_contact (supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            supplierId,
            body.name,
            body.mobile ?? null,
            body.phone ?? null,
            body.email ?? null,
            body.wechat ?? null,
            body.isPrimary ? 1 : 0,
            body.position ?? null,
            body.remark ?? null,
            tenantId,
        ],
        tenantId
    );
    return { id: (result as unknown as Record<string, unknown>).insertId };
}

/** 修改供应商联系人 */
export async function update(id: number, body: {
    name?: string;
    mobile?: string;
    phone?: string;
    email?: string;
    wechat?: string;
    isPrimary?: boolean;
    position?: string;
    remark?: string;
}, tenantId: string) {
    const existing = await queryOneWithTenant<SupplierContactRow>(
        "SELECT id, supplier_id FROM t_supplier_contact WHERE id = ? AND tenant_id = ?",
        [id, tenantId],
        tenantId
    );
    if (!existing) {
        throw Object.assign(new Error("联系人不存在"), { statusCode: 404 });
    }

    // 如果设为主联系人，先清除同供应商其他主联系人
    if (body.isPrimary) {
        await query(
            "UPDATE t_supplier_contact SET is_primary = 0 WHERE supplier_id = ? AND tenant_id = ? AND id != ?",
            [existing.supplier_id, tenantId, id]
        );
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
    if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
    if (body.phone !== undefined) { sets.push("phone = ?"); params.push(body.phone); }
    if (body.email !== undefined) { sets.push("email = ?"); params.push(body.email); }
    if (body.wechat !== undefined) { sets.push("wechat = ?"); params.push(body.wechat); }
    if (body.isPrimary !== undefined) { sets.push("is_primary = ?"); params.push(body.isPrimary ? 1 : 0); }
    if (body.position !== undefined) { sets.push("position = ?"); params.push(body.position); }
    if (body.remark !== undefined) { sets.push("remark = ?"); params.push(body.remark); }
    if (sets.length === 0) return { id };

    params.push(id, tenantId);
    await queryWithTenant(
        `UPDATE t_supplier_contact SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
        params,
        tenantId
    );
    return { id };
}

/** 删除供应商联系人 */
export async function remove(id: number, tenantId: string) {
    const existing = await queryOneWithTenant<SupplierContactRow>(
        "SELECT id FROM t_supplier_contact WHERE id = ? AND tenant_id = ?",
        [id, tenantId],
        tenantId
    );
    if (!existing) {
        throw Object.assign(new Error("联系人不存在"), { statusCode: 404 });
    }

    await queryWithTenant(
        "DELETE FROM t_supplier_contact WHERE id = ? AND tenant_id = ?",
        [id, tenantId],
        tenantId
    );
    return { id };
}
