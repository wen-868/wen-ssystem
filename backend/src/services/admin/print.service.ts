/**
 * 打印记录服务
 *
 * 用途：App 端蓝牙打印小票留痕审计，支持销售单/销售退货/班结/日结/重打等场景。
 * 使用 queryWithTenant / queryOneWithTenant 实现租户隔离，所有查询/写入自动注入 tenant_id。
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";
import {
    DEFAULT_PRINT_TEMPLATES,
    PRINT_BILL_TYPE_VALUES,
    PRINT_PAPER_TYPE_VALUES,
} from "./print-templates";

// ==================== 类型定义 ====================

/** 单据类型枚举 */
export type PrintBillType =
    | "SALE_BILL"
    | "SALE_RETURN"
    | "SHIFT"
    | "DAILY_SETTLE"
    | "SALE_RECEIPT"
    | "PURCHASE_ORDER"
    | "REPORT"
    | "LABEL"
    | "REPRINT";

/** 打印状态枚举 */
export type PrintStatus = "SUCCESS" | "FAILED" | "PENDING";

/** 打印记录行（数据库返回结构） */
export interface PrintRecordRow {
    id: number;
    tenant_id: string;
    store_id: number | null;
    bill_type: PrintBillType;
    bill_no: string;
    printer_mac: string | null;
    print_content: string | null;
    copies: number;
    operator_id: number | null;
    status: PrintStatus;
    error_msg: string | null;
    original_id: number | null;
    created_at: string;
    updated_at: string;
}

/** 创建打印记录入参 */
export interface PrintRecordCreateInput {
    storeId?: number | null;
    billType: PrintBillType;
    billNo: string;
    printerMac?: string | null;
    printContent?: string | null;
    copies?: number;
    operatorId?: number | null;
    status?: PrintStatus;
    errorMsg?: string | null;
    originalId?: number | null;
}

/** 查询打印记录筛选条件 */
export interface PrintRecordListFilters {
    billType?: PrintBillType;
    billNo?: string;
    storeId?: number;
    status?: PrintStatus;
    operatorId?: number;
    startDate?: string;
    endDate?: string;
}

/** 分页参数 */
export interface PrintRecordPagination {
    page: number;
    pageSize: number;
}

/** 单据类型白名单（用于参数校验） */
export const BILL_TYPE_VALUES: readonly PrintBillType[] = [
    "SALE_BILL",
    "SALE_RETURN",
    "SHIFT",
    "DAILY_SETTLE",
    "SALE_RECEIPT",
    "PURCHASE_ORDER",
    "REPORT",
    "LABEL",
    "REPRINT",
] as const;

/** 打印状态白名单 */
export const STATUS_VALUES: readonly PrintStatus[] = [
    "SUCCESS",
    "FAILED",
    "PENDING",
] as const;

// ==================== 服务函数 ====================

/**
 * 创建打印记录
 *
 * @param data 打印记录数据
 * @param tenantId 租户ID
 * @returns 新建记录ID
 */
export async function createPrintRecord(
    data: PrintRecordCreateInput,
    tenantId: string
): Promise<{ id: number }> {
    // 校验单据类型
    if (!BILL_TYPE_VALUES.includes(data.billType)) {
        throw Object.assign(new Error(`非法的单据类型：${data.billType}`), { statusCode: 400 });
    }
    // 校验状态（默认 SUCCESS）
    const status: PrintStatus = data.status ?? "SUCCESS";
    if (!STATUS_VALUES.includes(status)) {
        throw Object.assign(new Error(`非法的打印状态：${status}`), { statusCode: 400 });
    }
    // 校验单据编号
    if (!data.billNo || data.billNo.trim().length === 0) {
        throw Object.assign(new Error("单据编号不能为空"), { statusCode: 400 });
    }

    const copies = data.copies ?? 1;
    if (copies < 1 || copies > 99) {
        throw Object.assign(new Error("打印份数必须在 1-99 之间"), { statusCode: 400 });
    }

    const result = await queryWithTenant<ResultSetHeader>(
        `INSERT INTO t_print_record
      (store_id, bill_type, bill_no, printer_mac, print_content, copies, operator_id, status, error_msg, original_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.storeId ?? null,
            data.billType,
            data.billNo,
            data.printerMac ?? null,
            data.printContent ?? null,
            copies,
            data.operatorId ?? null,
            status,
            data.errorMsg ?? null,
            data.originalId ?? null,
        ],
        tenantId
    ) as unknown as ResultSetHeader | ResultSetHeader[];

    // queryWithTenant 对 INSERT 的返回形态：
    //  - 真实 DB：ResultSetHeader 对象（含 insertId，见 database.ts queryWithTenant 的 pool.query 分支）
    //  - mock DB：[ResultSetHeader] 数组（见 database.ts queryWithTenant 的 mock 分支）
    // 兼容两种形态提取 insertId（踩坑日志 [23]：mock 下数组访问 .insertId 为 undefined）
    const insertId =
        Number(
            Array.isArray(result) ? result[0]?.insertId : result?.insertId
        ) || 0;
    return { id: insertId };
}

/**
 * 查询打印记录列表（支持筛选 + 分页）
 *
 * @param filters 筛选条件
 * @param pagination 分页参数
 * @param tenantId 租户ID
 * @returns 分页记录列表
 */
export async function listPrintRecords(
    filters: PrintRecordListFilters,
    pagination: PrintRecordPagination,
    tenantId: string
): Promise<{
    total: number;
    page: number;
    pageSize: number;
    records: PrintRecordRow[];
}> {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    // 动态构建 WHERE 条件（tenant_id 由 queryWithTenant 自动注入）
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.billType) {
        conditions.push("bill_type = ?");
        values.push(filters.billType);
    }
    if (filters.billNo) {
        conditions.push("bill_no = ?");
        values.push(filters.billNo);
    }
    if (filters.storeId !== undefined) {
        conditions.push("store_id = ?");
        values.push(filters.storeId);
    }
    if (filters.status) {
        conditions.push("status = ?");
        values.push(filters.status);
    }
    if (filters.operatorId !== undefined) {
        conditions.push("operator_id = ?");
        values.push(filters.operatorId);
    }
    if (filters.startDate) {
        conditions.push("created_at >= ?");
        values.push(filters.startDate);
    }
    if (filters.endDate) {
        conditions.push("created_at <= ?");
        values.push(filters.endDate);
    }

    const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const records = await queryWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
        tenantId
    );

    const totalRow = await queryOneWithTenant<{ total: number }>(
        `SELECT COUNT(*) AS total FROM t_print_record ${whereClause}`,
        values,
        tenantId
    );

    return {
        total: Number(totalRow?.total ?? 0),
        page,
        pageSize,
        records,
    };
}

/**
 * 查询单条打印记录详情
 *
 * @param id 记录ID
 * @param tenantId 租户ID
 * @returns 记录详情（不存在时抛 404）
 */
export async function getPrintRecordDetail(
    id: number,
    tenantId: string
): Promise<PrintRecordRow> {
    const row = await queryOneWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     WHERE id = ?`,
        [id],
        tenantId
    );

    if (!row) {
        throw Object.assign(new Error("打印记录不存在"), { statusCode: 404 });
    }

    return row;
}

/**
 * 重打 — 复制原记录生成新记录，bill_type 标记为 REPRINT，original_id 关联原记录
 *
 * @param id 原记录ID
 * @param operatorId 操作员ID（重打发起人）
 * @param tenantId 租户ID
 * @returns 新记录ID + 原记录ID
 */
export async function reprintRecord(
    id: number,
    operatorId: number,
    tenantId: string
): Promise<{ id: number; originalId: number }> {
    // 先查询原记录（自动租户隔离，避免跨租户重打）
    const original = await queryOneWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     WHERE id = ?`,
        [id],
        tenantId
    );

    if (!original) {
        throw Object.assign(new Error("原打印记录不存在"), { statusCode: 404 });
    }

    // 复制原记录数据，bill_type 改为 REPRINT，original_id 指向原记录
    const result = await queryWithTenant<ResultSetHeader>(
        `INSERT INTO t_print_record
      (store_id, bill_type, bill_no, printer_mac, print_content, copies, operator_id, status, error_msg, original_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            original.store_id,
            "REPRINT",
            original.bill_no,
            original.printer_mac,
            original.print_content,
            original.copies,
            operatorId,
            "PENDING",
            null,
            original.id,
        ],
        tenantId
    ) as unknown as ResultSetHeader | ResultSetHeader[];

    // 兼容 mock（数组）与真实 DB（对象）两种 INSERT 返回形态，详见踩坑日志 [23]
    const insertId =
        Number(
            Array.isArray(result) ? result[0]?.insertId : result?.insertId
        ) || 0;
    return { id: insertId, originalId: original.id };
}

// ==================== 打印模板管理 ====================

/** 打印模板行（数据库返回结构） */
export interface PrintTemplateRow {
    id: number;
    tenant_id: string;
    store_id: number | null;
    bill_type: string;
    paper_type: string;
    template_name: string;
    content: string | null;
    is_default: number;
    version: number;
    status: number;
    updated_by: number | null;
    created_at: string;
    updated_at: string;
}

/** 模板创建/更新入参 */
export interface PrintTemplateInput {
    billType: string;
    paperType: string;
    templateName?: string;
    content?: string;
    status?: number;
}

/** 校验模板入参（单据类型/纸张类型白名单） */
function assertTemplateInput(input: PrintTemplateInput): void {
    if (!PRINT_BILL_TYPE_VALUES.includes(input.billType)) {
        throw Object.assign(new Error(`非法的单据类型：${input.billType}`), { statusCode: 400 });
    }
    if (!PRINT_PAPER_TYPE_VALUES.includes(input.paperType)) {
        throw Object.assign(new Error(`非法的纸张类型：${input.paperType}`), { statusCode: 400 });
    }
}

/**
 * 确保租户存在默认模板：首次访问模板列表时，为每个单据类型写入系统默认模板。
 * 幂等：仅当该租户某单据类型无任何模板时写入。
 */
export async function ensureDefaultPrintTemplates(tenantId: string): Promise<void> {
    const rows = await queryWithTenant<{ bill_type: string; content: string | null; is_default: number; template_name: string | null }>(
        `SELECT bill_type, content, is_default, template_name FROM t_print_template WHERE tenant_id = ?`,
        [tenantId],
        tenantId
    ) as unknown as Array<{ bill_type: string; content: string | null; is_default: number; template_name: string | null }>;
    const list = Array.isArray(rows) ? rows : [];
    // 每种单据类型取第一条（默认模板优先）
    const existingByType = new Map<string, { content: string | null; is_default: number; template_name: string | null }>();
    for (const r of list) {
        const cur = existingByType.get(r.bill_type);
        if (!cur || (r.is_default === 1 && cur.is_default !== 1)) {
            existingByType.set(r.bill_type, { content: r.content, is_default: r.is_default, template_name: r.template_name });
        }
    }

    for (const [billType, def] of Object.entries(DEFAULT_PRINT_TEMPLATES)) {
        const existing = existingByType.get(billType);
        if (!existing) {
            await queryWithTenant<ResultSetHeader>(
                `INSERT INTO t_print_template
                  (tenant_id, store_id, bill_type, paper_type, template_name, content, is_default, version, status)
                 VALUES (?, NULL, ?, ?, ?, ?, 1, 1, 1)`,
                [tenantId, billType, def.paper, def.name, def.content],
                tenantId
            );
            continue;
        }
        // 旧版 HTML 默认模板自动升级为可视化 JSON 结构
        const content = String(existing.content ?? "");
        if (existing.is_default === 1 && !content.includes('"modules"')) {
            await queryWithTenant<ResultSetHeader>(
                `UPDATE t_print_template
                 SET paper_type = ?, template_name = ?, content = ?, version = version + 1
                 WHERE tenant_id = ? AND bill_type = ? AND is_default = 1`,
                [def.paper, def.name, def.content, tenantId, billType],
                tenantId
            );
        } else if (existing.is_default === 1 && existing.template_name === "批发销售单（默认）") {
            // 旧模板名自动迁移：批发销售单 → 销售单
            await queryWithTenant<ResultSetHeader>(
                `UPDATE t_print_template
                 SET template_name = ?, version = version + 1
                 WHERE tenant_id = ? AND bill_type = ? AND is_default = 1`,
                ["销售单（默认）", tenantId, billType],
                tenantId
            );
        }
    }
}

/** 模板列表（支持按单据类型筛选，返回内容字段） */
export async function listPrintTemplates(
    filters: { billType?: string; paperType?: string },
    tenantId: string
): Promise<PrintTemplateRow[]> {
    // 注意：SELECT 列含 tenant_id 时注入器会跳过自动注入，须显式带租户条件
    const conditions = ["tenant_id = ?"];
    const values: unknown[] = [tenantId];
    if (filters.billType) {
        conditions.push("bill_type = ?");
        values.push(filters.billType);
    }
    if (filters.paperType) {
        conditions.push("paper_type = ?");
        values.push(filters.paperType);
    }
    return (await queryWithTenant<PrintTemplateRow>(
        `SELECT id, tenant_id AS tenantId, store_id AS storeId, bill_type AS billType, paper_type AS paperType,
                template_name AS templateName, content, is_default AS isDefault, version, status,
                updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
         FROM t_print_template
         WHERE ${conditions.join(" AND ")}
         ORDER BY bill_type, id`,
        values,
        tenantId
    )) as unknown as PrintTemplateRow[];
}

/** 模板详情 */
export async function getPrintTemplate(id: number, tenantId: string): Promise<PrintTemplateRow> {
    const row = await queryOneWithTenant<PrintTemplateRow>(
        `SELECT id, tenant_id AS tenantId, store_id AS storeId, bill_type AS billType, paper_type AS paperType,
                template_name AS templateName, content, is_default AS isDefault, version, status,
                updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
         FROM t_print_template
         WHERE id = ? AND tenant_id = ?`,
        [id, tenantId],
        tenantId
    );
    if (!row) {
        throw Object.assign(new Error("打印模板不存在"), { statusCode: 404 });
    }
    return row;
}

/** 创建模板 */
export async function createPrintTemplate(
    input: PrintTemplateInput,
    operatorId: number | null,
    tenantId: string
): Promise<{ id: number }> {
    assertTemplateInput(input);
    const result = await queryWithTenant<ResultSetHeader>(
        `INSERT INTO t_print_template
          (tenant_id, store_id, bill_type, paper_type, template_name, content, is_default, version, status, updated_by)
         VALUES (?, NULL, ?, ?, ?, ?, 0, 1, ?, ?)`,
        [
            tenantId,
            input.billType,
            input.paperType,
            input.templateName?.trim() || "未命名模板",
            input.content ?? "",
            input.status ?? 1,
            operatorId,
        ],
        tenantId
    ) as unknown as ResultSetHeader | ResultSetHeader[];
    const insertId = Number(Array.isArray(result) ? result[0]?.insertId : result?.insertId) || 0;
    return { id: insertId };
}

/** 更新模板 */
export async function updatePrintTemplate(
    id: number,
    input: Partial<PrintTemplateInput>,
    operatorId: number | null,
    tenantId: string
): Promise<{ id: number }> {
    const existing = await getPrintTemplate(id, tenantId);
    assertTemplateInput({
        billType: input.billType ?? existing.bill_type,
        paperType: input.paperType ?? existing.paper_type,
    });
    await queryWithTenant<ResultSetHeader>(
        `UPDATE t_print_template
         SET paper_type = ?, template_name = ?, content = ?, status = ?, version = version + 1, updated_by = ?
         WHERE id = ?`,
        [
            input.paperType ?? existing.paper_type,
            input.templateName?.trim() || existing.template_name,
            input.content ?? existing.content ?? "",
            input.status ?? existing.status,
            operatorId,
            id,
        ],
        tenantId
    );
    return { id };
}

/** 删除模板（系统默认模板不允许删除） */
export async function deletePrintTemplate(id: number, tenantId: string): Promise<{ id: number }> {
    const existing = await getPrintTemplate(id, tenantId);
    if (existing.is_default === 1) {
        throw Object.assign(new Error("系统默认模板不可删除，可重置后另存为自定义模板"), { statusCode: 400 });
    }
    await queryWithTenant<ResultSetHeader>(
        `DELETE FROM t_print_template WHERE id = ?`,
        [id],
        tenantId
    );
    return { id };
}

/** 重置为系统默认模板（按单据类型） */
export async function resetPrintTemplate(id: number, tenantId: string): Promise<{ id: number }> {
    const existing = await getPrintTemplate(id, tenantId);
    const def = DEFAULT_PRINT_TEMPLATES[existing.bill_type];
    if (!def) {
        throw Object.assign(new Error(`该单据类型暂无默认模板：${existing.bill_type}`), { statusCode: 400 });
    }
    await queryWithTenant<ResultSetHeader>(
        `UPDATE t_print_template
         SET paper_type = ?, template_name = ?, content = ?, version = version + 1
         WHERE id = ?`,
        [def.paper, def.name, def.content, id],
        tenantId
    );
    return { id };
}

/**
 * 设为默认模板（同一单据类型仅一个默认启用模板）
 * 行业惯例：每类单据可建多个模板，仅"默认"模板参与自动打印
 */
export async function setDefaultPrintTemplate(id: number, tenantId: string): Promise<{ id: number }> {
    const existing = await getPrintTemplate(id, tenantId);
    // 同单据类型全部清除默认标记
    await queryWithTenant<ResultSetHeader>(
        `UPDATE t_print_template SET is_default = 0 WHERE bill_type = ? AND tenant_id = ?`,
        [existing.bill_type, tenantId],
        tenantId
    );
    // 当前模板设为默认并确保启用
    await queryWithTenant<ResultSetHeader>(
        `UPDATE t_print_template SET is_default = 1, status = 1 WHERE id = ? AND tenant_id = ?`,
        [id, tenantId],
        tenantId
    );
    return { id };
}
