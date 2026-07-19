/**
 * delta-sync.service 单元测试
 * 被测文件：src/services/sync/delta-sync.service.ts
 *
 * 覆盖：
 *  - getProductDelta：空/UPSERT/STATUS_CHANGE/DELETE/分页/租户隔离
 *  - getInventoryDelta：空/有变更/租户隔离
 *  - getMemberDelta：空/有变更/STATUS_CHANGE/租户隔离
 *  - submitOfflineOrders：全部成功/部分失败/重复 draftNo/事务回滚/参数校验
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== Mock 依赖 ====================
const mocks = vi.hoisted(() => ({
    queryWithTenant: vi.fn(),
    queryOneWithTenant: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
    query: vi.fn(),
    queryOne: vi.fn(),
    queryWithTenant: mocks.queryWithTenant,
    queryOneWithTenant: mocks.queryOneWithTenant,
    transaction: mocks.transaction,
}));

vi.mock("../../../shared/logger", () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    getProductDelta,
    getInventoryDelta,
    getMemberDelta,
    submitOfflineOrders,
} from "../../../services/sync/delta-sync.service";
import { AppError } from "../../../shared/app-error";

// ==================== 公共 fixture ====================
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

/** 构造一行商品联合查询结果 */
function buildProductRow(overrides: Record<string, any> = {}) {
    return {
        skuId: 1,
        spuId: 10,
        skuCode: "SKU-001",
        barcode: "6900000000001",
        skuName: "示例白酒 500ml",
        volume: "500ml",
        packaging: "瓶装",
        baseUnit: "瓶",
        boxUnit: "箱",
        boxRatio: 6,
        temperature: "NORMAL",
        traceEnabled: 0,
        skuStatus: 1,
        warningThreshold: 10,
        skuUpdatedAt: "2026-07-19T10:00:00Z",
        spuName: "示例白酒",
        categoryId: 1,
        mainImage: "https://example.com/p.png",
        spuStatus: "ON_SALE",
        categoryName: "白酒",
        brandName: "示例品牌",
        retailPrice: 129,
        wholesalePrice: 99,
        costPrice: 60,
        miniappPrice: 119,
        storePrice: 125,
        priceUpdatedAt: "2026-07-19T10:00:00Z",
        availableQty: 100,
        invUpdatedAt: "2026-07-19T10:00:00Z",
        deletedAt: null,
        updatedAt: "2026-07-19T10:00:00Z",
        ...overrides,
    };
}

function buildInventoryRow(overrides: Record<string, any> = {}) {
    return {
        storeId: 1,
        skuId: 1,
        stockType: "OFFLINE",
        physicalQty: 100,
        lockedQty: 0,
        availableQty: 100,
        updatedAt: "2026-07-19T10:00:00Z",
        skuName: "示例白酒 500ml",
        ...overrides,
    };
}

function buildMemberRow(overrides: Record<string, any> = {}) {
    return {
        memberId: 1,
        name: "张三",
        mobile: "13900000000",
        customerType: "RETAIL",
        settlementType: "CASH",
        points: 100,
        levelCode: "VIP1",
        status: 1,
        updatedAt: "2026-07-19T10:00:00Z",
        ...overrides,
    };
}

function buildOrderItem(overrides: Record<string, any> = {}) {
    return {
        skuId: 1,
        skuName: "示例白酒",
        boxQty: 1,
        bottleQty: 6,
        totalBottleQty: 6,
        unitPrice: 129,
        priceType: "RETAIL",
        subtotalAmount: 774,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ==================== getProductDelta ====================
describe("delta-sync.service - getProductDelta", () => {
    it("无变更时返回空 changes 列表", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A, 1, 100);
        expect(res.changes).toEqual([]);
        expect(res.hasMore).toBe(false);
        expect(res.since).toBe("2026-07-19T00:00:00Z");
        expect(res.until).toBe("2026-07-19T00:00:00Z");
        expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
        // 验证租户隔离 — queryWithTenant 第三个参数必须是 tenantId
        expect(mocks.queryWithTenant.mock.calls[0][2]).toBe(TENANT_A);
    });

    it("有 UPSERT 变更时返回完整 ProductDeltaData", async () => {
        mocks.queryWithTenant.mockResolvedValue([buildProductRow()]);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes).toHaveLength(1);
        expect(res.changes[0].action).toBe("UPSERT");
        expect(res.changes[0].skuId).toBe(1);
        expect(res.changes[0].spuId).toBe(10);
        expect(res.changes[0].data).toBeDefined();
        expect(res.changes[0].data?.skuCode).toBe("SKU-001");
        expect(res.changes[0].data?.retailPrice).toBe(129);
        expect(res.changes[0].data?.availableQty).toBe(100);
        expect(res.changes[0].data?.updatedAt).toBe("2026-07-19T10:00:00Z");
        expect(res.until).toBe("2026-07-19T10:00:00Z");
        expect(res.hasMore).toBe(false);
    });

    it("skuStatus = 0 时返回 STATUS_CHANGE 动作", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            buildProductRow({ skuStatus: 0, spuStatus: "ON_SALE" }),
        ]);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes[0].action).toBe("STATUS_CHANGE");
        expect(res.changes[0].data).toBeDefined();
        expect(res.changes[0].data?.status).toBe(0);
    });

    it("spuStatus = OFF_SALE 时返回 STATUS_CHANGE 动作", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            buildProductRow({ skuStatus: 1, spuStatus: "OFF_SALE" }),
        ]);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes[0].action).toBe("STATUS_CHANGE");
    });

    it("deletedAt 非空时返回 DELETE 动作且不返回 data", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            buildProductRow({ deletedAt: "2026-07-19T11:00:00Z" }),
        ]);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes[0].action).toBe("DELETE");
        expect(res.changes[0].data).toBeUndefined();
        expect(res.changes[0].skuId).toBe(1);
    });

    it("返回数据量等于 pageSize 时 hasMore=true", async () => {
        // 构造 100 条数据（pageSize=100）
        const rows = Array.from({ length: 100 }, (_, i) =>
            buildProductRow({ skuId: i + 1, updatedAt: "2026-07-19T10:00:00Z" })
        );
        mocks.queryWithTenant.mockResolvedValue(rows);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A, 1, 100);
        expect(res.changes).toHaveLength(100);
        expect(res.hasMore).toBe(true);
    });

    it("返回数据量小于 pageSize 时 hasMore=false", async () => {
        const rows = Array.from({ length: 50 }, (_, i) =>
            buildProductRow({ skuId: i + 1, updatedAt: "2026-07-19T10:00:00Z" })
        );
        mocks.queryWithTenant.mockResolvedValue(rows);
        const res = await getProductDelta("2026-07-19T00:00:00Z", TENANT_A, 1, 100);
        expect(res.changes).toHaveLength(50);
        expect(res.hasMore).toBe(false);
    });

    it("租户隔离 — tenantId 透传给 queryWithTenant", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        await getProductDelta("2026-07-19T00:00:00Z", TENANT_B, 2, 50);
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        expect(callArgs[2]).toBe(TENANT_B);
        // 验证参数中第一个 ? 是 tenantId
        expect(callArgs[1][0]).toBe(TENANT_B);
        // 验证分页参数（limit 和 offset）
        // safePage=2, safePageSize=50, offset=(2-1)*50=50
        expect(callArgs[1]).toContain(50); // limit
        expect(callArgs[1]).toContain(50); // offset
    });

    it("since 为空字符串时使用默认 1970-01-01", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        const res = await getProductDelta("", TENANT_A);
        expect(res.since).toBe("1970-01-01T00:00:00Z");
        // 验证 SQL 参数中 since 是默认值
        expect(mocks.queryWithTenant.mock.calls[0][1][1]).toBe("1970-01-01T00:00:00Z");
    });

    it("page 小于 1 时按 1 处理", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        await getProductDelta("", TENANT_A, 0, 100);
        const params = mocks.queryWithTenant.mock.calls[0][1];
        // offset = (1-1)*100 = 0
        expect(params[params.length - 1]).toBe(0);
        expect(params[params.length - 2]).toBe(100);
    });

    it("pageSize 超过 500 时按 500 截断", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        await getProductDelta("", TENANT_A, 1, 1000);
        const params = mocks.queryWithTenant.mock.calls[0][1];
        expect(params[params.length - 2]).toBe(500);
    });

    it("null/undefined 字段被正确兜底", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            buildProductRow({
                barcode: null,
                volume: null,
                packaging: null,
                wholesalePrice: null,
                miniappPrice: null,
                storePrice: null,
                categoryName: null,
                brandName: null,
            }),
        ]);
        const res = await getProductDelta("", TENANT_A);
        expect(res.changes[0].data?.barcode).toBeNull();
        expect(res.changes[0].data?.wholesalePrice).toBeNull();
        expect(res.changes[0].data?.categoryName).toBeNull();
    });
});

// ==================== getInventoryDelta ====================
describe("delta-sync.service - getInventoryDelta", () => {
    it("无变更时返回空 changes", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        const res = await getInventoryDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes).toEqual([]);
        expect(res.hasMore).toBe(false);
        expect(res.since).toBe("2026-07-19T00:00:00Z");
        expect(res.until).toBe("2026-07-19T00:00:00Z");
    });

    it("有变更时返回 InventoryDeltaData", async () => {
        mocks.queryWithTenant.mockResolvedValue([buildInventoryRow()]);
        const res = await getInventoryDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes).toHaveLength(1);
        expect(res.changes[0].action).toBe("UPSERT");
        expect(res.changes[0].data?.storeId).toBe(1);
        expect(res.changes[0].data?.skuId).toBe(1);
        expect(res.changes[0].data?.availableQty).toBe(100);
        expect(res.changes[0].data?.stockType).toBe("OFFLINE");
        expect(res.until).toBe("2026-07-19T10:00:00Z");
    });

    it("分页满页时 hasMore=true", async () => {
        const rows = Array.from({ length: 100 }, (_, i) =>
            buildInventoryRow({ skuId: i + 1, updatedAt: "2026-07-19T10:00:00Z" })
        );
        mocks.queryWithTenant.mockResolvedValue(rows);
        const res = await getInventoryDelta("", TENANT_A, 1, 100);
        expect(res.hasMore).toBe(true);
    });

    it("租户隔离 — tenantId 透传", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        await getInventoryDelta("2026-07-19T00:00:00Z", TENANT_B);
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        expect(callArgs[2]).toBe(TENANT_B);
        expect(callArgs[1][0]).toBe(TENANT_B);
    });

    it("since 为空时使用默认值", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        const res = await getInventoryDelta("", TENANT_A);
        expect(res.since).toBe("1970-01-01T00:00:00Z");
        expect(mocks.queryWithTenant.mock.calls[0][1][1]).toBe("1970-01-01T00:00:00Z");
    });
});

// ==================== getMemberDelta ====================
describe("delta-sync.service - getMemberDelta", () => {
    it("无变更时返回空 changes", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        const res = await getMemberDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes).toEqual([]);
        expect(res.hasMore).toBe(false);
        expect(res.since).toBe("2026-07-19T00:00:00Z");
        expect(res.until).toBe("2026-07-19T00:00:00Z");
    });

    it("有变更时返回 MemberDeltaData", async () => {
        mocks.queryWithTenant.mockResolvedValue([buildMemberRow()]);
        const res = await getMemberDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes).toHaveLength(1);
        expect(res.changes[0].action).toBe("UPSERT");
        expect(res.changes[0].data?.memberId).toBe(1);
        expect(res.changes[0].data?.name).toBe("张三");
        expect(res.changes[0].data?.mobile).toBe("13900000000");
        expect(res.changes[0].data?.customerType).toBe("RETAIL");
        expect(res.changes[0].data?.points).toBe(100);
    });

    it("status = 0 时返回 STATUS_CHANGE", async () => {
        mocks.queryWithTenant.mockResolvedValue([buildMemberRow({ status: 0 })]);
        const res = await getMemberDelta("2026-07-19T00:00:00Z", TENANT_A);
        expect(res.changes[0].action).toBe("STATUS_CHANGE");
        expect(res.changes[0].data?.status).toBe(0);
    });

    it("分页满页时 hasMore=true", async () => {
        const rows = Array.from({ length: 100 }, (_, i) =>
            buildMemberRow({ memberId: i + 1, updatedAt: "2026-07-19T10:00:00Z" })
        );
        mocks.queryWithTenant.mockResolvedValue(rows);
        const res = await getMemberDelta("", TENANT_A, 1, 100);
        expect(res.hasMore).toBe(true);
    });

    it("租户隔离 — tenantId 透传", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);
        await getMemberDelta("2026-07-19T00:00:00Z", TENANT_B);
        const callArgs = mocks.queryWithTenant.mock.calls[0];
        expect(callArgs[2]).toBe(TENANT_B);
        expect(callArgs[1][0]).toBe(TENANT_B);
    });
});

// ==================== submitOfflineOrders ====================
describe("delta-sync.service - submitOfflineOrders", () => {
    /** 模拟 transaction 调用，直接执行回调 */
    function mockTransactionResolve(value: any = "DRAFT-001") {
        mocks.transaction.mockImplementation(async (cb: any) => cb({
            query: vi.fn().mockResolvedValue([[{ id: 1, name: "张三", mobile: "13900000000", customer_type: "RETAIL" }], undefined]),
            execute: vi.fn().mockResolvedValue([{}]),
        }));
        return value;
    }

    it("全部成功 — 返回 successCount=2, failureCount=0", async () => {
        // queryOneWithTenant 用于查重，全部返回 null（未重复）
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mockTransactionResolve();

        const orders = [
            { draftNo: "DRAFT-001", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
            { draftNo: "DRAFT-002", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.totalCount).toBe(2);
        expect(res.successCount).toBe(2);
        expect(res.failureCount).toBe(0);
        expect(res.results).toHaveLength(2);
        expect(res.results[0].success).toBe(true);
        expect(res.results[0].billNo).toBe("DRAFT-001");
        expect(res.results[1].success).toBe(true);
        expect(res.results[1].billNo).toBe("DRAFT-002");
        // 验证事务被调用 2 次
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
    });

    it("部分失败 — 错误隔离，其他订单仍提交成功", async () => {
        // 第一条订单查重时返回已存在（触发 AppError 409），第二条正常
        mocks.queryOneWithTenant
            .mockResolvedValueOnce({ billNo: "DRAFT-001" })  // 第一条已存在
            .mockResolvedValueOnce(null);                      // 第二条不重复
        mockTransactionResolve();

        const orders = [
            { draftNo: "DRAFT-001", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
            { draftNo: "DRAFT-002", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.totalCount).toBe(2);
        expect(res.successCount).toBe(1);
        expect(res.failureCount).toBe(1);
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toContain("DRAFT-001");
        expect(res.results[0].errorMsg).toContain("已存在");
        expect(res.results[1].success).toBe(true);
        expect(res.results[1].billNo).toBe("DRAFT-002");
    });

    it("重复 draftNo — 返回失败 errorMsg", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({ billNo: "DRAFT-DUP" });
        const orders = [
            { draftNo: "DRAFT-DUP", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toContain("DRAFT-DUP");
        expect(res.results[0].errorMsg).toContain("禁止重复提交");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("事务回滚 — 单条订单部分失败不影响其他订单", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        // 第一条订单事务抛错（模拟库存不足等业务异常），第二条正常
        mocks.transaction
            .mockRejectedValueOnce(new Error("库存不足"))
            .mockImplementationOnce(async (cb: any) => cb({
                query: vi.fn().mockResolvedValue([[], undefined]),
                execute: vi.fn().mockResolvedValue([{}]),
            }));

        const orders = [
            { draftNo: "DRAFT-FAIL", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
            { draftNo: "DRAFT-OK", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.totalCount).toBe(2);
        expect(res.successCount).toBe(1);
        expect(res.failureCount).toBe(1);
        expect(res.results[0].draftNo).toBe("DRAFT-FAIL");
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toBe("库存不足");
        expect(res.results[1].draftNo).toBe("DRAFT-OK");
        expect(res.results[1].success).toBe(true);
    });

    it("draftNo 为空 — 返回失败 errorMsg", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mockTransactionResolve();
        const orders = [
            { draftNo: "", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toContain("draftNo");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("items 为空 — 返回失败 errorMsg", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mockTransactionResolve();
        const orders = [
            { draftNo: "DRAFT-NO-ITEMS", items: [], totalAmount: 0, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toContain("明细");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("传入 customerId — 事务内查询 member 并填充客户快照", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        const mockConn = {
            query: vi.fn().mockResolvedValue([[{ id: 5, name: "李四", mobile: "13800000001", customer_type: "WHOLESALE" }], undefined]),
            execute: vi.fn().mockResolvedValue([{}]),
        };
        mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));

        const orders = [
            {
                draftNo: "DRAFT-MEMBER",
                customerId: 5,
                items: [buildOrderItem()],
                totalAmount: 774,
                createdAt: "2026-07-19T10:00:00Z",
            },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(true);
        expect(res.results[0].billNo).toBe("DRAFT-MEMBER");
        // 验证事务内调用了 member 查询
        expect(mockConn.query).toHaveBeenCalled();
        // 验证 INSERT 调用次数 = 1 主表 + N 明细
        expect(mockConn.execute).toHaveBeenCalledTimes(1 + orders[0].items.length);
        // 验证 INSERT sale_bill 时第 4 个参数是 customerName
        const insertCall = mockConn.execute.mock.calls[0];
        expect(insertCall[1]).toContain("DRAFT-MEMBER");
        expect(insertCall[1]).toContain("李四");
        expect(insertCall[1]).toContain("13800000001");
        expect(insertCall[1]).toContain("WHOLESALE");
    });

    it("传入不存在的 customerId — customerType 默认 RETAIL", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        const mockConn = {
            query: vi.fn().mockResolvedValue([[], undefined]),  // member 未找到
            execute: vi.fn().mockResolvedValue([{}]),
        };
        mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));

        const orders = [
            {
                draftNo: "DRAFT-NO-MEMBER",
                customerId: 999,
                customerName: "匿名",
                items: [buildOrderItem()],
                totalAmount: 774,
                createdAt: "2026-07-19T10:00:00Z",
            },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(true);
        const insertCall = mockConn.execute.mock.calls[0];
        // customerName 应使用 order.customerName = "匿名"
        expect(insertCall[1]).toContain("匿名");
        // customerType 应是默认值 "RETAIL"
        expect(insertCall[1]).toContain("RETAIL");
    });

    it("AppError 错误对象被正确捕获并提取 message", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({ billNo: "DRAFT-APP" });
        const orders = [
            { draftNo: "DRAFT-APP", items: [buildOrderItem()], totalAmount: 774, createdAt: "2026-07-19T10:00:00Z" },
        ];
        const res = await submitOfflineOrders(orders, TENANT_A, 1);
        expect(res.results[0].success).toBe(false);
        expect(res.results[0].errorMsg).toContain("DRAFT-APP");
    });

    it("空订单列表 — 返回 totalCount=0", async () => {
        const res = await submitOfflineOrders([], TENANT_A, 1);
        expect(res.totalCount).toBe(0);
        expect(res.successCount).toBe(0);
        expect(res.failureCount).toBe(0);
        expect(res.results).toEqual([]);
        expect(mocks.queryOneWithTenant).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

// ==================== AppError 集成测试 ====================
describe("delta-sync.service - AppError 集成", () => {
    it("AppError 实例化带 statusCode", () => {
        const err = new AppError("测试错误", 409);
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe("测试错误");
        expect(err.name).toBe("AppError");
    });
});
