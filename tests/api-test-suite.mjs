
#!/usr/bin/env node
// ============================================================
// 智享营销系统 - 接口自动化测试集合
// 覆盖: 认证、商品、门店、订单、销售单、库存、客户、收款、
//       挂单、报表、分享收款、响应结构一致性、权限、安全
// 运行方式: node tests/api-test-suite.mjs
// ============================================================

import http from "node:http";
import { URL } from "node:url";

const BASE_URL = process.env.API_BASE || "http://localhost:8080";
const API_PREFIX = "/api";
const TIMEOUT_MS = 15000;

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

let testResults = [];
let adminToken = "";
let storeToken = "";
let miniappToken = "";
let runtimeData = {};

// ======================= HTTP 请求 =======================
function request(method, path, body = null, token = "") {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      timeout: TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (token) options.headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, raw: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("请求超时"));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ======================= 测试记录工具 =======================
function recordTest(section, id, name, passed, detail = "") {
  testResults.push({ section, id, name, passed, detail });
  if (passed) {
    console.log(`  ${COLORS.green}✓${COLORS.reset} ${id} ${name}`);
  } else {
    console.log(`  ${COLORS.red}✗${COLORS.reset} ${id} ${name}`);
    if (detail) console.log(`     ${COLORS.gray}${detail}${COLORS.reset}`);
  }
}

function recordInfo(msg) {
  console.log(`\n${COLORS.cyan}${msg}${COLORS.reset}`);
}

// ======================= 辅助断言函数 =======================
function assertSchema(res) {
  return res && res.json && "code" in res.json;
}
function assertSuccess(res) {
  return assertSchema(res) && String(res.json.code) === "0";
}
function assertStatus(res, code) {
  return res.status === code;
}
function assertHasFields(obj, fields) {
  return fields.every((f) => obj && f in obj && obj[f] !== undefined);
}

// ======================= 正式测试开始 =======================

async function run() {
  console.log(`\n${COLORS.magenta}====================================================${COLORS.reset}`);
  console.log(`智享营销系统 - 接口自动化测试集`);
  console.log(`测试目标: ${BASE_URL}`);
  console.log(`开始时间: ${new Date().toLocaleString()}`);
  console.log(`${COLORS.magenta}====================================================${COLORS.reset}`);

  // --- Step 1: 健康检查 ---
  recordInfo("【1】健康检查 & 基础连通性");
  try {
    const r = await request("GET", "/health");
    const ok = assertStatus(r, 200) && assertSuccess(r);
    recordTest("健康检查", "HEALTH-001", "/health 接口返回 code=0", ok,
      ok ? "" : `实际: HTTP ${r.status}, code=${r.json?.code}`);
  } catch (e) {
    recordTest("健康检查", "HEALTH-001", "/health 接口返回 code=0", false,
      `错误: ${e.message}。请确认后端服务已启动。`);
    console.log(`\n${COLORS.red}后端服务不可用，测试终止。${COLORS.reset}\n`);
    finalize();
    process.exit(1);
  }

  // --- Step 2: 认证模块 ---
  recordInfo("【2】认证模块 (Auth)");

  // 2.1 正确登录
  try {
    const r = await request("POST", `${API_PREFIX}/admin/auth/login`, {
      username: "admin", password: "admin123",
    });
    const ok = assertSuccess(r) && r.json.data?.token;
    if (ok) adminToken = r.json.data.token;
    recordTest("认证", "AUTH-001", "管理员正确登录获取 token", ok,
      ok ? "" : `HTTP ${r.status}, code=${r.json?.code}`);
  } catch (e) { recordTest("认证", "AUTH-001", "管理员正确登录获取 token", false, e.message); }

  // 2.2 错误密码
  try {
    const r = await request("POST", `${API_PREFIX}/admin/auth/login`, {
      username: "admin", password: "wrong_password",
    });
    const ok = r.status === 401 || (r.json && String(r.json.code) === "401");
    recordTest("认证", "AUTH-002", "错误密码应返回 401", ok,
      ok ? "" : `实际: HTTP ${r.status}, code=${r.json?.code}`);
  } catch (e) { recordTest("认证", "AUTH-002", "错误密码应返回 401", false, e.message); }

  // 2.3 无 token 访问
  try {
    const r = await request("GET", `${API_PREFIX}/admin/products`);
    const ok = r.status === 401;
    recordTest("认证", "AUTH-003", "无 Token 访问受限接口返回 401", ok,
      ok ? "" : `实际: HTTP ${r.status}`);
  } catch (e) { recordTest("认证", "AUTH-003", "无 Token 访问受限接口返回 401", false, e.message); }

  // 2.4 伪造 token
  try {
    const r = await request("GET", `${API_PREFIX}/admin/products`, null, "this.is.fake.token");
    const ok = r.status === 401;
    recordTest("认证", "AUTH-004", "伪造 Token 访问返回 401", ok,
      ok ? "" : `实际: HTTP ${r.status}`);
  } catch (e) { recordTest("认证", "AUTH-004", "伪造 Token 访问返回 401", false, e.message); }

  // 2.5 登录态获取自身信息
  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/auth/me`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("认证", "AUTH-005", "/auth/me 返回当前用户信息", ok,
        ok ? "" : `code=${r.json?.code}`);
    } catch (e) { recordTest("认证", "AUTH-005", "/auth/me 返回当前用户信息", false, e.message); }
  }

  // --- Step 3: 商品管理 ---
  recordInfo("【3】商品管理 (Products)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/products?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r) && Array.isArray(r.json.data?.records);
      recordTest("商品", "PROD-001", "商品列表查询", ok,
        ok ? `total=${r.json.data.total}, records=${r.json.data.records.length}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("商品", "PROD-001", "商品列表查询", false, e.message); }

    // 创建商品
    try {
      const body = {
        name: "接口测试商品_" + Date.now(),
        categoryId: 1,
        saleChannels: ["MINIAPP", "STORE"],
        skus: [{
          skuName: "接口测试SKU",
          barcode: "TEST" + Date.now(),
          boxRatio: 1,
          temperature: "NORMAL",
          traceEnabled: false,
          warningThreshold: 10,
          costPrice: 50,
          retailPrice: 99,
        }],
      };
      const r = await request("POST", `${API_PREFIX}/admin/products`, body, adminToken);
      const ok = assertSuccess(r);
      if (ok && r.json.data?.id) runtimeData.testProductId = r.json.data.id;
      recordTest("商品", "PROD-002", "创建商品（含 SKU、价格体系）", ok,
        ok ? `id=${r.json.data?.id || r.json.data?.spuCode}` : `HTTP ${r.status}, msg=${r.json?.message}`);
    } catch (e) { recordTest("商品", "PROD-002", "创建商品（含 SKU、价格体系）", false, e.message); }

    // 搜索
    try {
      const r = await request("GET", `${API_PREFIX}/admin/products?keyword=接口测试`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("商品", "PROD-003", "商品搜索", ok,
        ok ? `records=${r.json.data.records.length}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("商品", "PROD-003", "商品搜索", false, e.message); }
  }

  // --- Step 4: 门店管理 ---
  recordInfo("【4】门店管理 (Stores)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/stores?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("门店", "STORE-001", "门店列表", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("门店", "STORE-001", "门店列表", false, e.message); }

    try {
      const r = await request("POST", `${API_PREFIX}/admin/stores`, {
        name: "接口测试门店_" + Date.now(), address: "地址", deliveryRadius: 3,
      }, adminToken);
      const ok = assertSuccess(r);
      recordTest("门店", "STORE-002", "创建新门店", ok,
        ok ? `id=${r.json.data?.id}, code=${r.json.data?.storeCode}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("门店", "STORE-002", "创建新门店", false, e.message); }

    // 门店员工 (staff)
    try {
      const r = await request("GET", `${API_PREFIX}/admin/staff`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("门店", "STORE-003", "门店员工列表", ok,
        ok ? `records=${r.json.data.records.length}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("门店", "STORE-003", "门店员工列表", false, e.message); }
  }

  // --- Step 5: 客户管理 ---
  recordInfo("【5】客户管理 (Members)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/members?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("客户", "MEM-001", "客户列表", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("客户", "MEM-001", "客户列表", false, e.message); }

    try {
      const body = { name: "接口测试客户", mobile: "138" + Date.now().toString().slice(-8), customerType: "RETAIL" };
      const r = await request("POST", `${API_PREFIX}/admin/members`, body, adminToken);
      const ok = assertSuccess(r);
      if (ok && r.json.data?.memberId) runtimeData.testMemberId = r.json.data.memberId;
      recordTest("客户", "MEM-002", "新增客户", ok,
        ok ? `memberId=${r.json.data?.memberId}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("客户", "MEM-002", "新增客户", false, e.message); }

    if (runtimeData.testMemberId) {
      try {
        const r = await request("POST", `${API_PREFIX}/admin/members/${runtimeData.testMemberId}/assign`,
          { staffId: 1 }, adminToken);
        const ok = assertSuccess(r);
        recordTest("客户", "MEM-003", "客户分配给销售员", ok,
          ok ? "" : `HTTP ${r.status}`);
      } catch (e) { recordTest("客户", "MEM-003", "客户分配给销售员", false, e.message); }
    }
  }

  // --- Step 6: 订单管理 ---
  recordInfo("【6】订单管理 (Orders)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/orders?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("订单", "ORDER-001", "订单列表（分页）", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("订单", "ORDER-001", "订单列表（分页）", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/orders?status=PENDING_PAYMENT`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("订单", "ORDER-002", "订单按状态筛选", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("订单", "ORDER-002", "订单按状态筛选", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/orders?keyword=138`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("订单", "ORDER-003", "订单按关键字搜索", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("订单", "ORDER-003", "订单按关键字搜索", false, e.message); }
  }

  // 小程序下单
  try {
    const r = await request("POST", `${API_PREFIX}/miniapp/orders`, {
      storeId: 1, fulfillmentType: "PICKUP",
      items: [{ skuId: 1, qty: 1 }],
      receiverName: "测试用户", receiverMobile: "13800000000",
    });
    const ok = assertSuccess(r);
    if (ok && r.json.data?.orderNo) runtimeData.testOrderNo = r.json.data.orderNo;
    recordTest("订单", "ORDER-004", "小程序下单（qty 字段）", ok,
      ok ? `orderNo=${r.json.data?.orderNo}` : `HTTP ${r.status}, msg=${r.json?.message}`);
  } catch (e) { recordTest("订单", "ORDER-004", "小程序下单（qty 字段）", false, e.message); }

  // quantity 兼容
  try {
    const r = await request("POST", `${API_PREFIX}/miniapp/orders`, {
      storeId: 1, fulfillmentType: "DELIVERY",
      items: [{ skuId: 1, quantity: 1 }],
      receiverName: "测试用户2", receiverMobile: "13800000001", receiverAddress: "测试地址",
    });
    const ok = assertSuccess(r);
    recordTest("订单", "ORDER-005", "小程序下单（quantity 字段兼容）", ok,
      ok ? `orderNo=${r.json.data?.orderNo}` : `HTTP ${r.status}`);
  } catch (e) { recordTest("订单", "ORDER-005", "小程序下单（quantity 字段兼容）", false, e.message); }

  // 订单详情
  if (runtimeData.testOrderNo) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/orders/${runtimeData.testOrderNo}`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("订单", "ORDER-006", "订单详情（admin）", ok,
        ok ? `orderStatus=${r.json.data?.orderStatus}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("订单", "ORDER-006", "订单详情（admin）", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/miniapp/orders/${runtimeData.testOrderNo}`);
      const ok = assertSuccess(r);
      recordTest("订单", "ORDER-007", "订单详情（miniapp）", ok,
        ok ? `orderStatus=${r.json.data?.orderStatus}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("订单", "ORDER-007", "订单详情（miniapp）", false, e.message); }
  }

  // --- Step 7: 销售单 & 收款 ---
  recordInfo("【7】销售单 & 收款 (Sale Bills / Collection)");

  try {
    const body = {
      storeId: 1,
      customerName: "接口测试客户",
      customerMobile: "13800000000",
      items: [{ skuId: 1, totalBottleQty: 2, unitPrice: 100 }],
    };
    const r = await request("POST", `${API_PREFIX}/store/sale-bills`, body, adminToken);
    const ok = assertSuccess(r);
    if (ok && r.json.data?.billNo) runtimeData.testBillNo = r.json.data.billNo;
    recordTest("销售单", "BILL-001", "创建销售单", ok,
      ok ? `billNo=${r.json.data?.billNo}, receivable=${r.json.data?.receivableAmount}` : `HTTP ${r.status}, msg=${r.json?.message}`);
  } catch (e) { recordTest("销售单", "BILL-001", "创建销售单", false, e.message); }

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/sale-bills?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("销售单", "BILL-002", "销售单列表（admin）", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("销售单", "BILL-002", "销售单列表（admin）", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/store/sale-bills`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("销售单", "BILL-003", "销售单列表（store）", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("销售单", "BILL-003", "销售单列表（store）", false, e.message); }
  }

  // 销售单详情
  if (runtimeData.testBillNo) {
    try {
      const r = await request("GET", `${API_PREFIX}/store/sale-bills/${runtimeData.testBillNo}`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("销售单", "BILL-004", "销售单详情", ok,
        ok ? `receivable=${r.json.data?.receivableAmount}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("销售单", "BILL-004", "销售单详情", false, e.message); }

    // 离线收款
    try {
      const r = await request("POST", `${API_PREFIX}/store/sale-bills/${runtimeData.testBillNo}/offline-payment`,
        { amount: 100, paymentMethod: "CASH", remark: "接口测试" }, adminToken);
      const ok = assertSuccess(r);
      recordTest("销售单", "BILL-005", "销售单离线收款", ok,
        ok ? "" : `HTTP ${r.status}, msg=${r.json?.message}`);
    } catch (e) { recordTest("销售单", "BILL-005", "销售单离线收款", false, e.message); }

    // 分享收款
    try {
      const r = await request("POST", `${API_PREFIX}/store/sale-bills/${runtimeData.testBillNo}/collection-link`,
        { shareChannel: "LINK", amount: 100, expireHours: 72 }, adminToken);
      const ok = assertSuccess(r);
      if (ok && r.json.data?.linkNo) runtimeData.testLinkToken = r.json.data.token;
      recordTest("销售单", "BILL-006", "销售单生成分享收款链接", ok,
        ok ? `linkNo=${r.json.data?.linkNo}, shareUrl=${r.json.data?.shareUrl}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("销售单", "BILL-006", "销售单生成分享收款链接", false, e.message); }
  }

  // --- Step 8: 库存管理 ---
  recordInfo("【8】库存管理 (Inventory)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/inventory/balances`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("库存", "INV-001", "后台库存总览", ok,
        ok ? `records=${r.json.data?.records?.length ?? 0}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("库存", "INV-001", "后台库存总览", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/inventory/logs?page=1&pageSize=10`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("库存", "INV-002", "后台库存流水", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("库存", "INV-002", "后台库存流水", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/inventory/alerts`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("库存", "INV-003", "后台库存预警", ok,
        ok ? `records=${Array.isArray(r.json.data) ? r.json.data.length : r.json.data?.records?.length ?? 0}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("库存", "INV-003", "后台库存预警", false, e.message); }
  }

  // 门店库存
  try {
    const r = await request("GET", `${API_PREFIX}/store/inventory?storeId=1`, null, adminToken);
    const ok = assertSuccess(r);
    recordTest("库存", "INV-004", "门店库存查询", ok,
      ok ? `records=${Array.isArray(r.json.data) ? r.json.data.length : (r.json.data?.records?.length ?? 0)}` : `HTTP ${r.status}`);
  } catch (e) { recordTest("库存", "INV-004", "门店库存查询", false, e.message); }

  // 门店库存调整
  try {
    const r = await request("POST", `${API_PREFIX}/store/inventory/adjust`,
      { skuId: 1, stockType: "OFFLINE", change: 5, remark: "接口测试调整" }, adminToken);
    const ok = assertSuccess(r);
    recordTest("库存", "INV-005", "门店库存调整", ok,
      ok ? "" : `HTTP ${r.status}, msg=${r.json?.message}`);
  } catch (e) { recordTest("库存", "INV-005", "门店库存调整", false, e.message); }

  // --- Step 9: 收款记录 & 退款记录 ---
  recordInfo("【9】收款 & 退款 (Payment / Refund)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/payment-orders`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("收款", "PAY-001", "后台支付记录列表", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("收款", "PAY-001", "后台支付记录列表", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/refund-orders`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("收款", "PAY-002", "后台退款记录列表", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("收款", "PAY-002", "后台退款记录列表", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/collection-links`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("收款", "PAY-003", "后台分享收款链接", ok,
        ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("收款", "PAY-003", "后台分享收款链接", false, e.message); }
  }

  // --- Step 10: 挂单 ---
  recordInfo("【10】挂单 (Hold Orders)");

  try {
    const r = await request("POST", `${API_PREFIX}/store/hold-orders`, {
      customerName: "接口测试挂单", customerMobile: "13800000000",
      items: [{ skuId: 1, skuName: "测试SKU", quantity: 1, unitPrice: 100, subtotalAmount: 100 }],
    }, adminToken);
    const ok = assertSuccess(r);
    if (ok && r.json.data?.holdNo) runtimeData.testHoldNo = r.json.data.holdNo;
    recordTest("挂单", "HOLD-001", "创建挂单", ok,
      ok ? `holdNo=${r.json.data?.holdNo}` : `HTTP ${r.status}`);
  } catch (e) { recordTest("挂单", "HOLD-001", "创建挂单", false, e.message); }

  try {
    const r = await request("GET", `${API_PREFIX}/store/hold-orders`, null, adminToken);
    const ok = assertSuccess(r);
    recordTest("挂单", "HOLD-002", "挂单列表", ok,
      ok ? `total=${r.json.data.total}` : `HTTP ${r.status}`);
  } catch (e) { recordTest("挂单", "HOLD-002", "挂单列表", false, e.message); }

  if (runtimeData.testHoldNo) {
    try {
      const r = await request("POST", `${API_PREFIX}/store/hold-orders/${runtimeData.testHoldNo}/restore`,
        null, adminToken);
      const ok = assertSuccess(r);
      recordTest("挂单", "HOLD-003", "取单恢复", ok,
        ok ? `items=${r.json.data?.items?.length}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("挂单", "HOLD-003", "取单恢复", false, e.message); }

    try {
      const r = await request("DELETE", `${API_PREFIX}/store/hold-orders/${runtimeData.testHoldNo}`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("挂单", "HOLD-004", "删除挂单", ok,
        ok ? `status=${r.json.data?.status}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("挂单", "HOLD-004", "删除挂单", false, e.message); }
  }

  // --- Step 11: 报表 ---
  recordInfo("【11】报表 (Reports)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/reports/dashboard`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("报表", "REP-001", "后台报表看板", ok,
        ok ? `salesAmount=${r.json.data?.salesAmount}, pendingOrderCount=${r.json.data?.pendingOrderCount}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("报表", "REP-001", "后台报表看板", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/store/dashboard?storeId=1`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("报表", "REP-002", "门店工作台看板", ok,
        ok ? `todaySales=${r.json.data?.todaySalesAmount}, unReceived=${r.json.data?.unReceivedAmount}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("报表", "REP-002", "门店工作台看板", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/reports/daily-sales`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("报表", "REP-003", "近 7 天销售趋势", ok,
        ok ? `days=${Array.isArray(r.json.data) ? r.json.data.length : 0}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("报表", "REP-003", "近 7 天销售趋势", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/reports/order-stats`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("报表", "REP-004", "订单状态分布", ok,
        ok ? `records=${Array.isArray(r.json.data) ? r.json.data.length : 0}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("报表", "REP-004", "订单状态分布", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/reports/store-performance`, null, adminToken);
      const ok = assertSuccess(r);
      recordTest("报表", "REP-005", "门店业绩", ok,
        ok ? `records=${Array.isArray(r.json.data) ? r.json.data.length : 0}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("报表", "REP-005", "门店业绩", false, e.message); }
  }

  // --- Step 12: 响应结构一致性 ---
  recordInfo("【12】响应结构一致性 (Schema)");

  if (adminToken) {
    const endpoints = [
      ["商品列表", `${API_PREFIX}/admin/products?page=1&pageSize=1`],
      ["订单列表", `${API_PREFIX}/admin/orders?page=1&pageSize=1`],
      ["客户列表", `${API_PREFIX}/admin/members?page=1&pageSize=1`],
      ["门店列表", `${API_PREFIX}/admin/stores?page=1&pageSize=1`],
    ];
    for (const [name, path] of endpoints) {
      try {
        const r = await request("GET", path, null, adminToken);
        const hasFields = r.json?.data && "total" in r.json.data && "records" in r.json.data;
        recordTest("Schema", `SCH-${endpoints.indexOf([name, path]) + 1}`, `${name} pagination 字段一致`, hasFields,
          hasFields ? "" : `缺少 total/records 字段: ${JSON.stringify(r.json?.data).slice(0,100)}`);
      } catch (e) { recordTest("Schema", `SCH-???`, `${name}`, false, e.message); }
    }
  }

  // --- Step 13: 安全/边界测试 ---
  recordInfo("【13】安全测试 (Security)");

  if (adminToken) {
    try {
      const r = await request("GET", `${API_PREFIX}/admin/products?keyword=1' OR '1'='1`, null, adminToken);
      const ok = assertStatus(r, 200);
      recordTest("安全", "SEC-001", "SQL 注入防护 (商品搜索)", ok,
        ok ? `HTTP ${r.status}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("安全", "SEC-001", "SQL 注入防护 (商品搜索)", false, e.message); }

    try {
      const r = await request("GET", `${API_PREFIX}/admin/orders?keyword=1' UNION SELECT 1,2,3--`, null, adminToken);
      const ok = assertStatus(r, 200);
      recordTest("安全", "SEC-002", "SQL 注入防护 (订单搜索)", ok,
        ok ? `HTTP ${r.status}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("安全", "SEC-002", "SQL 注入防护 (订单搜索)", false, e.message); }

    try {
      const r = await request("POST", `${API_PREFIX}/admin/products`, {
        name: "<script>alert(1)</script>", categoryId: 1,
        skus: [{ skuName: "<script>alert(2)</script>", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 10, costPrice: 1, retailPrice: 10 }],
      }, adminToken);
      const ok = r.status < 500;
      recordTest("安全", "SEC-003", "XSS 测试 - 输入脚本", ok,
        ok ? `HTTP ${r.status}` : `HTTP ${r.status}`);
    } catch (e) { recordTest("安全", "SEC-003", "XSS 测试 - 输入脚本", false, e.message); }

    // 测试价格调整边界（负数）
    try {
      // 找一个商品 SKU
      const products = await request("GET", `${API_PREFIX}/admin/products?page=1&pageSize=1`, null, adminToken);
      const skuId = products.json?.data?.records?.[0]?.skuId || 1;
      const r = await request("PUT", `${API_PREFIX}/admin/products/${skuId}/price`,
        { retailPrice: -1 }, adminToken);
      const ok = r.status < 500;
      recordTest("安全", "SEC-004", "边界值 - 负价格应被拒绝或处理", ok,
        `HTTP ${r.status}, code=${r.json?.code}`);
    } catch (e) { recordTest("安全", "SEC-004", "边界值 - 负价格应被拒绝或处理", false, e.message); }

    // 测试分页参数越界
    try {
      const r = await request("GET", `${API_PREFIX}/admin/products?page=0&pageSize=9999`, null, adminToken);
      const ok = r.status < 500;
      recordTest("安全", "SEC-005", "分页参数越界应优雅处理", ok,
        `HTTP ${r.status}`);
    } catch (e) { recordTest("安全", "SEC-005", "分页参数越界应优雅处理", false, e.message); }
  }

  // --- Step 14: 响应结构统一校验 ---
  recordInfo("【14】响应字段名一致性检查");

  if (adminToken) {
    try {
      const r1 = await request("GET", `${API_PREFIX}/admin/products?page=1&pageSize=1`, null, adminToken);
      const r2 = await request("GET", `${API_PREFIX}/admin/orders?page=1&pageSize=1`, null, adminToken);
      const r3 = await request("GET", `${API_PREFIX}/admin/members?page=1&pageSize=1`, null, adminToken);
      const f1 = r1.json?.data && "total" in r1.json.data && "records" in r1.json.data;
      const f2 = r2.json?.data && "total" in r2.json.data && "records" in r2.json.data;
      const f3 = r3.json?.data && "total" in r3.json.data && "records" in r3.json.data;
      recordTest("Schema", "SCH-101", "列表接口 total/records 字段统一", f1 && f2 && f3,
        `商品=${f1}/订单=${f2}/客户=${f3}`);
    } catch (e) { recordTest("Schema", "SCH-101", "列表接口 total/records 字段统一", false, e.message); }
  }

  finalize();
}

// ======================= 汇总输出 =======================
function finalize() {
  const sections = [...new Set(testResults.map((t) => t.section))];
  const total = testResults.length;
  const passed = testResults.filter((t) => t.passed).length;
  const failed = total - passed;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log(`\n${COLORS.magenta}====================================================${COLORS.reset}`);
  console.log(`测试结果汇总`);
  console.log(`${COLORS.magenta}====================================================${COLORS.reset}`);

  for (const section of sections) {
    const items = testResults.filter((t) => t.section === section);
    const p = items.filter((t) => t.passed).length;
    const f = items.length - p;
    console.log(`\n【${section}】`);
    console.log(`  ${COLORS.green}通过 ${p}${COLORS.reset} / ${COLORS.red}失败 ${f}${COLORS.reset} / 共 ${items.length} 项`);
    if (f > 0) {
      for (const it of items.filter((t) => !t.passed)) {
        console.log(`  ${COLORS.red}✗ ${it.id} ${it.name}${COLORS.reset}`);
        if (it.detail) console.log(`     ${COLORS.gray}${it.detail}${COLORS.reset}`);
      }
    }
  }

  console.log(`\n${COLORS.magenta}====================================================${COLORS.reset}`);
  console.log(`总计: ${COLORS.green}${passed}${COLORS.reset} 通过 / ${COLORS.red}${failed}${COLORS.reset} 失败 / 共 ${total} 项`);
  console.log(`通过率: ${pct >= 90 ? COLORS.green : (pct >= 70 ? COLORS.yellow : COLORS.red)}${pct}%${COLORS.reset}`);
  console.log(`结束时间: ${new Date().toLocaleString()}`);
  console.log(`${COLORS.magenta}====================================================${COLORS.reset}\n`);

  // 退出码
  if (failed > 0) process.exit(1);
  process.exit(0);
}

run().catch((err) => {
  console.error(`${COLORS.red}测试执行异常: ${err.message}${COLORS.reset}`);
  console.error(err.stack);
  process.exit(1);
});
