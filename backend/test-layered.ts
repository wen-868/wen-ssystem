import { supplierService } from "./src/services/supplier.service.js";
import { initDatabase } from "./src/shared/db.js";

async function test() {
  await initDatabase();

  const ctx = {
    tenantId: "default",
    userId: 1,
    username: "admin",
  };

  console.log("=== SupplierService 分层测试 ===");

  // 1. 测试创建
  console.log("\n1. 创建供应商...");
  const created = await supplierService.create({
    name: "分层测试供应商",
    shortName: "分层测试",
    supplyType: "BAIJIU",
    contactPerson: "测试员",
    contactMobile: "13900000001",
  }, ctx);
  console.log("   创建结果:", JSON.stringify(created));

  // 2. 测试分页查询
  console.log("\n2. 分页查询...");
  const page = await supplierService.getPage(undefined, undefined, undefined, 1, 10, ctx);
  console.log("   总数:", page.total, "条数:", page.records.length);
  console.log("   首条字段:", Object.keys(page.records[0] || {}).slice(0, 8));

  // 3. 测试详情
  if (page.records.length > 0) {
    const firstId = page.records[0].id;
    console.log("\n3. 获取详情 id=", firstId);
    const detail = await supplierService.getDetail(firstId, ctx);
    if (detail) {
      console.log("   供应商名:", detail.name);
      console.log("   联系人数:", detail.contacts.length);
    } else {
      console.log("   未找到");
    }

    // 4. 测试统计
    console.log("\n4. 统计数据...");
    const stats = await supplierService.getStats(firstId, ctx);
    console.log("   统计字段:", stats ? Object.keys(stats) : "null");
  }

  console.log("\n=== 测试完成 ===");
  process.exit(0);
}

test().catch(e => {
  console.error("测试失败:", e);
  process.exit(1);
});
