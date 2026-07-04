import { hashPasswordSync } from "./password.js";

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
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "OFFLINE", physicalQty: 2, lockedQty: 0, availableQty: 2 }
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

export function result(insertId: number = Date.now()) {
  return [{ insertId, affectedRows: 1 }, undefined] as any;
}

const initialState = JSON.parse(JSON.stringify(state));

export function resetMockDb() {
  Object.keys(initialState).forEach((key) => {
    (state as any)[key] = JSON.parse(JSON.stringify(initialState[key]));
  });
}