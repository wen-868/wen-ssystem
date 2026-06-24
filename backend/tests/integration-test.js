const BASE_URL = "http://localhost:8081/api";

let token = null;

async function request(method, path, body = null, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`返回不是JSON: ${text.substring(0, 100)}`);
  }
  return { status: res.status, data };
}

function test(name, fn) {
  return fn().then(
    () => { console.log(`✅ ${name}`); return true; },
    (err) => { console.log(`❌ ${name}: ${err.message}`); return false; }
  );
}

function assertField(obj, field, type = "string") {
  if (!(field in obj)) {
    throw new Error(`缺少字段: ${field}`);
  }
  if (type === "string" && typeof obj[field] !== "string") {
    throw new Error(`字段 ${field} 不是字符串类型, 实际: ${typeof obj[field]}`);
  }
  if (type === "number" && typeof obj[field] !== "number") {
    throw new Error(`字段 ${field} 不是数字类型, 实际: ${typeof obj[field]}`);
  }
}

async function login() {
  const { status, data } = await request("POST", "/store/auth/login", {
    username: "admin",
    password: "admin123",
  }, false);

  if (status !== 200 || !data.data?.token) {
    throw new Error("登录失败");
  }

  token = data.data.token;
  const user = data.data.user;
  
  if (!user?.tenantId) {
    throw new Error("登录返回缺少 tenantId");
  }
  if (!user?.accessModes) {
    throw new Error("登录返回缺少 accessModes");
  }
  
  return user;
}

async function testSupplierModule() {
  console.log("\n=== 供应商管理模块测试 ===");
  let allPassed = true;
  let supplierId = null;

  allPassed &= await test("创建供应商", async () => {
    const { status, data } = await request("POST", "/admin/suppliers", {
      name: "测试供应商有限公司",
      shortName: "测试供应商",
      category: "白酒",
      province: "四川省",
      city: "宜宾市",
      creditLevel: "A",
      settlementType: "MONTHLY",
      settlementDay: 15,
      taxRate: 0.13,
      bankName: "工商银行",
      bankAccount: "6222021234567890123",
      bankAccountName: "测试供应商有限公司",
      remark: "测试供应商",
    });

    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.id) throw new Error("缺少 id");
    if (!data.data?.supplierCode) throw new Error("缺少 supplierCode");
    
    supplierId = data.data.id;
    return data.data;
  });

  allPassed &= await test("获取供应商列表", async () => {
    const { status, data } = await request("GET", "/admin/suppliers?page=1&pageSize=20");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!Array.isArray(data.data)) throw new Error("返回不是数组");
    
    if (data.data.length > 0) {
      const item = data.data[0];
      assertField(item, "supplierCode");
      assertField(item, "name");
      assertField(item, "shortName");
      assertField(item, "category");
      assertField(item, "creditLevel");
      assertField(item, "settlementType");
      assertField(item, "taxRate", "number");
      assertField(item, "status", "number");
      assertField(item, "createdAt");
    }
    
    return data.data;
  });

  allPassed &= await test("添加联系人", async () => {
    if (!supplierId) throw new Error("没有供应商ID");

    const { status, data } = await request("POST", `/admin/suppliers/${supplierId}/contacts`, {
      name: "张经理",
      mobile: "13800138000",
      email: "zhang@test.com",
      isPrimary: 1,
      position: "采购经理",
    });

    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!data.data?.id) throw new Error("缺少联系人 id");
    
    return data.data;
  });

  allPassed &= await test("获取供应商详情", async () => {
    if (!supplierId) throw new Error("没有供应商ID");

    const { status, data } = await request("GET", `/admin/suppliers/${supplierId}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    
    const detail = data.data;
    assertField(detail, "supplierCode");
    assertField(detail, "name");
    assertField(detail, "shortName");
    assertField(detail, "creditLevel");
    assertField(detail, "settlementType");
    assertField(detail, "bankName");
    if (!Array.isArray(detail.contacts)) throw new Error("缺少 contacts 数组");
    
    if (detail.contacts.length > 0) {
      const contact = detail.contacts[0];
      assertField(contact, "name");
      assertField(contact, "mobile");
      assertField(contact, "isPrimary", "number");
      assertField(contact, "position");
    }
  });

  allPassed &= await test("更新供应商", async () => {
    if (!supplierId) throw new Error("没有供应商ID");

    const { status, data } = await request("PUT", `/admin/suppliers/${supplierId}`, {
      name: "测试供应商有限公司（已更新）",
      creditLevel: "AA",
    });

    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.data?.id !== supplierId) throw new Error("id 不匹配");
  });

  return allPassed;
}

async function testPurchaseModule() {
  console.log("\n=== 采购订单模块测试 ===");
  let allPassed = true;
  let orderNo = null;

  allPassed &= await test("创建采购订单", async () => {
    const { status, data } = await request("POST", "/admin/purchase-orders", {
      supplierId: 1,
      supplierName: "测试供应商",
      storeId: 1,
      expectedDate: "2026-07-01",
      discountAmount: 100,
      remark: "测试采购订单",
      items: [
        {
          skuId: 1,
          skuName: "示例白酒 53度 500ml 常温",
          barcode: "690000000001",
          boxQty: 10,
          bottleQty: 5,
          unitPrice: 99,
          taxRate: 0.13,
        }
      ],
    });

    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.orderNo) throw new Error("缺少 orderNo");
    
    orderNo = data.data.orderNo;
    return data.data;
  });

  allPassed &= await test("获取采购订单列表", async () => {
    const { status, data } = await request("GET", "/admin/purchase-orders?page=1&pageSize=20");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!Array.isArray(data.data)) throw new Error("返回不是数组");
    
    if (data.data.length > 0) {
      const item = data.data[0];
      assertField(item, "orderNo");
      assertField(item, "supplierId", "number");
      assertField(item, "supplierName");
      assertField(item, "orderStatus");
      assertField(item, "goodsAmount", "number");
      assertField(item, "payableAmount", "number");
      assertField(item, "createdAt");
    }
  });

  allPassed &= await test("获取采购订单详情", async () => {
    if (!orderNo) throw new Error("没有订单号");

    const { status, data } = await request("GET", `/admin/purchase-orders/${orderNo}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    
    const detail = data.data;
    assertField(detail, "orderNo");
    assertField(detail, "supplierName");
    assertField(detail, "orderStatus");
    assertField(detail, "goodsAmount", "number");
    assertField(detail, "taxAmount", "number");
    assertField(detail, "payableAmount", "number");
    if (!Array.isArray(detail.items)) throw new Error("缺少 items 数组");
    
    if (detail.items.length > 0) {
      const item = detail.items[0];
      assertField(item, "skuId", "number");
      assertField(item, "skuName");
      assertField(item, "boxQty", "number");
      assertField(item, "bottleQty", "number");
      assertField(item, "totalBottleQty", "number");
      assertField(item, "unitPrice", "number");
      assertField(item, "subtotalAmount", "number");
    }
  });

  allPassed &= await test("提交审核", async () => {
    if (!orderNo) throw new Error("没有订单号");

    const { status, data } = await request("POST", `/admin/purchase-orders/${orderNo}/submit`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
  });

  allPassed &= await test("审核通过", async () => {
    if (!orderNo) throw new Error("没有订单号");

    const { status, data } = await request("POST", `/admin/purchase-orders/${orderNo}/approve`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
  });

  return allPassed;
}

async function testSaleReturnModule() {
  console.log("\n=== 销售退货模块测试 ===");
  let allPassed = true;
  let returnNo = null;

  allPassed &= await test("创建退货单", async () => {
    const { status, data } = await request("POST", "/store/sale-returns", {
      sourceBillNo: "XS202601010001",
      storeId: 1,
      customerId: 1,
      customerName: "测试客户",
      customerMobile: "13800138000",
      discountAmount: 0,
      remark: "质量问题退货",
      items: [
        {
          skuId: 1,
          skuName: "示例白酒 53度 500ml 常温",
          boxQty: 1,
          bottleQty: 2,
          unitPrice: 129,
          reason: "包装破损",
        }
      ],
    });

    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.returnNo) throw new Error("缺少 returnNo");
    
    returnNo = data.data.returnNo;
    return data.data;
  });

  allPassed &= await test("获取退货单列表", async () => {
    const { status, data } = await request("GET", "/store/sale-returns?page=1&pageSize=20");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!Array.isArray(data.data)) throw new Error("返回不是数组");
    
    if (data.data.length > 0) {
      const item = data.data[0];
      assertField(item, "returnNo");
      assertField(item, "sourceBillNo");
      assertField(item, "customerName");
      assertField(item, "returnStatus");
      assertField(item, "goodsAmount", "number");
      assertField(item, "refundAmount", "number");
      assertField(item, "createdAt");
    }
  });

  allPassed &= await test("获取退货单详情", async () => {
    if (!returnNo) throw new Error("没有退货单号");

    const { status, data } = await request("GET", `/store/sale-returns/${returnNo}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    
    const detail = data.data;
    assertField(detail, "returnNo");
    assertField(detail, "customerName");
    assertField(detail, "returnStatus");
    assertField(detail, "goodsAmount", "number");
    assertField(detail, "refundAmount", "number");
    if (!Array.isArray(detail.items)) throw new Error("缺少 items 数组");
    
    if (detail.items.length > 0) {
      const item = detail.items[0];
      assertField(item, "skuId", "number");
      assertField(item, "skuName");
      assertField(item, "boxQty", "number");
      assertField(item, "bottleQty", "number");
      assertField(item, "totalBottleQty", "number");
      assertField(item, "unitPrice", "number");
      assertField(item, "subtotalAmount", "number");
      assertField(item, "reason");
    }
  });

  allPassed &= await test("审核退货单", async () => {
    if (!returnNo) throw new Error("没有退货单号");

    const { status, data } = await request("POST", `/store/sale-returns/${returnNo}/approve`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
  });

  return allPassed;
}

async function testSaleCreditModule() {
  console.log("\n=== 销售单赊销模块测试 ===");
  let allPassed = true;
  let billNo = null;

  allPassed &= await test("创建赊销单", async () => {
    const { status, data } = await request("POST", "/store/sale/bill", {
      storeId: 1,
      customerId: 2,
      customerName: "默认批发客户",
      customerMobile: "13900000001",
      customerType: "WHOLESALE",
      saleType: "CREDIT",
      dueDate: "2026-07-15",
      items: [
        {
          skuId: 1,
          skuName: "示例白酒 53度 500ml 常温",
          price: 99,
          quantity: 24,
          amount: 2376,
        }
      ],
      goodsAmount: 2376,
      discountAmount: 0,
      roundingAmount: 0,
      receivableAmount: 2376,
      receivedAmount: 0,
    });

    if (status !== 200) throw new Error(`HTTP ${status}: ${data.message}`);
    if (!data.data?.billNo) throw new Error("缺少 billNo");
    
    billNo = data.data.billNo;
    return data.data;
  });

  allPassed &= await test("获取销售单列表（含赊销字段）", async () => {
    const { status, data } = await request("GET", "/store/sale/bills?page=1&pageSize=20");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!Array.isArray(data.data)) throw new Error("返回不是数组");
    
    if (data.data.length > 0) {
      const item = data.data[0];
      assertField(item, "billNo");
      assertField(item, "customerName");
      assertField(item, "saleType");
      assertField(item, "businessStatus");
      assertField(item, "collectionStatus");
      assertField(item, "receivableAmount", "number");
      assertField(item, "receivedAmount", "number");
      assertField(item, "unreceivedAmount", "number");
      assertField(item, "createdAt");
    }
  });

  allPassed &= await test("获取销售单详情（含赊销字段）", async () => {
    if (!billNo) throw new Error("没有销售单号");

    const { status, data } = await request("GET", `/store/sale/bill/${billNo}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    
    const detail = data.data;
    assertField(detail, "billNo");
    assertField(detail, "customerName");
    assertField(detail, "saleType");
    assertField(detail, "businessStatus");
    assertField(detail, "collectionStatus");
    assertField(detail, "goodsAmount", "number");
    assertField(detail, "discountAmount", "number");
    assertField(detail, "receivableAmount", "number");
    assertField(detail, "receivedAmount", "number");
    assertField(detail, "unreceivedAmount", "number");
    assertField(detail, "dueDate");
    assertField(detail, "remark");
    assertField(detail, "createdAt");
  });

  return allPassed;
}

async function main() {
  console.log("=== 前后端接口对接测试 ===\n");

  try {
    console.log("登录中...");
    const user = await login();
    console.log(`✅ 登录成功: ${user.realName} (tenantId: ${user.tenantId})`);
    console.log(`   accessModes: ${user.accessModes.join(", ")}`);
  } catch (err) {
    console.log(`❌ 登录失败: ${err.message}`);
    process.exit(1);
  }

  const results = [];
  results.push(await testSupplierModule());
  results.push(await testPurchaseModule());
  results.push(await testSaleReturnModule());
  results.push(await testSaleCreditModule());

  console.log("\n=== 测试总结 ===");
  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`通过: ${passed}/${total} 个模块`);

  if (passed === total) {
    console.log("\n🎉 所有模块对接测试通过！");
    process.exit(0);
  } else {
    console.log("\n⚠️  部分模块测试未通过，请检查");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("测试运行出错:", err);
  process.exit(1);
});
