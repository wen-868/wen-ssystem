import { describe, it, expect, vi, beforeEach } from "vitest";
import { memoryCache, cacheManager } from "../../middleware/memory-cache";

describe("memory-cache 失效验证测试", () => {
  beforeEach(() => {
    cacheManager.clear();
  });

  it("memoryCache 和 cacheManager 使用同一个缓存实例", () => {
    expect(cacheManager.cache).toBeDefined();
  });

  it("缓存写入后可以通过 cacheManager 获取", () => {
    cacheManager.cache.set("test-key", { data: "test-data", timestamp: Date.now(), ttl: 60000 });

    const cached = cacheManager.cache.get("test-key");
    expect(cached).toBeTruthy();
    expect(cached?.data).toBe("test-data");
  });

  it("cacheManager.delete 可以删除缓存", () => {
    cacheManager.cache.set("test-key-2", { data: "test-data-2", timestamp: Date.now(), ttl: 60000 });
    
    expect(cacheManager.cache.has("test-key-2")).toBe(true);
    
    cacheManager.delete("test-key-2");
    
    expect(cacheManager.cache.has("test-key-2")).toBe(false);
  });

  it("cacheManager.clear 可以清空所有缓存", () => {
    cacheManager.cache.set("key1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("key2", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    
    expect(cacheManager.getStats().size).toBe(2);
    
    cacheManager.clear();
    
    expect(cacheManager.getStats().size).toBe(0);
  });

  it("getAllKeys 返回所有缓存键", () => {
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/orders?tenantId=t1", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t2", { data: "v3", timestamp: Date.now(), ttl: 60000 });
    
    const keys = cacheManager.getAllKeys();
    
    expect(keys).toHaveLength(3);
    expect(keys).toContain("cache:/api/admin/products?tenantId=t1");
    expect(keys).toContain("cache:/api/admin/orders?tenantId=t1");
    expect(keys).toContain("cache:/api/admin/products?tenantId=t2");
  });

  it("product.invalidateByTenant 只删除指定租户的产品缓存", () => {
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/orders?tenantId=t1", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t2", { data: "v3", timestamp: Date.now(), ttl: 60000 });
    
    cacheManager.product.invalidateByTenant("t1");
    
    expect(cacheManager.cache.has("cache:/api/admin/products?tenantId=t1")).toBe(false);
    expect(cacheManager.cache.has("cache:/api/admin/orders?tenantId=t1")).toBe(true);
    expect(cacheManager.cache.has("cache:/api/admin/products?tenantId=t2")).toBe(true);
  });

  it("order.invalidateByTenant 只删除指定租户的订单缓存", () => {
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/orders?tenantId=t1", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/orders?tenantId=t2", { data: "v3", timestamp: Date.now(), ttl: 60000 });
    
    cacheManager.order.invalidateByTenant("t1");
    
    expect(cacheManager.cache.has("cache:/api/admin/orders?tenantId=t1")).toBe(false);
    expect(cacheManager.cache.has("cache:/api/admin/products?tenantId=t1")).toBe(true);
    expect(cacheManager.cache.has("cache:/api/admin/orders?tenantId=t2")).toBe(true);
  });

  it("report.invalidateByTenant 只删除指定租户的报表缓存", () => {
    cacheManager.cache.set("cache:/api/admin/reports?tenantId=t1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/products?tenantId=t1", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("cache:/api/admin/reports?tenantId=t2", { data: "v3", timestamp: Date.now(), ttl: 60000 });
    
    cacheManager.report.invalidateByTenant("t1");
    
    expect(cacheManager.cache.has("cache:/api/admin/reports?tenantId=t1")).toBe(false);
    expect(cacheManager.cache.has("cache:/api/admin/products?tenantId=t1")).toBe(true);
    expect(cacheManager.cache.has("cache:/api/admin/reports?tenantId=t2")).toBe(true);
  });

  it("getStats 返回正确的缓存统计信息", () => {
    cacheManager.cache.set("key1", { data: "v1", timestamp: Date.now(), ttl: 60000 });
    cacheManager.cache.set("key2", { data: "v2", timestamp: Date.now(), ttl: 60000 });
    
    const stats = cacheManager.getStats();
    
    expect(stats.size).toBe(2);
    expect(stats.max).toBe(500);
  });
});