import { hashPasswordSync } from "../../shared/password";

export type Row = Record<string, any>;

export const state = {
  users: [
    { id: 1, username: "admin", password_hash: hashPasswordSync("admin123"), real_name: "系统管理员", store_id: null, status: 1, tenant_id: "default" },
    { id: 2, username: "store_manager", password_hash: hashPasswordSync("admin123"), real_name: "默认店长", store_id: 1, status: 1, tenant_id: "default" },
    { id: 3, username: "store_operator", password_hash: hashPasswordSync("admin123"), real_name: "默认店员", store_id: 1, status: 1, tenant_id: "default" }
  ],
  roles: [
    { id: 1, role_code: "SUPER_ADMIN", role_name: "超级管理员", status: 1 },
    { id: 2, role_code: "STORE_MANAGER", role_name: "门店店长", status: 1 },
    { id: 3, role_code: "STORE_OPERATOR", role_name: "门店操作员", status: 1 }
  ],
  userRoles: [
    { user_id: 1, role_code: "SUPER_ADMIN" },
    { user_id: 2, role_code: "STORE_MANAGER" },
    { user_id: 3, role_code: "STORE_OPERATOR" }
  ],
  members: [
    { id: 1, name: "默认零售客户", mobile: "13900000000", customer_type: "RETAIL", settlement_type: "CASH", points: 120, level_code: "NORMAL", status: 1, staff_id: null as number | null },
    { id: 2, name: "默认批发客户", mobile: "13900000001", customer_type: "WHOLESALE", settlement_type: "ACCOUNT", points: 0, level_code: "WHOLESALE", status: 1, staff_id: 1 }
  ] as Row[],
  stores: [
    { id: 1, store_code: "STORE0001", name: "默认门店", address: "演示地址", contact: "管理员", phone: "13800000000", delivery_radius: 3, business_status: "OPEN", status: 1, miniapp_appid: 'wx0000000000000000', wx_merchant_name: null, wx_service_phone: null, wx_head_img: null, wx_qrcode_url: null }
  ] as Row[],
  products: [
    { spuId: 1, skuId: 1, name: "示例白酒 53度 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=Wine", skuName: "示例白酒 53度 500ml 常温", skuCode: "SKU-DEMO-001", barcode: "690000000001", retailPrice: 129, wholesalePrice: 99, miniappPrice: 119, costPrice: 0, storePrice: null as number | null, status: "ON_SALE" }
  ] as Row[],
  inventory: [
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "ONLINE", physicalQty: 120, lockedQty: 0, availableQty: 120 },
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "OFFLINE", physicalQty: 9999, lockedQty: 0, availableQty: 9999 }
  ],
  saleBills: [] as Row[],
  saleBillItems: [] as Row[],
  miniappOrders: [] as Row[],
  miniappOrderItems: [] as Row[],
  collectionLinks: [] as Row[],
  paymentOrders: [] as Row[],
  refundOrders: [] as Row[],
  priceLogs: [] as Row[],
  holdOrders: [] as Row[],
  viewLogs: [] as Row[],
  inventoryLogs: [] as Row[],
  receivables: [] as Row[],
  operationLogs: [] as Row[],
  errorLogs: [] as Row[],
  platformCredentials: [] as Row[],
  platformOrders: [] as Row[],
  // ===== 第一/二阶段新增表 =====
  suppliers: [] as Row[],
  supplierContacts: [] as Row[],
  purchaseOrders: [] as Row[],
  purchaseOrderItems: [] as Row[],
  purchaseInStocks: [] as Row[],
  purchaseInStockItems: [] as Row[],
  purchaseReturns: [] as Row[],
  purchaseReturnItems: [] as Row[],
  purchasePayments: [] as Row[],
  saleReturns: [] as Row[],
  saleReturnItems: [] as Row[],
  customerStatements: [] as Row[],
  customerPayments: [] as Row[],
  salePayments: [] as Row[],
};

export const pendingProduct: {
  spu?: Row;
  sku?: Row;
} = {};

export function result(insertId: number = Date.now()): any {
  // 返回数组形式 [ResultSetHeader, undefined]，同时在数组上挂载 insertId/affectedRows 属性
  // 这样既能匹配 `const [result] = await query(...)` 的解构，也能匹配 `result.insertId` 的直接访问
  const arr: any = [{ insertId, affectedRows: 1 }, undefined];
  arr.insertId = insertId;
  arr.affectedRows = 1;
  return arr;
}

// ========== 表名匹配辅助函数 ==========
// 处理 `t_` 前缀表名匹配问题：业务表用 `t_` 前缀（如 t_purchase_order），系统表无前缀（如 error_logs）
// 这些函数同时匹配带前缀和不带前缀的形式

/** 检查 SQL 是否为 SELECT FROM 指定表（支持 t_ 前缀和无前缀） */
export function fromTable(s: string, table: string): boolean {
  return s.includes(`from ${table}`) || s.includes(`from t_${table}`);
}

/** 检查 SQL 是否为 UPDATE 指定表（支持 t_ 前缀和无前缀） */
export function updateTable(s: string, table: string): boolean {
  return s.includes(`update ${table}`) || s.includes(`update t_${table}`);
}

/** 检查 SQL 是否为 INSERT INTO 指定表（支持 t_ 前缀和无前缀） */
export function insertIntoTable(s: string, table: string): boolean {
  return s.includes(`insert into ${table}`) || s.includes(`insert into t_${table}`);
}

/** 检查 SQL 是否为 DELETE FROM 指定表（支持 t_ 前缀和无前缀） */
export function deleteFromTable(s: string, table: string): boolean {
  return s.includes(`delete from ${table}`) || s.includes(`delete from t_${table}`);
}

const initialState = JSON.parse(JSON.stringify(state));

type StateKey = keyof typeof state;

export function resetMockDb() {
  Object.keys(initialState).forEach((key) => {
    (state as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(initialState[key as StateKey]));
  });
}