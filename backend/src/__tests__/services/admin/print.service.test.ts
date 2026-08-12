/**
 * 打印记录 service 单元测试
 * 被测文件：src/services/admin/print.service.ts
 *
 * 覆盖范围：
 *  - createPrintRecord：CRUD + 参数校验（billType/status/billNo/copies 边界）
 *  - listPrintRecords：筛选 + 分页 + total 为 null 兜底
 *  - getPrintRecordDetail：存在/不存在
 *  - reprintRecord：原记录存在/不存在 + 重打关联 original_id
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    queryWithTenant: vi.fn(),
    queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
    queryWithTenant: mocks.queryWithTenant,
    queryOneWithTenant: mocks.queryOneWithTenant,
    query: vi.fn(),
    queryOne: vi.fn(),
    transaction: vi.fn(),
}));

import {
    createPrintRecord,
    listPrintRecords,
    getPrintRecordDetail,
    reprintRecord,
    BILL_TYPE_VALUES,
    STATUS_VALUES,
    ensureDefaultPrintTemplates,
    listPrintTemplates,
    getPrintTemplate,
    createPrintTemplate,
    updatePrintTemplate,
    deletePrintTemplate,
    resetPrintTemplate,
} from "../../../services/admin/print.service";

beforeEach(() => {
    vi.clearAllMocks();
});

// ============ 常量校验 ============
describe("print.service - 常量", () => {
    it("BILL_TYPE_VALUES 包含 9 种类型（含打印模板新增单据）", () => {
        expect(BILL_TYPE_VALUES).toEqual([
            "SALE_BILL",
            "SALE_RETURN",
            "SHIFT",
            "DAILY_SETTLE",
            "SALE_RECEIPT",
            "PURCHASE_ORDER",
            "REPORT",
            "LABEL",
            "REPRINT",
        ]);
    });

    it("STATUS_VALUES 包含 3 种状态", () => {
        expect(STATUS_VALUES).toEqual(["SUCCESS", "FAILED", "PENDING"]);
    });
});

// ============ createPrintRecord ============
describe("print.service - createPrintRecord", () => {
    it("成功创建（默认 status=SUCCESS + copies=1）", async () => {
        mocks.queryWithTenant.mockResolvedValue({ insertId: 100 });
        const res = await createPrintRecord(
            {
                billType: "SALE_BILL",
                billNo: "XS202607200001",
            },
            "tenant-001"
        );
        expect(res).toEqual({ id: 100 });
        // 验证调用了 INSERT 并传入了正确的默认值
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        expect(callArgs[0]).toContain("INSERT INTO t_print_record");
        expect(callArgs[1]).toEqual([
            null, // storeId
            "SALE_BILL",
            "XS202607200001",
            null, // printerMac
            null, // printContent
            1, // copies
            null, // operatorId
            "SUCCESS", // status
            null, // errorMsg
            null, // originalId
        ]);
        expect(callArgs[2]).toBe("tenant-001");
    });

    it("成功创建 + 全字段填充 + status=FAILED + errorMsg", async () => {
        mocks.queryWithTenant.mockResolvedValue({ insertId: 200 });
        const res = await createPrintRecord(
            {
                storeId: 5,
                billType: "SALE_RETURN",
                billNo: "TH202607200001",
                printerMac: "AA:BB:CC:DD:EE:FF",
                printContent: '{"lines":[]}',
                copies: 3,
                operatorId: 99,
                status: "FAILED",
                errorMsg: "打印机离线",
                originalId: 50,
            },
            "tenant-002"
        );
        expect(res).toEqual({ id: 200 });
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        expect(callArgs[1]).toEqual([
            5,
            "SALE_RETURN",
            "TH202607200001",
            "AA:BB:CC:DD:EE:FF",
            '{"lines":[]}',
            3,
            99,
            "FAILED",
            "打印机离线",
            50,
        ]);
    });

    it("成功创建 + status=PENDING", async () => {
        mocks.queryWithTenant.mockResolvedValue({ insertId: 300 });
        const res = await createPrintRecord(
            {
                billType: "SHIFT",
                billNo: "SHIFT20260720001",
                status: "PENDING",
            },
            "t1"
        );
        expect(res).toEqual({ id: 300 });
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        // 第 8 个参数（index 7）是 status
        expect(callArgs[1][7]).toBe("PENDING");
    });

    it("成功创建 + insertId 为 undefined 时返回 0", async () => {
        // 覆盖 ?? 0 兜底分支
        mocks.queryWithTenant.mockResolvedValue({});
        const res = await createPrintRecord(
            {
                billType: "DAILY_SETTLE",
                billNo: "DAY20260720001",
            },
            "t1"
        );
        expect(res).toEqual({ id: 0 });
    });

    it("非法 billType → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "INVALID_TYPE" as any,
                    billNo: "X1",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "非法的单据类型：INVALID_TYPE",
            statusCode: 400,
        });
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("非法 status → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "SALE_BILL",
                    billNo: "X1",
                    status: "WRONG" as any,
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "非法的打印状态：WRONG",
            statusCode: 400,
        });
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("空 billNo → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "SALE_BILL",
                    billNo: "   ",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "单据编号不能为空",
            statusCode: 400,
        });
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("billNo 为空字符串 → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "SALE_BILL",
                    billNo: "",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "单据编号不能为空",
            statusCode: 400,
        });
    });

    it("copies < 1 → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "SALE_BILL",
                    billNo: "X1",
                    copies: 0,
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "打印份数必须在 1-99 之间",
            statusCode: 400,
        });
    });

    it("copies > 99 → 抛 400", async () => {
        await expect(
            createPrintRecord(
                {
                    billType: "SALE_BILL",
                    billNo: "X1",
                    copies: 100,
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "打印份数必须在 1-99 之间",
            statusCode: 400,
        });
    });
});

// ============ listPrintRecords ============
describe("print.service - listPrintRecords", () => {
    it("无筛选条件 + totalRow 有值", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            { id: 1, bill_no: "X1" },
            { id: 2, bill_no: "X2" },
        ]);
        mocks.queryOneWithTenant.mockResolvedValue({ total: 2 });
        const res = await listPrintRecords(
            {},
            { page: 1, pageSize: 20 },
            "t1"
        );
        expect(res).toEqual({
            total: 2,
            page: 1,
            pageSize: 20,
            records: [
                { id: 1, bill_no: "X1" },
                { id: 2, bill_no: "X2" },
            ],
        });
        // 验证 SQL 中没有 WHERE 子句
        const listSql = mocks.queryWithTenant.mock.calls[0][0] as string;
        expect(listSql).not.toContain("WHERE");
    });

    it("全部筛选条件 + totalRow 为 null（?? 右分支）", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        mocks.queryOneWithTenant.mockResolvedValue(null);
        const res = await listPrintRecords(
            {
                billType: "SALE_BILL",
                billNo: "XS001",
                storeId: 1,
                status: "SUCCESS",
                operatorId: 9,
                startDate: "2026-07-01 00:00:00",
                endDate: "2026-07-31 23:59:59",
            },
            { page: 2, pageSize: 10 },
            "t1"
        );
        expect(res).toEqual({
            total: 0,
            page: 2,
            pageSize: 10,
            records: [],
        });
        // 验证 WHERE 子句包含所有条件
        const listSql = mocks.queryWithTenant.mock.calls[0][0] as string;
        expect(listSql).toContain("bill_type = ?");
        expect(listSql).toContain("bill_no = ?");
        expect(listSql).toContain("store_id = ?");
        expect(listSql).toContain("status = ?");
        expect(listSql).toContain("operator_id = ?");
        expect(listSql).toContain("created_at >= ?");
        expect(listSql).toContain("created_at <= ?");
        // 验证分页偏移量 (page=2, pageSize=10 → offset=10)
        expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([
            "SALE_BILL",
            "XS001",
            1,
            "SUCCESS",
            9,
            "2026-07-01 00:00:00",
            "2026-07-31 23:59:59",
            10, // pageSize
            10, // offset
        ]);
    });

    it("部分筛选条件（仅 billType）", async () => {
        mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
        mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
        const res = await listPrintRecords(
            { billType: "REPRINT" },
            { page: 1, pageSize: 50 },
            "t1"
        );
        expect(res.total).toBe(1);
        const listSql = mocks.queryWithTenant.mock.calls[0][0] as string;
        expect(listSql).toContain("bill_type = ?");
        expect(listSql).not.toContain("bill_no = ?");
        // 验证 count SQL 也使用相同 WHERE
        const countSql = mocks.queryOneWithTenant.mock.calls[0][0] as string;
        expect(countSql).toContain("COUNT(*)");
        expect(countSql).toContain("bill_type = ?");
    });
});

// ============ getPrintRecordDetail ============
describe("print.service - getPrintRecordDetail", () => {
    it("记录存在", async () => {
        const row = {
            id: 1,
            tenant_id: "t1",
            store_id: 5,
            bill_type: "SALE_BILL",
            bill_no: "XS001",
            printer_mac: "AA:BB",
            print_content: "{}",
            copies: 2,
            operator_id: 9,
            status: "SUCCESS",
            error_msg: null,
            original_id: null,
            created_at: "2026-07-20 10:00:00",
            updated_at: "2026-07-20 10:00:00",
        };
        mocks.queryOneWithTenant.mockResolvedValue(row);
        const res = await getPrintRecordDetail(1, "t1");
        expect(res).toEqual(row);
        // 验证 SQL 带 WHERE id = ?
        const sql = mocks.queryOneWithTenant.mock.calls[0][0] as string;
        expect(sql).toContain("WHERE id = ?");
        expect(mocks.queryOneWithTenant.mock.calls[0][1]).toEqual([1]);
        expect(mocks.queryOneWithTenant.mock.calls[0][2]).toBe("t1");
    });

    it("记录不存在 → 抛 404", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        await expect(getPrintRecordDetail(999, "t1")).rejects.toMatchObject({
            message: "打印记录不存在",
            statusCode: 404,
        });
    });
});

// ============ reprintRecord ============
describe("print.service - reprintRecord", () => {
    it("原记录存在 + 重打成功（original_id 关联 + bill_type=REPRINT + status=PENDING）", async () => {
        const original = {
            id: 50,
            tenant_id: "t1",
            store_id: 5,
            bill_type: "SALE_BILL",
            bill_no: "XS001",
            printer_mac: "AA:BB",
            print_content: '{"lines":[]}',
            copies: 1,
            operator_id: 9,
            status: "SUCCESS",
            error_msg: null,
            original_id: null,
            created_at: "2026-07-20 10:00:00",
            updated_at: "2026-07-20 10:00:00",
        };
        mocks.queryOneWithTenant.mockResolvedValue(original);
        mocks.queryWithTenant.mockResolvedValue({ insertId: 51 });
        const res = await reprintRecord(50, 100, "t1");
        expect(res).toEqual({ id: 51, originalId: 50 });
        // 验证 INSERT 时复制了原记录的关键字段
        const insertCall = mocks.queryWithTenant.mock.calls[0];
        expect(insertCall[0]).toContain("INSERT INTO t_print_record");
        expect(insertCall[1]).toEqual([
            5, // store_id
            "REPRINT", // bill_type 改为 REPRINT
            "XS001", // bill_no 保留
            "AA:BB", // printer_mac 保留
            '{"lines":[]}', // print_content 保留
            1, // copies 保留
            100, // operator_id = 重打发起人
            "PENDING", // status = PENDING（等待打印结果回传）
            null, // error_msg = null
            50, // original_id 指向原记录
        ]);
        expect(insertCall[2]).toBe("t1");
    });

    it("原记录不存在 → 抛 404", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        await expect(reprintRecord(999, 100, "t1")).rejects.toMatchObject({
            message: "原打印记录不存在",
            statusCode: 404,
        });
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("原记录存在 + insertId 为 undefined（?? 0 兜底）", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({
            id: 60,
            store_id: null,
            bill_no: "X2",
            printer_mac: null,
            print_content: null,
            copies: 2,
        });
        mocks.queryWithTenant.mockResolvedValue({});
        const res = await reprintRecord(60, 100, "t1");
        expect(res).toEqual({ id: 0, originalId: 60 });
    });
});

// ============ 打印模板管理 ============
describe("print.service - 打印模板管理", () => {
    const row = {
        id: 1,
        tenant_id: "t1",
        store_id: null,
        bill_type: "SALE_RECEIPT",
        paper_type: "RECEIPT_80",
        template_name: "收银小票（默认）",
        content: "<h1>{{headerName}}</h1>",
        is_default: 1,
        version: 1,
        status: 1,
        updated_by: null,
        created_at: "2026-08-12 12:00:00",
        updated_at: "2026-08-12 12:00:00",
    };

    it("ensureDefaultPrintTemplates：无模板时为首个单据类型写入默认", async () => {
        mocks.queryWithTenant.mockResolvedValueOnce([]); // 查询现有
        mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 1 }); // INSERT
        await ensureDefaultPrintTemplates("t1");
        // 1 次查询 + 8 个单据类型各 1 次 INSERT
        expect(mocks.queryWithTenant).toHaveBeenCalledTimes(9);
    });

    it("ensureDefaultPrintTemplates：已有模板时不重复写入", async () => {
        mocks.queryWithTenant.mockResolvedValue([{ bill_type: "SALE_RECEIPT" }]);
        await ensureDefaultPrintTemplates("t1");
        // 1 次查询 + 其余 7 个单据类型 INSERT
        expect(mocks.queryWithTenant).toHaveBeenCalledTimes(8);
    });

    it("listPrintTemplates：显式带 tenant_id 条件，避免注入器跳过导致跨租户", async () => {
        mocks.queryWithTenant.mockResolvedValue([row]);
        const res = await listPrintTemplates({ billType: "SALE_RECEIPT" }, "t1");
        expect(res).toHaveLength(1);
        const [sql, params] = mocks.queryWithTenant.mock.calls[0];
        expect(sql).toContain("tenant_id = ?");
        expect(params[0]).toBe("t1");
    });

    it("getPrintTemplate：不存在时抛 404", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        await expect(getPrintTemplate(99, "t1")).rejects.toMatchObject({
            message: "打印模板不存在",
            statusCode: 404,
        });
    });

    it("createPrintTemplate：非法单据类型抛 400", async () => {
        await expect(
            createPrintTemplate(
                { billType: "UNKNOWN", paperType: "A4" },
                null,
                "t1"
            )
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("createPrintTemplate：合法入参插入并返回 id", async () => {
        mocks.queryWithTenant.mockResolvedValue({ insertId: 42 });
        const res = await createPrintTemplate(
            { billType: "SALE_BILL", paperType: "A4", templateName: "我的销售单" },
            7,
            "t1"
        );
        expect(res).toEqual({ id: 42 });
    });

    it("updatePrintTemplate：更新版本号自增", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(row);
        mocks.queryWithTenant.mockResolvedValue({});
        const res = await updatePrintTemplate(
            1,
            { content: "<h2>新内容</h2>", paperType: "A4" },
            7,
            "t1"
        );
        expect(res).toEqual({ id: 1 });
        const [sql] = mocks.queryWithTenant.mock.calls[0];
        expect(sql).toContain("version = version + 1");
    });

    it("deletePrintTemplate：系统默认模板禁止删除", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(row);
        await expect(deletePrintTemplate(1, "t1")).rejects.toMatchObject({
            message: expect.stringContaining("系统默认模板不可删除"),
            statusCode: 400,
        });
    });

    it("resetPrintTemplate：恢复默认模板内容", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({ ...row, bill_type: "SALE_RECEIPT" });
        mocks.queryWithTenant.mockResolvedValue({});
        const res = await resetPrintTemplate(1, "t1");
        expect(res).toEqual({ id: 1 });
        const [sql, params] = mocks.queryWithTenant.mock.calls[0];
        expect(sql).toContain("SET paper_type = ?");
        expect(params[0]).toBe("RECEIPT_80");
    });
});
