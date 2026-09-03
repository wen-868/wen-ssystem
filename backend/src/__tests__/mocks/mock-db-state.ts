import { hashPasswordSync } from "../../shared/password";

export type Row = Record<string, any>;

export const state = {
  users: [
    { id: 1, username: "admin", password_hash: hashPasswordSync("admin123"), real_name: "系统管理员", store_id: null, status: 1, tenant_id: "default" },
    // 门店/商家端登录账号（qa-regression-test 门店端场景使用）
    { id: 2, username: "store_manager", password_hash: hashPasswordSync("admin123"), real_name: "门店经理", store_id: 1, status: 1, tenant_id: "default" }
  ],
  roles: [
    { id: 1, role_code: "SUPER_ADMIN", role_name: "超级管理员", status: 1 }
  ],
  userRoles: [
    { user_id: 1, role_code: "SUPER_ADMIN" }
  ],
  members: [
    { id: 1, name: "默认零售客户", mobile: "13900000000", customer_type: "RETAIL", settlement_type: "CASH", points: 120, level_code: "NORMAL", status: 1, staff_id: null as number | null },
    { id: 2, name: "默认批发客户", mobile: "13900000001", customer_type: "WHOLESALE", settlement_type: "ACCOUNT", points: 0, level_code: "WHOLESALE", status: 1, staff_id: 1 }
  ] as Row[],
  stores: [
    { id: 1, store_code: "STORE0001", name: "默认门店", address: "演示地址", contact: "管理员", phone: "13800000000", delivery_radius: 3, business_status: "OPEN", status: 1, miniapp_appid: 'wx0000000000000000', wx_merchant_name: null, wx_service_phone: null, wx_head_img: null, wx_qrcode_url: null }
  ] as Row[],
  productCategories: [
    { id: 1, name: "白酒", parentId: null, sortNo: 1, status: 1 },
    { id: 2, name: "啤酒", parentId: null, sortNo: 2, status: 1 },
    { id: 3, name: "葡萄酒", parentId: null, sortNo: 3, status: 1 },
    { id: 4, name: "洋酒", parentId: null, sortNo: 4, status: 1 },
    { id: 5, name: "其他", parentId: null, sortNo: 5, status: 1 }
  ] as Row[],
  products: [
    { spuId: 1, skuId: 1, categoryId: 1, name: "示例白酒 53度 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=Wine", skuName: "示例白酒 53度 500ml 常温", skuCode: "SKU-DEMO-001", barcode: "690000000001", retailPrice: 129, wholesalePrice: 99, miniappPrice: 119, costPrice: 0, storePrice: null as number | null, status: "ON_SALE" },
    { spuId: 2, skuId: 2, categoryId: 1, name: "茅台飞天 53度 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=MT", skuName: "茅台飞天 53度 500ml 单瓶", skuCode: "SKU-MT-53", barcode: "6901234567001", retailPrice: 1499, wholesalePrice: 1399, miniappPrice: 1450, costPrice: 1100, storePrice: 1499, status: "ON_SALE" },
    { spuId: 3, skuId: 3, categoryId: 1, name: "五粮液 52度 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=WLY", skuName: "五粮液 52度 500ml 单瓶", skuCode: "SKU-WLY-52", barcode: "6901234567002", retailPrice: 1099, wholesalePrice: 999, miniappPrice: 1060, costPrice: 800, storePrice: 1099, status: "ON_SALE" },
    { spuId: 4, skuId: 4, categoryId: 2, name: "青岛啤酒 经典10度 330ml", mainImage: "https://dummyimage.com/120x120/0b6e4f/ffffff&text=QD", skuName: "青岛啤酒 经典10度 330ml 罐装", skuCode: "SKU-QD-TS", barcode: "6901234567003", retailPrice: 6, wholesalePrice: 4.5, miniappPrice: 5.5, costPrice: 3, storePrice: 6, status: "ON_SALE" },
    { spuId: 5, skuId: 5, categoryId: 2, name: "雪花啤酒 勇闯天涯 500ml", mainImage: "https://dummyimage.com/120x120/0b6e4f/ffffff&text=XH", skuName: "雪花啤酒 勇闯天涯 500ml 瓶装", skuCode: "SKU-SN-TS", barcode: "6901234567004", retailPrice: 5, wholesalePrice: 3.8, miniappPrice: 4.6, costPrice: 2.5, storePrice: 5, status: "ON_SALE" },
    { spuId: 6, skuId: 6, categoryId: 3, name: "张裕干红葡萄酒 750ml", mainImage: "https://dummyimage.com/120x120/5b2d8e/ffffff&text=ZY", skuName: "张裕干红葡萄酒 750ml 单瓶", skuCode: "SKU-ZY-DR", barcode: "6901234567005", retailPrice: 88, wholesalePrice: 72, miniappPrice: 82, costPrice: 55, storePrice: 88, status: "ON_SALE" },
    { spuId: 7, skuId: 7, categoryId: 4, name: "轩尼诗VSOP 干邑白兰地 700ml", mainImage: "https://dummyimage.com/120x120/7a4a1a/ffffff&text=HNS", skuName: "轩尼诗VSOP 干邑白兰地 700ml 单瓶", skuCode: "SKU-HX-VS", barcode: "6901234567007", retailPrice: 980, wholesalePrice: 880, miniappPrice: 950, costPrice: 700, storePrice: 980, status: "ON_SALE" },
    { spuId: 8, skuId: 8, categoryId: 5, name: "茅台王子酒 酱香经典 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=MTWZ", skuName: "茅台王子酒 酱香经典 500ml 单瓶", skuCode: "SKU-MT-JC", barcode: "6901234567009", retailPrice: 428, wholesalePrice: 388, miniappPrice: 410, costPrice: 300, storePrice: 428, status: "ON_SALE" },
    { spuId: 9, skuId: 9, categoryId: 5, name: "剑南春 水晶剑 52度 500ml", mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=JNC", skuName: "剑南春 水晶剑 52度 500ml 单瓶", skuCode: "SKU-JNC-52", barcode: "6901234567010", retailPrice: 468, wholesalePrice: 428, miniappPrice: 450, costPrice: 320, storePrice: 468, status: "ON_SALE" }
  ] as Row[],
  inventory: [
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "ONLINE", physicalQty: 120, lockedQty: 0, availableQty: 120 },
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "OFFLINE", physicalQty: 9999, lockedQty: 0, availableQty: 9999 },
    { storeId: 1, skuId: 2, skuName: "茅台飞天 53度 500ml 单瓶", stockType: "OFFLINE", physicalQty: 20, lockedQty: 0, availableQty: 20 },
    { storeId: 1, skuId: 3, skuName: "五粮液 52度 500ml 单瓶", stockType: "OFFLINE", physicalQty: 35, lockedQty: 0, availableQty: 35 },
    { storeId: 1, skuId: 4, skuName: "青岛啤酒 经典10度 330ml 罐装", stockType: "OFFLINE", physicalQty: 480, lockedQty: 0, availableQty: 480 },
    { storeId: 1, skuId: 5, skuName: "雪花啤酒 勇闯天涯 500ml 瓶装", stockType: "OFFLINE", physicalQty: 360, lockedQty: 0, availableQty: 360 },
    { storeId: 1, skuId: 6, skuName: "张裕干红葡萄酒 750ml 单瓶", stockType: "OFFLINE", physicalQty: 58, lockedQty: 0, availableQty: 58 },
    { storeId: 1, skuId: 7, skuName: "轩尼诗VSOP 干邑白兰地 700ml 单瓶", stockType: "OFFLINE", physicalQty: 12, lockedQty: 0, availableQty: 12 },
    { storeId: 1, skuId: 8, skuName: "茅台王子酒 酱香经典 500ml 单瓶", stockType: "OFFLINE", physicalQty: 45, lockedQty: 0, availableQty: 45 },
    { storeId: 1, skuId: 9, skuName: "剑南春 水晶剑 52度 500ml 单瓶", stockType: "OFFLINE", physicalQty: 52, lockedQty: 0, availableQty: 52 },
    { storeId: 1, skuId: 2, skuName: "茅台飞天 53度 500ml 单瓶", stockType: "ONLINE", physicalQty: 18, lockedQty: 0, availableQty: 18 },
    { storeId: 1, skuId: 3, skuName: "五粮液 52度 500ml 单瓶", stockType: "ONLINE", physicalQty: 30, lockedQty: 0, availableQty: 30 },
    { storeId: 1, skuId: 4, skuName: "青岛啤酒 经典10度 330ml 罐装", stockType: "ONLINE", physicalQty: 400, lockedQty: 0, availableQty: 400 },
    { storeId: 1, skuId: 5, skuName: "雪花啤酒 勇闯天涯 500ml 瓶装", stockType: "ONLINE", physicalQty: 300, lockedQty: 0, availableQty: 300 },
    { storeId: 1, skuId: 6, skuName: "张裕干红葡萄酒 750ml 单瓶", stockType: "ONLINE", physicalQty: 50, lockedQty: 0, availableQty: 50 },
    { storeId: 1, skuId: 7, skuName: "轩尼诗VSOP 干邑白兰地 700ml 单瓶", stockType: "ONLINE", physicalQty: 10, lockedQty: 0, availableQty: 10 },
    { storeId: 1, skuId: 8, skuName: "茅台王子酒 酱香经典 500ml 单瓶", stockType: "ONLINE", physicalQty: 40, lockedQty: 0, availableQty: 40 },
    { storeId: 1, skuId: 9, skuName: "剑南春 水晶剑 52度 500ml 单瓶", stockType: "ONLINE", physicalQty: 48, lockedQty: 0, availableQty: 48 }
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
  notifications: [
    { id: 1, recipient_id: 1, recipient_type: "ADMIN", title: "系统通知：欢迎使用", content: "欢迎使用智享全链管理系统，请及时完善店铺资料。", type: "SYSTEM", related_id: null, related_type: null, is_read: 0, sent_at: "2026-08-14 10:00:00", read_at: null, created_at: "2026-08-14 10:00:00", tenant_id: "default" },
    { id: 2, recipient_id: 1, recipient_type: "ADMIN", title: "库存预警：示例白酒低于安全库存", content: "商品「示例白酒 53度 500ml」当前可用库存低于预警阈值，请及时补货。", type: "ALERT", related_id: 1, related_type: "PRODUCT", is_read: 1, sent_at: "2026-08-14 11:00:00", read_at: "2026-08-14 11:05:00", created_at: "2026-08-14 11:00:00", tenant_id: "default" },
  ] as Row[],
  operationLogs: [
    { id: 1, operator_id: 1, operator_name: "系统管理员", module: "ORDER", action: "CREATE", biz_no: "SO20260814001", target_id: null, target_type: null, before_data: null, after_data: JSON.stringify({ orderNo: "SO20260814001", amount: 129 }), ip: "127.0.0.1", user_agent: "mock", remark: "创建销售单", created_at: "2026-08-14 10:30:00", tenant_id: "default" },
  ] as Row[],
  reportPermissionAuditLogs: [
    { id: 1, operator_id: 1, operator_name: "系统管理员", action: "UPDATE", target_type: "ROLE", target_id: 1, target_name: "超级管理员", report_code: "sales_summary", before_value: JSON.stringify({ canView: false }), after_value: JSON.stringify({ canView: true }), remark: "更新权限矩阵", created_at: "2026-08-14 10:35:00", tenant_id: "default" },
  ] as Row[],
  reportPermissionMatrix: [
    { id: 1, role_id: 1, report_code: "sales_summary", store_scope: "SELF", can_view: 1, can_export: 0, store_ids: null, tenant_id: "default" },
  ] as Row[],
  errorLogs: [] as Row[],
  platformCredentials: [] as Row[],
  platformOrders: [] as Row[],
  platformAdmins: [
    { id: 1, username: "platform_admin", password: hashPasswordSync("admin123"), real_name: "平台管理员", email: "admin@onepan.cn", phone: "13800000000", role: "SUPER_ADMIN", status: 1 }
  ],
  // ===== 第一/二阶段新增表 =====
  // 供应商种子（与真实库同构；mock 重启后仍保留，供本地预览/QA 回归使用）
  suppliers: [
    {
      id: 1,
      supplier_code: "GYS2026090363210",
      name: "贵州茅台酒厂集团电商平台",
      short_name: "茅台电商",
      category: "酒类批发",
      province: "贵州省",
      city: "贵阳市",
      district: "观山湖区",
      address: "贵州省贵阳市观山湖区金融城T1座",
      credit_level: "B",
      settlement_type: "MONTHLY",
      settlement_day: 5,
      tax_rate: 0.13,
      bank_name: "工商银行贵阳分行",
      bank_account: "6222020200112233445",
      bank_account_name: "贵州茅台酒厂集团电商平台",
      status: 1,
      remark: "战略合作伙伴，月结45天",
      tenant_id: "default",
      created_at: "2026-09-02T23:34:00.494Z",
      updated_at: "2026-09-02T23:34:00.494Z",
    },
  ] as Row[],
  supplierContacts: [
    {
      id: 1,
      supplier_id: 1,
      name: "贵州茅台酒厂集团电商平台",
      mobile: null,
      phone: null,
      email: null,
      wechat: null,
      is_primary: 0,
      position: null,
      remark: "战略合作伙伴，月结45天",
      created_at: "2026-09-02T23:34:00.494Z",
    },
  ] as Row[],
  // t_tenant（本地 mock 预览种子：与真实库同构，getTenantInfo /admin/sys-config/tenant-info 读取）
  tenants: [
    {
      id: "default",
      tenant_code: "T20260623001",
      company_name: "智享全链酒业有限公司",
      company_short_name: "智享全链",
      contact_person: "系统管理员",
      contact_mobile: "13800000000",
      contact_email: "admin@onepan.cn",
      province: "贵州省",
      city: "贵阳市",
      district: "观山湖区",
      address: "贵州省贵阳市观山湖区金融城 T1 座 28 层",
      business_license: "91520115MA6DK3XY7A",
      tax_no: "91520115MA6DK3XY7B",
      legal_person: "张伟",
      industry: "酒类批零",
      company_scale: "11-50人",
      status: "ACTIVE",
      tenant_id: "default",
    },
  ] as Row[],
  // t_bank_account（公司收款银行卡种子，/admin/bank-accounts 读取）
  bankAccounts: [
    {
      id: 1,
      account_name: "智享全链酒业有限公司",
      bank_name: "工商银行贵阳金融城支行",
      account_no: "6222022400012345678",
      account_type: "GENERAL",
      balance: 186500.5,
      status: "ACTIVE",
      created_at: "2026-08-20 10:00:00",
      updated_at: "2026-08-20 10:00:00",
      tenant_id: "default",
    },
    {
      id: 2,
      account_name: "智享全链酒业有限公司",
      bank_name: "建设银行贵阳观山湖支行",
      account_no: "6217002350019876543",
      account_type: "GENERAL",
      balance: 42000,
      status: "ACTIVE",
      created_at: "2026-08-25 15:30:00",
      updated_at: "2026-08-25 15:30:00",
      tenant_id: "default",
    },
  ] as Row[],
  purchaseOrders: [
    {
      id: 1,
      order_no: "CGDD2026090343798",
      supplier_id: 1,
      supplier_name: "贵州茅台酒厂集团电商平台",
      store_id: 1,
      order_status: "DRAFT",
      goods_amount: 53964,
      tax_amount: 7015.32,
      discount_amount: 0,
      payable_amount: 60979.32,
      paid_amount: 0,
      unpaid_amount: 60979.32,
      expected_date: "2026-09-18",
      operator_id: 1,
      remark: null,
      tenant_id: "default",
      warehouse_status: "NONE",
      created_at: "2026-09-02T23:34:29.749Z",
      updated_at: "2026-09-02T23:34:29.749Z",
    },
    {
      id: 2,
      order_no: "CGDD2026090375698",
      supplier_id: 1,
      supplier_name: "贵州茅台酒厂集团电商平台",
      store_id: 1,
      order_status: "DRAFT",
      goods_amount: 19782,
      tax_amount: 2571.66,
      discount_amount: 0,
      payable_amount: 22353.66,
      paid_amount: 0,
      unpaid_amount: 22353.66,
      expected_date: "2026-09-18",
      operator_id: 1,
      remark: null,
      tenant_id: "default",
      warehouse_status: "NONE",
      created_at: "2026-09-02T23:34:29.749Z",
      updated_at: "2026-09-02T23:34:29.749Z",
    },
  ] as Row[],
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
