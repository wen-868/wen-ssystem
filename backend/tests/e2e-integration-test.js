const BASE_URL = "http://localhost:8081/api";

let token = "";
let passed = 0;
let failed = 0;
const results = [];

async function request(method, path, body = null, useToken = true) {
  const headers = { "Content-Type": "application/json" };
  if (useToken && token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function test(name, fn) {
  return fn().then(
    (result) => {
      passed++;
      console.log(`  ✅ ${name}`);
      results.push({ name, status: "pass" });
      return result;
    },
    (err) => {
      failed++;
      console.log(`  ❌ ${name}: ${err.message}`);
      results.push({ name, status: "fail", error: err.message });
      return null;
    }
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertField(obj, field, type = "string") {
  if (!(field in obj)) throw new Error(`缺少字段: ${field}`);
  if (type === "number" && typeof obj[field] !== "number") {
    throw new Error(`字段 ${field} 类型错误，期望 number，实际 ${typeof obj[field]}`);
  }
  if (type === "string" && typeof obj[field] !== "string" && obj[field] !== null) {
    throw new Error(`字段 ${field} 类型错误，期望 string，实际 ${typeof obj[field]}`);
  }
}

async function testAuth() {
  console.log("\n=== 认证模块测试 ===");
  await test("管理员登录", async () => {
    const { status, data } = await request("POST", "/store/auth/login", {
      username: "admin",
      password: "admin123",
    }, false);
    assert(status === 200, `HTTP ${status}`);
    assert(data.data?.token, "缺少 token");
    token = data.data.token;
    return data.data;
  });
}

async function testSupplierModule() {
  console.log("\n=== 供应商管理模块测试 ===");
  let supplierId = null;
  let supplierCode = null;

  await test("创建供应商", async () => {
    const { status, data } = await request("POST", "/admin/suppliers", {
      name: "联调测试供应商有限公司",
      shortName: "联调测试",
      supplyType: "BAIJIU",
      contactPerson: "王经理",
      contactMobile: "13900001111",
      province: "四川省",
      city: "宜宾市",
      creditLevel: "A",
      settlementType: "MONTHLY",
      settlementDay: 15,
      taxRate: 0.13,
    });
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.id && !data.data?.supplierId) throw new Error("缺少 id");
    supplierId = data.data.id || data.data.supplierId;
    supplierCode = data.data.supplierCode;
    return data.data;
  });

  await test("供应商列表分页结构", async () => {
    const { status, data } = await request("GET", "/admin/suppliers?page=1&pageSize=10");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assertField(data.data, "pageSize", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    if (data.data.records.length > 0) {
      const rec = data.data.records[0];
      assertField(rec, "id", "number");
      assertField(rec, "supplierCode", "string");
      assertField(rec, "name", "string");
      assertField(rec, "shortName", "string");
      if (!("supplyType" in rec) && !("category" in rec)) {
        throw new Error("缺少 supplyType 或 category 字段");
      }
    }
    return data.data;
  });

  await test("供应商关键词搜索", async () => {
    const { status, data } = await request("GET", "/admin/suppliers?keyword=联调");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assert(data.data.total >= 1, "搜索结果应该至少有1条");
    return data.data;
  });

  console.log(`  供应商ID: ${supplierId}, 编码: ${supplierCode}`);
  return supplierId;
}

async function testPurchaseModule(supplierId) {
  console.log("\n=== 采购订单模块测试 ===");
  let purchaseNo = null;

  await test("创建采购订单", async () => {
    const { status, data } = await request("POST", "/admin/purchase-orders", {
      supplierId: supplierId,
      supplierName: "联调测试供应商",
      storeId: 1,
      expectedDate: "2026-07-01",
      remark: "联调测试采购单",
      items: [
        {
          skuId: 1,
          skuName: "示例白酒 53度",
          boxQty: 5,
          bottleQty: 2,
          unitPrice: 99,
          taxRate: 0.13,
        },
      ],
    });
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.purchaseNo && !data.data?.orderNo) {
      throw new Error("缺少 purchaseNo 或 orderNo");
    }
    purchaseNo = data.data.purchaseNo || data.data.orderNo;
    return data.data;
  });

  await test("采购订单列表分页结构", async () => {
    const { status, data } = await request("GET", "/admin/purchase-orders?page=1&pageSize=10");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assertField(data.data, "pageSize", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    if (data.data.records.length > 0) {
      const rec = data.data.records[0];
      if (!("purchaseNo" in rec) && !("orderNo" in rec)) {
        throw new Error("缺少 purchaseNo 或 orderNo 字段");
      }
      if (!("status" in rec) && !("orderStatus" in rec)) {
        throw new Error("缺少 status 或 orderStatus 字段");
      }
    }
    return data.data;
  });

  await test("采购订单详情（含明细和操作日志）", async () => {
    if (!purchaseNo) throw new Error("无订单号可测试");
    const { status, data } = await request("GET", `/admin/purchase-orders/${purchaseNo}`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    assert(Array.isArray(data.data?.items), "缺少 items 明细");
    return data.data;
  });

  await test("审核采购订单", async () => {
    if (!purchaseNo) throw new Error("无订单号可测试");
    const { status, data } = await request("POST", `/admin/purchase-orders/${purchaseNo}/approve`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    return data.data;
  });

  console.log(`  采购单号: ${purchaseNo}`);
  return purchaseNo;
}

async function testSaleReturnModule() {
  console.log("\n=== 销售退货模块测试 ===");
  let returnNo = null;

  await test("创建销售退货单", async () => {
    const { status, data } = await request("POST", "/admin/sale-returns", {
      sourceBillNo: "XS202601010001",
      storeId: 1,
      customerName: "测试客户",
      customerMobile: "13800002222",
      discountAmount: 10,
      remark: "联调测试退货",
      items: [
        {
          skuId: 1,
          skuName: "示例白酒 53度",
          boxQty: 1,
          bottleQty: 2,
          unitPrice: 99,
          reason: "质量问题",
        },
      ],
    });
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.returnNo) throw new Error("缺少 returnNo");
    returnNo = data.data.returnNo;
    return data.data;
  });

  await test("销售退货列表分页结构", async () => {
    const { status, data } = await request("GET", "/admin/sale-returns?page=1&pageSize=10");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assertField(data.data, "pageSize", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    if (data.data.records.length > 0) {
      const rec = data.data.records[0];
      if (!("returnNo" in rec)) throw new Error("缺少 returnNo 字段");
      if (!("status" in rec) && !("returnStatus" in rec)) {
        throw new Error("缺少 status 或 returnStatus 字段");
      }
    }
    return data.data;
  });

  await test("销售退货详情（含明细）", async () => {
    if (!returnNo) throw new Error("无退货单号可测试");
    const { status, data } = await request("GET", `/admin/sale-returns/${returnNo}`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    assert(Array.isArray(data.data?.items), "缺少 items 明细");
    return data.data;
  });

  await test("审核销售退货单", async () => {
    if (!returnNo) throw new Error("无退货单号可测试");
    const { status, data } = await request("POST", `/admin/sale-returns/${returnNo}/approve`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    return data.data;
  });

  console.log(`  退货单号: ${returnNo}`);
  return returnNo;
}

async function testCreditSaleModule() {
  console.log("\n=== 赊销销售单模块测试 ===");

  await test("赊销销售单列表（分页结构）", async () => {
    const { status, data } = await request("GET", "/admin/sale-bills?page=1&pageSize=10&billType=CREDIT");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assertField(data.data, "pageSize", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    return data.data;
  });

  await test("客户对账单列表", async () => {
    const { status, data } = await request("GET", "/admin/customer-statements?page=1&pageSize=10");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    return data.data;
  });

  await test("客户收款记录列表", async () => {
    const { status, data } = await request("GET", "/admin/customer-payments?page=1&pageSize=10");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertField(data.data, "total", "number");
    assertField(data.data, "page", "number");
    assert(Array.isArray(data.data.records), "records 不是数组");
    return data.data;
  });
}

async function main() {
  console.log("========================================");
  console.log("  前后端联调集成测试");
  console.log("========================================");

  await testAuth();
  const supplierId = await testSupplierModule();
  await testPurchaseModule(supplierId || 1);
  await testSaleReturnModule();
  await testCreditSaleModule();

  console.log("\n========================================");
  console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\n失败的测试:");
    results.filter(r => r.status === "fail").forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("\n🎉 所有联调测试通过！");
    process.exit(0);
  }
}

main().catch(console.error);
