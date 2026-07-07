import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryWithTenant } = vi.hoisted(() => ({
  mockQueryWithTenant: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  queryWithTenant: mockQueryWithTenant,
  queryOneWithTenant: vi.fn(),
}));

import {
  getFieldMappings,
  getSyncGraph,
  detectChangedFields,
  getSyncTargets,
  syncChangedFields,
  syncSingleField,
  SYNC_MAPPINGS,
} from "../../shared/field-sync.js";

describe("field-sync", () => {
  describe("SYNC_MAPPINGS", () => {
    it("应包含多条映射规则", () => {
      expect(SYNC_MAPPINGS.length).toBeGreaterThan(10);
    });

    it("每条映射都包含必填字段", () => {
      for (const m of SYNC_MAPPINGS) {
        expect(m.sourceTable).toBeTruthy();
        expect(m.sourceField).toBeTruthy();
        expect(m.targetTable).toBeTruthy();
        expect(m.targetField).toBeTruthy();
        expect(m.joinKey).toBeTruthy();
        expect(m.description).toBeTruthy();
      }
    });
  });

  describe("getFieldMappings", () => {
    it("按表名筛选返回对应映射", () => {
      const result = getFieldMappings("product_spu");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(m => m.sourceTable === "product_spu")).toBe(true);
    });

    it("按表名+字段名筛选", () => {
      const result = getFieldMappings("product_spu", "product_name");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(m => m.sourceField === "product_name")).toBe(true);
    });

    it("不存在的表名返回空数组", () => {
      expect(getFieldMappings("nonexistent")).toEqual([]);
    });

    it("不存在的字段名返回空数组", () => {
      expect(getFieldMappings("product_spu", "nonexistent_field")).toEqual([]);
    });

    it("不传 sourceField 返回该表所有映射", () => {
      const result = getFieldMappings("supplier");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getSyncGraph", () => {
    it("返回按 sourceTable.sourceField 分组的对象", () => {
      const graph = getSyncGraph();
      expect(Object.keys(graph).length).toBeGreaterThan(0);
      const key = "product_spu.product_name";
      expect(graph[key]).toBeDefined();
      expect(Array.isArray(graph[key])).toBe(true);
    });

    it("每个 key 对应一个数组", () => {
      const graph = getSyncGraph();
      for (const [key, mappings] of Object.entries(graph)) {
        expect(Array.isArray(mappings)).toBe(true);
        expect(mappings.length).toBeGreaterThan(0);
      }
    });
  });

  describe("detectChangedFields", () => {
    it("检测字段变更", () => {
      const updates = { name: "新名称", age: 20 };
      const existing = { name: "旧名称", age: 20, extra: "keep" };
      const changed = detectChangedFields(updates, existing);
      expect(changed).toContain("name");
      expect(changed).not.toContain("age");
    });

    it("无变更返回空数组", () => {
      const updates = { name: "相同" };
      const existing = { name: "相同" };
      expect(detectChangedFields(updates, existing)).toEqual([]);
    });

    it("undefined 字段不计入变更", () => {
      const updates = { name: undefined, age: 25 };
      const existing = { name: "旧名", age: 20 };
      const changed = detectChangedFields(updates, existing);
      expect(changed).not.toContain("name");
      expect(changed).toContain("age");
    });

    it("新增字段视为变更", () => {
      const updates = { newField: "value" };
      const existing = { name: "test" };
      expect(detectChangedFields(updates, existing)).toContain("newField");
    });

    it("空 updates 返回空数组", () => {
      expect(detectChangedFields({}, { name: "test" })).toEqual([]);
    });
  });

  describe("getSyncTargets", () => {
    it("返回变更字段的同步目标", () => {
      const targets = getSyncTargets("product_spu", ["product_name"]);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets[0].targetTable).toBeTruthy();
      expect(targets[0].targetField).toBeTruthy();
      expect(targets[0].description).toBeTruthy();
    });

    it("无映射的字段返回空数组", () => {
      const targets = getSyncTargets("product_spu", ["nonexistent_field"]);
      expect(targets).toEqual([]);
    });

    it("多个字段返回多个目标", () => {
      const targets = getSyncTargets("product_spu", ["product_name", "brand"]);
      expect(targets.length).toBeGreaterThan(1);
    });
  });

  describe("syncChangedFields", () => {
    beforeEach(() => {
      mockQueryWithTenant.mockReset();
    });

    it("变更字段有映射时执行同步", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 3 });

      const results = await syncChangedFields("product_spu", 1, ["product_name"], "default");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.success)).toBe(true);
    });

    it("无映射的字段返回空数组", async () => {
      const results = await syncChangedFields("nonexistent", 1, ["unknown"], "default");
      expect(results).toEqual([]);
    });

    it("DB 错误时返回 success=false", async () => {
      mockQueryWithTenant.mockRejectedValue(new Error("DB Error"));

      const results = await syncChangedFields("product_spu", 1, ["product_name"], "default");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => !r.success)).toBe(true);
    });

    it("多个变更字段同步多个目标", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const results = await syncChangedFields("product_spu", 1, ["product_name", "category_id"], "default");

      expect(results.length).toBeGreaterThan(1);
    });

    it("同表同字段映射应跳过同步（line 323）", async () => {
      const sameTableMapping = {
        sourceTable: "product_spu",
        sourceField: "product_name",
        targetTable: "product_spu",
        targetField: "product_name",
        joinKey: "id",
        description: "同表同字段测试"
      };

      const originalMappings = [...SYNC_MAPPINGS];
      SYNC_MAPPINGS.push(sameTableMapping as any);

      try {
        const results = await syncChangedFields("product_spu", 1, ["product_name"], "default");

        const sameTableResults = results.filter(
          r => r.targetTable === "product_spu" && r.targetField === "product_name"
        );
        expect(sameTableResults).toEqual([]);
      } finally {
        SYNC_MAPPINGS.length = 0;
        SYNC_MAPPINGS.push(...originalMappings);
      }
    });

    it("mapping.condition 存在时 SQL 中应包含 AND 条件", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      await syncChangedFields("supplier", 1, ["supplier_name"], "default");

      expect(mockQueryWithTenant).toHaveBeenCalled();
      const sql = mockQueryWithTenant.mock.calls[0][0] as string;
      expect(sql).toContain("AND");
      expect(sql).toContain("status IN");
    });
  });

  describe("syncSingleField", () => {
    beforeEach(() => {
      mockQueryWithTenant.mockReset();
    });

    it("应只同步指定单个字段", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      const results = await syncSingleField("product_spu", "brand", 1, "default");

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
