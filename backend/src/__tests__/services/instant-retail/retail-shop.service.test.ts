/**
 * 即时零售门店 service 单元测试（R92-01 契约对齐）
 * 被测文件：src/services/instant-retail/retail-shop.service.ts
 * 覆盖：camelCase→snake_case 映射（banners/分类/shop-config）+ 默认门店回退
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  getShopConfig,
  saveShopConfig,
  createCategory,
  updateCategory,
  createBanner,
  updateBanner,
} from "../../../services/instant-retail/retail-shop.service";

describe("instant-retail/retail-shop.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("getShopConfig - 默认门店回退", () => {
    it("带 storeId 时直接查询，不查默认门店", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, shop_name: "测试店" });
      const res = await getShopConfig(1, "t1");
      expect(res).toEqual({ id: 1, shop_name: "测试店" });
      expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(1);
      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("t_retail_shop_config"),
        [1, "t1"],
        "t1"
      );
    });

    it("不带 storeId 时回退租户首个门店", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 3 }) // t_store 首个门店
        .mockResolvedValueOnce({ id: 3, shop_name: "默认店" });
      const res = await getShopConfig(undefined, "t1");
      expect(res).toEqual({ id: 3, shop_name: "默认店" });
      expect(mocks.queryOneWithTenant).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("t_store"),
        ["t1"],
        "t1"
      );
      expect(mocks.queryOneWithTenant).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("t_retail_shop_config"),
        [3, "t1"],
        "t1"
      );
    });

    it("不带 storeId 且租户无门店时返回 null", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      const res = await getShopConfig(undefined, "t1");
      expect(res).toBeNull();
      expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe("saveShopConfig - camelCase 映射 + 默认门店回退", () => {
    it("不带 storeId 时回退默认门店并 INSERT 映射后的 snake_case 字段", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 2 }) // t_store 默认门店
        .mockResolvedValueOnce(undefined); // 无既有配置
      mocks.queryWithTenant.mockResolvedValue({ insertId: 9 });

      const res = await saveShopConfig(undefined, {
        shopName: "智享旗舰店",
        shopLogo: "https://example.com/logo.png",
        description: "主营酒水",
        phone: "13800138000",
        businessHours: "09:00~22:00",
        deliveryEnabled: true,
        pickupEnabled: false,
        minOrderAmount: 10,
        deliveryFee: 3,
        deliveryRange: 5,
        estimatedTime: "30分钟",
        announcement: "满减活动进行中",
        status: "OPEN",
      }, "t1");

      expect(res.id).toBe(9);
      expect(mocks.queryOneWithTenant).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("t_store"),
        ["t1"],
        "t1"
      );
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO t_retail_shop_config"),
        [
          2, "智享旗舰店", "https://example.com/logo.png", "主营酒水", "13800138000",
          "09:00~22:00", 1, 0, 10, 3, 5, "30分钟", "满减活动进行中", "OPEN", "t1",
        ],
        "t1"
      );
    });

    it("带 storeId 且配置已存在时 UPDATE 映射后的字段", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 5 });
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      await saveShopConfig(5, {
        shopName: "新店名",
        deliveryFee: 6,
        businessHours: null,
      }, "t1");

      expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(1);
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE t_retail_shop_config"),
        ["新店名", null, 6, 5, "t1"],
        "t1"
      );
    });

    it("不带 storeId 且租户无门店时抛出门店ID不能为空", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      await expect(saveShopConfig(undefined, { shopName: "测试店" }, "t1"))
        .rejects.toThrow("门店ID不能为空");
    });

    it("snake_case 入参保持兼容", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(undefined);
      mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
      const res = await saveShopConfig(1, {
        shop_name: "旧命名店",
        min_order_amount: 20,
      }, "t1");
      expect(res.id).toBe(1);
      const callArgs = mocks.queryWithTenant.mock.calls[0][1];
      expect(callArgs[1]).toBe("旧命名店");
      expect(callArgs[8]).toBe(20);
    });
  });

  describe("createCategory - camelCase 映射", () => {
    it("camelCase 入参映射到 snake_case 列", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 7 });
      const res = await createCategory(2, {
        name: "白酒",
        icon: "https://example.com/icon.png",
        parentId: 1,
        sortNo: 3,
        status: "ON",
      }, "t1");
      expect(res.id).toBe(7);
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO t_retail_category"),
        ["白酒", "https://example.com/icon.png", 1, 3, "ON", 2, "t1"],
        "t1"
      );
    });

    it("缺省字段使用默认值（icon null / parent_id null / sort 0 / status ON）", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 8 });
      await createCategory(undefined, { name: "啤酒" }, "t1");
      const callArgs = mocks.queryWithTenant.mock.calls[0][1];
      expect(callArgs).toEqual(["啤酒", null, null, 0, "ON", null, "t1"]);
    });
  });

  describe("updateCategory - camelCase 映射", () => {
    it("只更新传入字段，未传字段不动", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      await updateCategory(3, { name: "新分类名", sortNo: 9 }, "t1");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE t_retail_category"),
        ["新分类名", 9, 3, "t1"],
        "t1"
      );
    });

    it("无字段时不发 SQL", async () => {
      const res = await updateCategory(3, {}, "t1");
      expect(res).toEqual({ id: 3 });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });
  });

  describe("createBanner - camelCase 映射", () => {
    it("camelCase 入参映射到 snake_case 列", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
      const res = await createBanner(2, {
        title: "中秋活动",
        imageUrl: "https://example.com/banner.png",
        linkType: "PRODUCT",
        linkUrl: "1001",
        sortNo: 1,
        startTime: "2026-08-01 00:00:00",
        endTime: "2026-08-31 23:59:59",
      }, "t1");
      expect(res.id).toBe(11);
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO t_retail_banner"),
        [
          "中秋活动", "https://example.com/banner.png", "PRODUCT", "1001",
          1, "ON", "2026-08-01 00:00:00", "2026-08-31 23:59:59", 2, "t1",
        ],
        "t1"
      );
    });

    it("linkUrl 为 http 链接且未传 linkType 时推断为 URL", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 12 });
      await createBanner(undefined, {
        title: "外链活动",
        imageUrl: "https://example.com/banner2.png",
        linkUrl: "https://example.com/activity",
        sortNo: 2,
      }, "t1");
      const callArgs = mocks.queryWithTenant.mock.calls[0][1];
      expect(callArgs[2]).toBe("URL");
      expect(callArgs[3]).toBe("https://example.com/activity");
    });

    it("linkUrl 为 null 时 link_type 默认 NONE", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 13 });
      await createBanner(1, {
        title: "纯展示图",
        imageUrl: "https://example.com/banner3.png",
        linkUrl: null,
        sortNo: 3,
      }, "t1");
      const callArgs = mocks.queryWithTenant.mock.calls[0][1];
      expect(callArgs[2]).toBe("NONE");
      expect(callArgs[3]).toBeNull();
    });
  });

  describe("updateBanner - camelCase 映射", () => {
    it("只更新传入字段，未传字段不动", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      await updateBanner(4, {
        title: "新标题",
        linkType: "CATEGORY",
        linkUrl: "5",
      }, "t1");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE t_retail_banner"),
        ["新标题", "CATEGORY", "5", 4, "t1"],
        "t1"
      );
    });

    it("清除链接时 linkUrl 传 null 将 link_value 置空", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      await updateBanner(4, { linkUrl: null }, "t1");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE t_retail_banner"),
        [null, 4, "t1"],
        "t1"
      );
    });
  });
});
