import { hashPasswordSync } from "./password.js";

type Row = Record<string, any>;

const state = {
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
    { id: 1, store_code: "STORE0001", name: "默认门店", address: "演示地址", contact: "管理员", phone: "13800000000", delivery_radius: 3, business_status: "OPEN", status: 1, miniapp_appid: '1442871774', wx_merchant_name: null, wx_service_phone: null, wx_head_img: null, wx_qrcode_url: null }
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

const pendingProduct: {
  spu?: Row;
  sku?: Row;
} = {};

function result(insertId: number = Date.now()) {
  return [{ insertId, affectedRows: 1 }, undefined] as any;
}

export async function mockQuery<T = any>(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");

  if (s.includes("from sys_user where username")) {
    return state.users.filter((u) => u.username === params[0]) as T[];
  }
  if (s.includes("from sys_user_role") && s.includes("join sys_role")) {
    const userId = Number(params[0]);
    return state.userRoles.filter((role) => role.user_id === userId).map((role) => ({ role_code: role.role_code })) as T[];
  }
  if (s.includes("from sys_user") && !s.includes("where username")) {
    return state.users.map((u) => ({
      staffId: u.id,
      id: u.id,
      username: u.username,
      realName: u.real_name,
      storeId: u.store_id,
      status: u.status
    })) as T[];
  }
  if (s.includes("count(*) as total from member")) return [{ total: state.members.length }] as T[];
  if (s.includes("from member") && s.includes("where id = ?")) {
    const member = state.members.find((m) => Number(m.id) === Number(params[0]));
    if (!member) return [] as T[];
    const staff = state.users.find((u) => u.id === member.staff_id);
    return [{
      memberId: member.id,
      id: member.id,
      name: member.name,
      mobile: member.mobile,
      customerType: member.customer_type,
      customer_type: member.customer_type,
      settlementType: member.settlement_type,
      settlement_type: member.settlement_type,
      points: member.points,
      levelCode: member.level_code,
      level_code: member.level_code,
      status: member.status,
      staffId: member.staff_id,
      staffName: staff?.real_name ?? null
    }] as T[];
  }
  if (s.includes("from member")) {
    return state.members.map((member) => {
      const staff = state.users.find((u) => u.id === member.staff_id);
      return {
        memberId: member.id,
        id: member.id,
        name: member.name,
        mobile: member.mobile,
        customerType: member.customer_type,
        customer_type: member.customer_type,
        settlementType: member.settlement_type,
        settlement_type: member.settlement_type,
        points: member.points,
        levelCode: member.level_code,
        level_code: member.level_code,
        status: member.status,
        staffId: member.staff_id,
        staffName: staff?.real_name ?? null
      };
    }) as T[];
  }
  if (s.includes("insert into member")) {
    const id = state.members.length + 1;
    state.members.push({
      id,
      name: params[0],
      mobile: params[1],
      customer_type: params[2],
      settlement_type: params[2] === "WHOLESALE" ? "ACCOUNT" : "CASH",
      points: 0,
      level_code: params[2] === "WHOLESALE" ? "WHOLESALE" : "NORMAL",
      status: 1,
      staff_id: params[3] == null ? null : Number(params[3])
    });
    return [{ insertId: id, affectedRows: 1 }] as T[];
  }
  if (s.includes("update member set staff_id")) {
    const member = state.members.find((m) => Number(m.id) === Number(params[1]));
    if (member) member.staff_id = Number(params[0]);
    return [] as T[];
  }
  if (s.includes("from store") && s.includes("count(*)")) return [{ total: state.stores.length }] as T[];
  if (s.includes("from store") && !s.includes("group by") && !s.includes("join")) {
    return state.stores.map((st) => ({
      id: st.id,
      storeCode: st.store_code,
      name: st.name,
      address: st.address,
      contact: st.contact,
      phone: st.phone,
      deliveryRadius: st.delivery_radius,
      businessStatus: st.business_status,
      status: st.status,
      miniappAppid: st.miniapp_appid ?? null,
      wxMerchantName: st.wx_merchant_name ?? null,
      wxServicePhone: st.wx_service_phone ?? null,
      wxHeadImg: st.wx_head_img ?? null,
      wxQrcodeUrl: st.wx_qrcode_url ?? null
    })) as T[];
  }
  if (s.includes("insert into store")) {
    state.stores.push({
      id: state.stores.length + 1,
      store_code: String(params[0]),
      name: String(params[1]),
      address: String(params[2]),
      contact: params[5] == null ? "" : String(params[5]),
      phone: params[6] == null ? "" : String(params[6]),
      delivery_radius: Number(params[7] ?? 3),
      business_status: "OPEN",
      status: 1,
      miniapp_appid: null,
      wx_merchant_name: null,
      wx_service_phone: null,
      wx_head_img: null,
      wx_qrcode_url: null
    });
    return [] as T[];
  }
  if (s.includes("from product_sku") && s.includes("count(*)")) return [{ total: state.products.length }] as T[];
  if (s.includes("from sale_bill_item") && s.includes("join sale_bill") && s.includes("customer_id")) {
    const memberId = Number(params[0]);
    const skuId = Number(params[1]);
    const bills = state.saleBills.filter((b) => Number(b.customerId ?? b.customer_id) === memberId);
    const records = bills.flatMap((bill) =>
      state.saleBillItems
        .filter((item) => (item.billNo === bill.billNo || item.bill_no === bill.bill_no) && Number(item.skuId ?? item.sku_id) === skuId)
        .map((item) => ({
          skuId: item.skuId,
          skuName: item.skuName,
          unitPrice: item.unitPrice,
          billNo: bill.billNo,
          createdAt: bill.createdAt
        }))
    );
    return records as T[];
  }
  if (s.includes("select s.sku_name") && s.includes("from product_sku s") && s.includes("join product_price")) {
    const product = state.products.find((p) => p.skuId === params[0]);
    return product
      ? [{
          sku_name: product.skuName,
          retail_price: product.retailPrice,
          wholesale_price: product.wholesalePrice,
          miniapp_price: product.miniappPrice,
          store_price: product.storePrice
        }] as T[]
      : [];
  }
  if (s.includes("from product_sku") && s.includes("join product_spu") && s.includes("join product_price")) {
    return state.products.map((product) => {
      const offline = state.inventory.find((inv) => inv.skuId === product.skuId && inv.stockType === "OFFLINE");
      const online = state.inventory.find((inv) => inv.skuId === product.skuId && inv.stockType === "ONLINE");
      return {
        ...product,
        productName: product.name,
        storePrice: product.storePrice ?? product.retailPrice,
        availableQty: online?.availableQty ?? 0,
        available_qty: online?.availableQty ?? 0,
        offlineAvailableQty: offline?.availableQty ?? 0
      };
    }) as T[];
  }
  if (s.includes("update inventory_balance")) {
    const stockType = params.length >= 5 ? params[4] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : (s.includes("stock_type = 'online'") ? "ONLINE" : params[4]));
    const inv = state.inventory.find(
      (i) => i.storeId === params[2] && i.skuId === params[3] && i.stockType === stockType
    );
    if (inv) {
      if (s.includes("locked_qty = locked_qty +")) {
        inv.lockedQty = Number(inv.lockedQty) + Number(params[0]);
        inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
      } else if (s.includes("physical_qty = physical_qty -") && s.includes("locked_qty = greatest(locked_qty -")) {
        // 配送完成：扣 physical_qty 和 locked_qty
        inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
        inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[2]));
      } else if (s.includes("physical_qty = physical_qty -")) {
        // 门店销售：扣 physical_qty 和 available_qty
        inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
        inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
      } else if (s.includes("locked_qty = greatest(locked_qty -")) {
        inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[0]));
        inv.availableQty = Number(inv.availableQty) + Number(params[1]);
      } else {
        const direction = 1;
        inv.physicalQty = Number(inv.physicalQty) + direction * Number(params[0]);
        inv.availableQty = Number(inv.availableQty) + direction * Number(params[1]);
      }
    }
    return [] as T[];
  }
  if (s.includes("from inventory_balance") && s.includes("left join store")) {
    const isAlert = s.includes("where ib.available_qty <= 5");
    const filtered = isAlert
      ? state.inventory.filter((inv: Row) => (inv.availableQty ?? 0) <= 5)
      : state.inventory;
    return filtered.map((inv: Row) => {
      const store = state.stores.find((st: Row) => st.id === inv.storeId);
      const base: any = {
        storeId: inv.storeId,
        storeName: store?.name ?? "",
        skuId: inv.skuId,
        skuName: inv.skuName,
        stockType: inv.stockType,
        availableQty: inv.availableQty,
      };
      if (!isAlert) {
        base.physicalQty = inv.physicalQty;
        base.lockedQty = inv.lockedQty;
      }
      return base;
    }) as T[];
  }
  if (s.includes("from inventory_balance") && s.includes("physical_qty") && s.includes("where store_id")) {
    const stockType = params.length >= 3 ? params[2] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : params[2]);
    const inv = state.inventory.find(
      (i) => i.storeId === params[0] && i.skuId === params[1] && i.stockType === stockType
    );
    return inv ? [{ physicalQty: inv.physicalQty, physical_qty: inv.physicalQty, lockedQty: inv.lockedQty, locked_qty: inv.lockedQty, availableQty: inv.availableQty, available_qty: inv.availableQty }] as T[] : [] as T[];
  }
  if (s.includes("from inventory_balance")) return state.inventory as T[];
  if (s.includes("select id from inventory_ledger") && s.includes("biz_type = 'sale_out'")) {
    return state.inventoryLogs
      .filter((log) => log.bizType === "SALE_OUT" && log.bizNo === params[0])
      .map((log) => ({ id: log.id ?? log.logNo })) as T[];
  }
  if ((s.includes("from inventory_log") || s.includes("from inventory_ledger")) && s.includes("count(*)")) {
    return [{ total: state.inventoryLogs.length }] as T[];
  }
  if (s.includes("from inventory_log") || s.includes("from inventory_ledger")) return state.inventoryLogs as T[];
  if (s.includes("sum(received_amount)")) {
    const amount = state.saleBills.reduce((sum, b) => sum + Number(b.receivedAmount || b.received_amount || 0), 0);
    return [{ amount, count: state.saleBills.length }] as T[];
  }
  if (s.includes("sum(unreceived_amount)")) {
    const amount = state.saleBills.reduce((sum, b) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
    return [{ amount }] as T[];
  }
  if (s.includes("count(*) as cnt from miniapp_order")) {
    if (s.includes("pending_payment")) {
      const queryStoreId = Number(params[0]);
      const pool = queryStoreId && !Number.isNaN(queryStoreId)
        ? state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId)
        : state.miniappOrders;
      const cnt = pool.filter((o: Row) => (o.orderStatus || o.order_status) === "PENDING_PAYMENT").length;
      return [{ cnt }] as T[];
    }
    if (s.includes("store_id")) {
      const queryStoreId = Number(params[0]);
      const cnt = state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId).length;
      return [{ cnt }] as T[];
    }
    return [{ cnt: state.miniappOrders.length }] as T[];
  }
  if (s.includes("order_status as status") && s.includes("from miniapp_order")) {
    const map = new Map<string, number>();
    for (const order of state.miniappOrders) {
      const st = String(order.order_status ?? order.orderStatus ?? "未知");
      map.set(st, (map.get(st) || 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count })) as T[];
  }
  if (s.includes("from miniapp_order") && s.includes("count(*)")) {
    const statusIndex = s.includes("order_status = ?") ? 0 : -1;
    const filtered = statusIndex >= 0
      ? state.miniappOrders.filter((o) => (o.orderStatus || o.order_status) === params[statusIndex])
      : state.miniappOrders;
    return [{ total: filtered.length, count: filtered.length }] as T[];
  }
  if (s.includes("from miniapp_order") && s.includes("where order_no = ?")) {
    const order = state.miniappOrders.find((o) => o.orderNo === params[0] || o.order_no === params[0]);
    return order ? [order] as T[] : [];
  }
  if (s.includes("from miniapp_order") && !s.includes("group by") && !s.includes("count(*)")) {
    const statusIndex = s.includes("order_status = ?") ? 0 : -1;
    const filtered = statusIndex >= 0
      ? state.miniappOrders.filter((o) => (o.orderStatus || o.order_status) === params[statusIndex])
      : state.miniappOrders;
    return filtered as T[];
  }
  if (s.includes("from miniapp_order_item") && s.includes("where order_no = ?")) {
    const result = state.miniappOrderItems.filter((item) => item.orderNo === params[0] || item.order_no === params[0]);
    return result as T[];
  }
  if (s.includes("update miniapp_order")) {
    const order = state.miniappOrders.find((o) => o.orderNo === params[0] || o.order_no === params[0]);
    if (order && s.includes("accepted")) {
      order.orderStatus = "ACCEPTED";
      order.order_status = "ACCEPTED";
    }
    if (order && s.includes("completed")) {
      order.orderStatus = "COMPLETED";
      order.order_status = "COMPLETED";
      order.deliveryStatus = "COMPLETED";
      order.delivery_status = "COMPLETED";
    }
    if (order && s.includes("order_status = 'delivering'")) {
      order.orderStatus = "DELIVERING";
      order.order_status = "DELIVERING";
      order.deliveryStatus = "DELIVERING";
      order.delivery_status = "DELIVERING";
    }
    if (order && s.includes("order_status = 'rejected'")) {
      order.orderStatus = "REJECTED";
      order.order_status = "REJECTED";
      order.deliveryStatus = "REJECTED";
      order.delivery_status = "REJECTED";
    }
    if (order && s.includes("order_status = 'cancelled'")) {
      order.orderStatus = "CANCELLED";
      order.order_status = "CANCELLED";
      order.deliveryStatus = "CANCELLED";
      order.delivery_status = "CANCELLED";
    }
    return [] as T[];
  }
  if ((s.includes("date(created_at)") || s.includes("date(sb.created_at)")) && s.includes("from sale_bill") && s.includes("group by")) {
    const map = new Map<string, { date: string; count: number; amount: number }>();
    for (const bill of state.saleBills) {
      const d = (bill.createdAt as string).slice(0, 10);
      const entry = map.get(d) || { date: d, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(bill.receivableAmount || bill.receivable_amount || 0);
      map.set(d, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)) as T[];
  }
  if (s.includes("left join sale_bill") && s.includes("group by")) {
    return state.stores.map((st: Row) => {
      const bills = state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === st.id);
      const total = bills.reduce((sum: number, b: Row) => sum + Number(b.receivableAmount || b.receivable_amount || 0), 0);
      return { storeId: st.id, storeName: st.name, totalSales: total, billCount: bills.length };
    }) as T[];
  }
  if (s.includes("coalesce(sum(receivable_amount")) {
    const queryStoreId = Number(params[0]);
    const bills = queryStoreId && !Number.isNaN(queryStoreId)
      ? state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === queryStoreId)
      : state.saleBills;
    const total = bills.reduce((sum: number, b: Row) => sum + Number(b.receivableAmount || b.receivable_amount || 0), 0);
    return [{ total }] as T[];
  }
  if (s.includes("coalesce(sum(unreceived_amount")) {
    const queryStoreId = Number(params[0]);
    const bills = queryStoreId && !Number.isNaN(queryStoreId)
      ? state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === queryStoreId)
      : state.saleBills;
    const total = bills.reduce((sum: number, b: Row) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
    return [{ total }] as T[];
  }
  if (s.includes("from sale_bill where") && s.includes("count(*)")) return [{ total: state.saleBills.length }] as T[];
  if (s.includes("from sale_bill_item where bill_no")) {
    return state.saleBillItems.filter((i) => i.billNo === params[0] || i.bill_no === params[0]) as T[];
  }
  if (s.includes("from sale_bill where bill_no = ?")) {
    const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
    return bill ? [bill] as T[] : [];
  }
  if (s.includes("from sale_bill ") && !s.includes("join") && !s.includes("group by")) return state.saleBills as T[];
  if (s.includes("insert into collection_link")) {
    state.collectionLinks.push({
      linkNo: params[0],
      sourceType: "SALE_BILL",
      sourceNo: params[1],
      amount: params[2],
      paidAmount: 0,
      status: "PENDING",
      shareChannel: params[3],
      expireAt: new Date(Date.now() + Number(params[5]) * 3600_000).toISOString(),
      token: params[6],
      taxEnabled: Boolean(params[7]),
      taxRate: Number(params[8] ?? 0),
      taxAmount: Number(params[9] ?? 0)
    });
    return [] as T[];
  }
  if (s.includes("update sale_bill")) {
    if (s.includes("collection_status = 'shared'")) {
      const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
      if (!bill) return [] as T[];
      bill.collectionStatus = "SHARED";
      bill.collection_status = "SHARED";
      return [] as T[];
    }
    if (s.includes("received_amount = ?")) {
      const bill = state.saleBills.find((b) => b.billNo === params[3] || b.bill_no === params[3]);
      if (!bill) return [] as T[];
      const received = Number(params[0]);
      const unreceived = Math.max(Number(bill.receivableAmount ?? bill.receivable_amount ?? 0) - Number(params[1]), 0);
      bill.receivedAmount = received;
      bill.received_amount = received;
      bill.unreceivedAmount = unreceived;
      bill.unreceived_amount = unreceived;
      bill.collectionStatus = params[2];
      bill.collection_status = params[2];
    }
    return [] as T[];
  }
  if (s.includes("from collection_link") && s.includes("where cl.token")) {
    const link = state.collectionLinks.find((l) => l.token === params[0]);
    if (!link) return [];
    const bill = state.saleBills.find((b) => b.billNo === link.sourceNo);
    return [{ ...link, storeName: "默认门店", customerName: bill?.customerName }] as T[];
  }
  if (s.includes("from collection_link where token")) {
    const link = state.collectionLinks.find((l) => l.token === params[0]);
    return link ? [{ link_no: link.linkNo, amount: link.amount, status: link.status }] as T[] : [];
  }
  if (s.includes("insert into collection_view_log")) {
    state.viewLogs.push({ linkNo: params[0], ip: params[1], userAgent: params[2] });
    return [] as T[];
  }
  if (s.includes("insert into payment_order")) {
    if (s.includes("'sale_bill'")) {
      state.paymentOrders.push({
        payNo: params[0],
        pay_no: params[0],
        sourceType: "SALE_BILL",
        source_type: "SALE_BILL",
        sourceNo: params[1],
        source_no: params[1],
        channel: params[2],
        amount: params[3],
        status: s.includes("'success'") ? "SUCCESS" : "PENDING",
        paymentMethod: params[2],
        payment_method: params[2]
      });
    } else {
      state.paymentOrders.push({ payNo: params[0], sourceType: params[1], sourceNo: params[2], amount: params[3], status: "PENDING" });
    }
    return [] as T[];
  }
  if (s.includes("insert into refund_order")) {
    const pay = state.paymentOrders.find((p) => p.payNo === params[3] || p.pay_no === params[3]);
    state.refundOrders.push({
      refundNo: params[0],
      refund_no: params[0],
      payNo: params[3],
      pay_no: params[3],
      sourceType: pay?.sourceType,
      source_type: pay?.sourceType,
      sourceNo: pay?.sourceNo,
      source_no: pay?.sourceNo,
      amount: params[1],
      reason: params[2],
      status: "PENDING",
      createdAt: new Date().toISOString()
    });
    return [] as T[];
  }
  if (s.includes("insert into hold_order")) {
    state.holdOrders.unshift({
      holdNo: params[0],
      hold_no: params[0],
      storeId: params[1],
      store_id: params[1],
      customerName: params[2],
      customer_name: params[2],
      customerMobile: params[3],
      customer_mobile: params[3],
      amount: params[4],
      payload: params[5],
      remark: params[6],
      status: "HELD",
      createdAt: new Date().toISOString()
    });
    return [] as T[];
  }
  if (s.includes("update hold_order set status = 'DELETED'")) {
    const hold = state.holdOrders.find((h) => h.holdNo === params[0] || h.hold_no === params[0]);
    if (hold) hold.status = "DELETED";
    return [] as T[];
  }
  if (s.includes("select 1 as ok")) return [{ ok: 1 }] as T[];
  if (s.includes("from product_price")) {
    const skuId = Number(params[0]);
    const product = state.products.find((p) => p.skuId === skuId);
    if (!product) return [] as T[];
    return [{
      sku_id: product.skuId,
      cost_price: Number(product.costPrice ?? 0),
      retail_price: Number(product.retailPrice ?? 0),
      wholesale_price: product.wholesalePrice == null ? null : Number(product.wholesalePrice),
      miniapp_price: product.miniappPrice == null ? null : Number(product.miniappPrice),
      store_price: product.storePrice == null ? null : Number(product.storePrice)
    }] as T[];
  }
  if (s.startsWith("update product_price")) {
    const skuId = Number(params[params.length - 1]);
    const product = state.products.find((p) => p.skuId === skuId);
    if (product) {
      if (params[0] != null) (product as any).costPrice = Number(params[0]);
      if (params[1] != null) product.retailPrice = Number(params[1]);
      if (params[2] !== undefined) product.wholesalePrice = params[2] == null ? null : Number(params[2]);
      if (params[3] !== undefined) product.miniappPrice = params[3] == null ? null : Number(params[3]);
      if (params[4] !== undefined) (product as any).storePrice = params[4] == null ? null : Number(params[4]);
    }
    return [] as T[];
  }
  if (s.includes("insert into inventory_log")) {
    state.inventoryLogs.push({
      logNo: String(params[0]),
      storeId: Number(params[1]),
      skuId: Number(params[2]),
      skuName: String(params[3]),
      changeQty: Number(params[4]),
      beforeQty: Number(params[5]),
      afterQty: Number(params[6]),
      reason: String(params[7]),
      operatorName: String(params[8]),
      createdAt: new Date().toISOString()
    });
    return [] as T[];
  }
  if (s.includes("insert into inventory_ledger")) {
    const product = state.products.find((p) => Number(p.skuId) === Number(params[2]));
    const isSaleOut = s.includes("'sale_out'");
    let stockType: string, bizType: string, bizNo: string, changeQty: number, operatorId: unknown, remark: string;
    if (isSaleOut) {
      stockType = "OFFLINE";
      bizType = "SALE_OUT";
      bizNo = String(params[3]);
      changeQty = Number(params[4]);
      operatorId = params[7];
      remark = String(params[9] ?? "");
    } else {
      // 履约类：ORDER_LOCK, ORDER_COMPLETE, ORDER_REJECT, ORDER_CANCEL
      stockType = String(params[3]);
      bizType = String(params[4]);
      bizNo = String(params[5]);
      changeQty = Number(params[6]);
      operatorId = params[11];
      remark = String(params[13] ?? "");
    }
    const beforeQty = 0;
    const afterQty = 0;
    state.inventoryLogs.push({
      id: state.inventoryLogs.length + 1,
      logNo: String(params[0]),
      storeId: Number(params[1]),
      skuId: Number(params[2]),
      skuName: product?.skuName ?? "",
      stockType,
      bizType,
      bizNo,
      changeQty,
      beforeQty,
      afterQty,
      reason: remark,
      operatorId,
      createdAt: new Date().toISOString()
    });
    return [] as T[];
  }
  if (s.includes("count(*) from collection_link")) {
    return [{ total: state.collectionLinks.length }] as T[];
  }
  if (s.includes("from collection_link")) {
    return state.collectionLinks as T[];
  }
  if (s.includes("count(*) from payment_order")) {
    return [{ total: state.paymentOrders.length }] as T[];
  }
  if (s.includes("from payment_order")) {
    return state.paymentOrders as T[];
  }
  if (s.includes("count(*) from refund_order")) {
    return [{ total: state.refundOrders.length }] as T[];
  }
  if (s.includes("from refund_order")) {
    return state.refundOrders as T[];
  }
  if (s.includes("count(*) from hold_order")) {
    return [{ total: state.holdOrders.filter((h) => h.status !== "DELETED").length }] as T[];
  }
  if (s.includes("from hold_order") && s.includes("where hold_no = ?")) {
    const hold = state.holdOrders.find((h) => (h.holdNo === params[0] || h.hold_no === params[0]) && h.status !== "DELETED");
    return hold ? [hold] as T[] : [];
  }
  if (s.includes("from hold_order")) {
    return state.holdOrders.filter((h) => h.status !== "DELETED") as T[];
  }
  if (s.includes("from receivable_account")) {
    if (s.includes("count(*) as total")) {
      return [{ total: state.receivables.length }] as T[];
    }
    if (s.includes("where receivable_no = ?")) {
      const found = state.receivables.find((r) => r.receivableNo === params[0] || r.receivable_no === params[0]);
      return found ? [found] as T[] : [];
    }
    return state.receivables as T[];
  }
  if (s.includes("insert into operation_log")) {
    state.operationLogs.push({
      operatorId: params[0],
      operatorName: params[1],
      module: params[2],
      action: params[3],
      bizNo: params[4],
      afterData: params[5],
      createdAt: new Date().toISOString()
    });
    return [] as T[];
  }

  // error_logs 表 - 监控统计查询
  if (s.includes("from error_logs") && s.includes("count(*) as count")) {
    return [{ count: state.errorLogs.length }] as T[];
  }
  if (s.includes("from error_logs") && s.includes("date(created_at) as date") && s.includes("group by date(created_at)")) {
    const dateMap = new Map<string, number>();
    for (const e of state.errorLogs) {
      const date = (e.created_at || e.createdAt || "").split("T")[0];
      if (date) {
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      }
    }
    const result = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    return result as T[];
  }
  if (s.includes("from error_logs") && s.includes("status_code") && s.includes("group by status_code")) {
    const codeMap = new Map<number, number>();
    for (const e of state.errorLogs) {
      const sc = e.status_code;
      if (sc != null) {
        codeMap.set(sc, (codeMap.get(sc) || 0) + 1);
      }
    }
    const result = Array.from(codeMap.entries()).map(([status_code, count]) => ({ status_code, count }));
    return result as T[];
  }
  // error_logs 表支持
  if (s.includes("from error_logs") && s.includes("count(*) as total")) {
    let filtered = state.errorLogs;
    let paramIdx = 0;
    if (s.includes("error_type = ?")) {
      filtered = filtered.filter((e: Row) => e.error_type === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("severity = ?")) {
      filtered = filtered.filter((e: Row) => e.severity === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("source = ?")) {
      filtered = filtered.filter((e: Row) => e.source === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("message like")) {
      const kw = String(params[paramIdx]).replace(/%/g, "").toLowerCase();
      filtered = filtered.filter((e: Row) =>
        String(e.message || "").toLowerCase().includes(kw) ||
        String(e.request_url || "").toLowerCase().includes(kw)
      );
    }
    return [{ total: filtered.length }] as T[];
  }
  if (s.includes("from error_logs") && s.includes("order by created_at desc")) {
    let filtered = state.errorLogs;
    let paramIdx = 0;
    if (s.includes("error_type = ?")) {
      filtered = filtered.filter((e: Row) => e.error_type === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("severity = ?")) {
      filtered = filtered.filter((e: Row) => e.severity === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("source = ?")) {
      filtered = filtered.filter((e: Row) => e.source === params[paramIdx]);
      paramIdx++;
    }
    if (s.includes("message like")) {
      const kw = String(params[paramIdx]).replace(/%/g, "").toLowerCase();
      filtered = filtered.filter((e: Row) =>
        String(e.message || "").toLowerCase().includes(kw) ||
        String(e.request_url || "").toLowerCase().includes(kw)
      );
      paramIdx += 2;
    }
    const sorted = [...filtered].sort((a: Row, b: Row) =>
      new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
    );
    const pageSize = Number(params[paramIdx]) || 20;
    const offset = Number(params[paramIdx + 1]) || 0;
    return sorted.slice(offset, offset + pageSize) as T[];
  }
  if (s.includes("from error_logs")) {
    return state.errorLogs as T[];
  }
  if (s.includes("insert into error_logs")) {
    const id = state.errorLogs.length + 1;
    state.errorLogs.push({
      id,
      error_type: params[0],
      severity: params[1],
      message: params[2],
      stack: params[3] || null,
      request_url: params[4] || null,
      request_method: params[5] || null,
      status_code: params[6] || null,
      user_id: params[7] || null,
      tenant_id: params[8] || null,
      source: params[9] || "backend",
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    return result(id);
  }
  if (s.includes("delete from error_logs") && s.includes("created_at <")) {
    const retainDays = Number(params[0]) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);
    const beforeLen = state.errorLogs.length;
    state.errorLogs = state.errorLogs.filter((e: Row) => {
      const t = new Date(e.created_at || e.createdAt).getTime();
      return t >= cutoff.getTime();
    });
    return [{ affectedRows: beforeLen - state.errorLogs.length }] as T[];
  }

  // platform_config / platform_order 支持
  if (s.includes("from platform_config") && s.includes("count(*)")) {
    return [{ total: state.platformCredentials.length }] as T[];
  }
  if (s.includes("from platform_config") && s.includes("where platform = ?")) {
    const found = state.platformCredentials.find((c: Row) => c.platform === params[0]);
    return found ? [found] as T[] : [];
  }
  if (s.includes("from platform_config")) {
    return state.platformCredentials as T[];
  }
  if (s.includes("insert into platform_config")) {
    state.platformCredentials.push({
      id: state.platformCredentials.length + 1,
      platform: params[0],
      store_id: params[1],
      storeId: params[1],
      app_key: params[2],
      appKey: params[2],
      app_secret: params[3],
      appSecret: params[3],
      merchant_id: params[4],
      merchantId: params[4],
      config_json: params[5],
      configJson: params[5],
      enabled: params[6] ?? 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return result(state.platformCredentials.length);
  }
  if (s.includes("update platform_config")) {
    const cfg = state.platformCredentials.find((c: Row) => c.platform === params[params.length - 1]);
    if (cfg) {
      if (params[0] != null) { cfg.store_id = params[0]; cfg.storeId = params[0]; }
      if (params[1] != null) { cfg.app_key = params[1]; cfg.appKey = params[1]; }
      if (params[2] != null) { cfg.app_secret = params[2]; cfg.appSecret = params[2]; }
      if (params[3] != null) { cfg.merchant_id = params[3]; cfg.merchantId = params[3]; }
      if (params[4] !== undefined) { cfg.config_json = params[4]; cfg.configJson = params[4]; }
      cfg.updated_at = new Date().toISOString();
    }
    return result();
  }
  if (s.includes("delete from platform_config")) {
    state.platformCredentials = state.platformCredentials.filter((c: Row) => c.platform !== params[0]);
    return result();
  }

  if (s.includes("from platform_order") && s.includes("count(*)")) {
    return [{ total: state.platformOrders.length }] as T[];
  }
  if (s.includes("from platform_order") && s.includes("where platform_order_id = ?")) {
    const found = state.platformOrders.find((o: Row) => o.platformOrderId === params[0] || o.platform_order_id === params[0]);
    return found ? [found] as T[] : [];
  }
  if (s.includes("from platform_order")) {
    return state.platformOrders as T[];
  }
  if (s.includes("insert into platform_order")) {
    const existingIdx = state.platformOrders.findIndex((o: Row) =>
      (o.platformOrderId === params[0] || o.platform_order_id === params[0]) && o.platform === params[1]
    );
    const row = {
      platformOrderId: params[0],
      platform_order_id: params[0],
      platform: params[1],
      store_id: params[2],
      storeId: params[2],
      status: params[3],
      order_data_json: params[4],
      orderDataJson: params[4],
      created_at: params[5] ?? new Date().toISOString(),
      createdAt: params[5] ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      state.platformOrders[existingIdx] = { ...state.platformOrders[existingIdx], ...row };
    } else {
      state.platformOrders.push(row);
    }
    return result();
  }
  if (s.includes("update platform_order")) {
    const order = state.platformOrders.find((o: Row) => o.platformOrderId === params[params.length - 1] || o.platform_order_id === params[params.length - 1]);
    if (order) {
      order.status = params[0];
      order.updated_at = new Date().toISOString();
      order.updatedAt = new Date().toISOString();
    }
    return result();
  }

  // ===== 第一/二阶段新增表支持 =====

  // 供应商相关
  if (s.includes("from supplier") && s.includes("count(*)")) {
    const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === params[0]) : state.suppliers;
    return [{ total: filtered.length }] as T[];
  }
  if (s.includes("from supplier") && s.includes("where id = ?")) {
    const supplier = state.suppliers.find((sup: Row) => sup.id === Number(params[0]));
    if (!supplier) return [] as T[];
    const contacts = state.supplierContacts.filter((c: Row) => c.supplier_id === supplier.id);
    return [{ ...supplier, contacts }] as T[];
  }
  if (s.includes("from supplier") && !s.includes("count(*)")) {
    return state.suppliers as T[];
  }
  if (s.includes("from supplier_contact") && s.includes("where supplier_id")) {
    return state.supplierContacts.filter((c: Row) => c.supplier_id === Number(params[0])) as T[];
  }
  if (s.includes("insert into supplier_contact")) {
    state.supplierContacts.push({
      id: state.supplierContacts.length + 1,
      supplier_id: params[0],
      name: params[1],
      mobile: params[2],
      phone: params[3],
      email: params[4],
      wechat: params[5],
      is_primary: params[6],
      position: params[7],
      remark: params[8],
    });
    return result();
  }
  if (s.includes("delete from supplier_contact")) {
    state.supplierContacts = state.supplierContacts.filter((c: Row) => c.supplier_id !== Number(params[0]));
    return result();
  }
  if (s.includes("delete from supplier") && s.includes("where id")) {
    state.suppliers = state.suppliers.filter((sup: Row) => sup.id !== Number(params[0]));
    return result();
  }
  if (s.includes("count(*) as cnt from purchase_order") && s.includes("where supplier_id")) {
    const cnt = state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0])).length;
    return [{ cnt }] as T[];
  }
  if (s.includes("from purchase_order") && s.includes("count(*)")) {
    return [{ total: state.purchaseOrders.length }] as T[];
  }
  if (s.includes("from purchase_order") && s.includes("where id = ?")) {
    const order = state.purchaseOrders.find((o: Row) => o.id === Number(params[0]));
    return order ? [order] as T[] : [];
  }
  if (s.includes("from purchase_order") && !s.includes("count(*)")) {
    const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0])) : state.purchaseOrders;
    return filtered as T[];
  }
  if (s.includes("from purchase_order_item") && s.includes("where order_no")) {
    return state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]) as T[];
  }
  if (s.includes("from purchase_payment") && s.includes("count(*)")) {
    return [{ total: state.purchasePayments.length }] as T[];
  }
  if (s.includes("from purchase_payment")) {
    const filtered = s.includes("where supplier_id") ? state.purchasePayments.filter((p: Row) => p.supplier_id === Number(params[0])) : state.purchasePayments;
    return filtered as T[];
  }
  if (s.includes("from purchase_order_item poi") && s.includes("join purchase_order po")) {
    return [] as T[];
  }

  // 采购入库相关
  if (s.includes("from purchase_in_stock") && s.includes("count(*)")) {
    return [{ total: state.purchaseInStocks.length }] as T[];
  }
  if (s.includes("from purchase_in_stock") && s.includes("where id = ?")) {
    const stock = state.purchaseInStocks.find((st: Row) => st.id === Number(params[0]));
    return stock ? [stock] as T[] : [];
  }
  if (s.includes("from purchase_in_stock") && !s.includes("count(*)")) {
    return state.purchaseInStocks as T[];
  }
  if (s.includes("from purchase_in_stock_item") && s.includes("where stock_no")) {
    return state.purchaseInStockItems.filter((i: Row) => i.stock_no === params[0]) as T[];
  }

  // 采购退货相关
  if (s.includes("from purchase_return") && s.includes("count(*)")) {
    return [{ total: state.purchaseReturns.length }] as T[];
  }
  if (s.includes("from purchase_return") && !s.includes("count(*)")) {
    return state.purchaseReturns as T[];
  }

  // 销售退货相关
  if (s.includes("from sale_return") && s.includes("count(*)")) {
    return [{ total: state.saleReturns.length }] as T[];
  }
  if (s.includes("from sale_return") && s.includes("where id = ?")) {
    const ret = state.saleReturns.find((r: Row) => r.id === Number(params[0]));
    return ret ? [ret] as T[] : [];
  }
  if (s.includes("from sale_return") && !s.includes("count(*)")) {
    return state.saleReturns as T[];
  }
  if (s.includes("from sale_return_item") && s.includes("where return_no")) {
    return state.saleReturnItems.filter((i: Row) => i.return_no === params[0]) as T[];
  }

  // 客户对账单相关
  if (s.includes("from customer_statement") && s.includes("count(*)")) {
    return [{ total: state.customerStatements.length }] as T[];
  }
  if (s.includes("from customer_statement") && s.includes("where id = ?")) {
    const stmt = state.customerStatements.find((st: Row) => st.id === Number(params[0]));
    return stmt ? [stmt] as T[] : [];
  }
  if (s.includes("from customer_statement") && !s.includes("count(*)")) {
    return state.customerStatements as T[];
  }

  // 客户付款相关
  if (s.includes("from customer_payment") && s.includes("count(*)")) {
    return [{ total: state.customerPayments.length }] as T[];
  }
  if (s.includes("from customer_payment") && !s.includes("count(*)")) {
    return state.customerPayments as T[];
  }

  // 客户销售单查询
  if (s.includes("from sale_bill") && s.includes("where customer_id = ?") && s.includes("count(*)")) {
    const cnt = state.saleBills.filter((b: Row) => b.customerId === Number(params[0]) || b.customer_id === Number(params[0])).length;
    return [{ total: cnt }] as T[];
  }
  if (s.includes("from sale_bill") && s.includes("where customer_id = ?") && !s.includes("count(*)") && !s.includes("sum(")) {
    return state.saleBills.filter((b: Row) => b.customerId === Number(params[0]) || b.customer_id === Number(params[0])) as T[];
  }

  // 客户付款记录（sale_payment + customer_payment UNION）
  if (s.includes("from sale_payment") && s.includes("from customer_payment")) {
    const memberId = Number(params[0]);
    const sp = state.salePayments.filter((p: Row) => p.customer_id === memberId);
    const cp = state.customerPayments.filter((p: Row) => p.customer_id === memberId);
    return [...sp, ...cp] as T[];
  }

  // 客户统计相关
  if (s.includes("count(*) as total from member where status")) {
    return [{ total: state.members.length }] as T[];
  }
  if (s.includes("count(*) as cnt from member") && s.includes("date_format")) {
    return [{ cnt: 0 }] as T[];
  }
  if (s.includes("count(distinct customer_id) as cnt") && s.includes("created_at >= date_sub")) {
    const activeIds = new Set(state.saleBills.filter((b: Row) => b.customerId || b.customer_id).map((b: Row) => b.customerId || b.customer_id));
    return [{ cnt: activeIds.size }] as T[];
  }
  if (s.includes("count(distinct customer_id) as cnt") && s.includes("unreceived_amount > 0")) {
    const debtIds = new Set(state.saleBills.filter((b: Row) => (b.unreceivedAmount || b.unreceived_amount) > 0).map((b: Row) => b.customerId || b.customer_id));
    return [{ cnt: debtIds.size }] as T[];
  }
  if (s.includes("coalesce(sum(unreceived_amount), 0) as total") && s.includes("unreceived_amount > 0") && s.includes("customer_id is not null")) {
    const total = state.saleBills.reduce((sum: number, b: Row) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
    return [{ total }] as T[];
  }

  // 客户购买统计
  if (s.includes("count(*) as billcount") && s.includes("from sale_bill") && s.includes("where customer_id")) {
    const bills = state.saleBills.filter((b: Row) => (b.customerId || b.customer_id) === Number(params[0]) && b.businessStatus !== "DRAFT" && b.businessStatus !== "VOIDED");
    return [{ billCount: bills.length, totalAmount: 0, receivedAmount: 0, unpaidAmount: 0 }] as T[];
  }
  if (s.includes("from sale_bill_item sbi") && s.includes("join sale_bill sb") && s.includes("group by sbi.sku_id")) {
    return [] as T[];
  }
  if (s.includes("max(created_at) as lastorderat") && s.includes("from sale_bill") && s.includes("where customer_id")) {
    return [{ lastOrderAt: null }] as T[];
  }

  // 对账单生成时的汇总查询
  if (s.includes("coalesce(sum(unreceived_amount), 0) as balance") && s.includes("date(created_at) < ?")) {
    return [{ balance: 0 }] as T[];
  }
  if (s.includes("coalesce(sum(receivable_amount), 0) as total") && s.includes("from sale_bill") && s.includes("date(created_at) >= ?") && s.includes("date(created_at) <= ?")) {
    return [{ total: 0 }] as T[];
  }
  if (s.includes("coalesce(sum(refund_amount), 0) as total") && s.includes("from sale_return")) {
    return [{ total: 0 }] as T[];
  }
  if (s.includes("coalesce(sum(amount), 0) as total") && s.includes("from customer_payment") && s.includes("payment_date >= ?")) {
    return [{ total: 0 }] as T[];
  }

  // 供应商绩效统计
  if (s.includes("sum(case when actual_date is not null and actual_date <= expected_date")) {
    return [{ totalOrders: 0, onTimeOrders: 0, lateOrders: 0 }] as T[];
  }
  if (s.includes("coalesce(sum(payable_amount), 0) as totalamount") && s.includes("from purchase_order") && s.includes("supplier_id")) {
    return [{ totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }] as T[];
  }
  if (s.includes("count(*) as returncount") && s.includes("from purchase_return") && s.includes("supplier_id")) {
    return [{ returnCount: 0, returnAmount: 0 }] as T[];
  }
  if (s.includes("count(*) as cnt from purchase_order") && s.includes("supplier_id") && s.includes("order_status not in")) {
    return [{ cnt: 0 }] as T[];
  }

  return [] as T[];
}

export async function mockExecute(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");
  if (s.includes("update inventory_balance")) {
    const stockType = params.length >= 5 ? params[4] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : (s.includes("stock_type = 'online'") ? "ONLINE" : params[4]));
    const inv = state.inventory.find(
      (i) => i.storeId === params[2] && i.skuId === params[3] && i.stockType === stockType
    );
    if (inv) {
      if (s.includes("locked_qty = locked_qty +")) {
        inv.lockedQty = Number(inv.lockedQty) + Number(params[0]);
        inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
      } else if (s.includes("physical_qty = physical_qty -") && s.includes("locked_qty = greatest(locked_qty -")) {
        // 配送完成：扣 physical_qty 和 locked_qty
        inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
        inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[2]));
      } else if (s.includes("physical_qty = physical_qty -")) {
        // 门店销售：扣 physical_qty 和 available_qty
        inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
        inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
      } else if (s.includes("locked_qty = greatest(locked_qty -")) {
        inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[0]));
        inv.availableQty = Number(inv.availableQty) + Number(params[1]);
      } else {
        const direction = 1;
        inv.physicalQty = Number(inv.physicalQty) + direction * Number(params[0]);
        inv.availableQty = Number(inv.availableQty) + direction * Number(params[1]);
      }
    }
    return result();
  }
  if (s.includes("insert into sale_bill ")) {
    state.saleBills.push({
      billNo: params[0],
      bill_no: params[0],
      storeId: params[1],
      store_id: params[1],
      customerId: params[2],
      customerName: params[3],
      customerMobile: params[4],
      customerType: params[5],
      businessStatus: "CREATED",
      collectionStatus: "UNPAID",
      goodsAmount: params[6],
      receivableAmount: params[9],
      receivable_amount: params[9],
      receivedAmount: 0,
      received_amount: 0,
      unreceivedAmount: params[10],
      unreceived_amount: params[10],
      createdAt: new Date().toISOString()
    });
    return result();
  }
  if (s.startsWith("update product_spu set status")) {
    const status = params[0];
    const spuId = Number(params[1]);
    for (const product of state.products) {
      if (Number(product.spuId) === spuId) product.status = status;
    }
    return result();
  }
  if (s.includes("insert into product_price_log")) {
    state.priceLogs.unshift({
      id: state.priceLogs.length + 1,
      skuId: params[0],
      operatorId: params[1],
      priceType: params[2],
      oldPrice: params[3],
      newPrice: params[4],
      actionType: "UPDATE",
      createdAt: new Date().toISOString()
    });
    return result();
  }
  if (s.includes("insert into sale_bill_item")) {
    state.saleBillItems.push({
      billNo: params[0],
      bill_no: params[0],
      skuId: params[1],
      skuName: params[2],
      boxQty: params[3],
      bottleQty: params[4],
      totalBottleQty: params[5],
      unitPrice: params[6],
      priceType: params[7],
      subtotalAmount: params[8]
    });
    return result();
  }
  if (s.includes("insert into miniapp_order")) {
    state.miniappOrders.push({
      orderNo: params[0],
      order_no: params[0],
      storeId: params[1],
      store_id: params[1],
      customerType: params[2],
      customer_type: params[2],
      fulfillmentType: params[3],
      fulfillment_type: params[3],
      orderStatus: params[4] ?? "PENDING_PAYMENT",
      order_status: params[4] ?? "PENDING_PAYMENT",
      payStatus: params[5] ?? "UNPAID",
      pay_status: params[5] ?? "UNPAID",
      settlementType: params[6] ?? "CASH",
      settlement_type: params[6] ?? "CASH",
      deliveryStatus: params[7] ?? "WAITING",
      delivery_status: params[7] ?? "WAITING",
      goodsAmount: params[8],
      payableAmount: params[9],
      payable_amount: params[9],
      receiverName: params[10],
      receiverMobile: params[11],
      receiverAddress: params[12],
      remark: params[13],
      createdAt: new Date().toISOString()
    });
    return result();
  }
  if (s.includes("insert into miniapp_order_item")) {
    state.miniappOrderItems.push({
      orderNo: params[0],
      skuId: params[1],
      skuName: params[2],
      qty: params[3],
      reservedQty: Number(params[4] ?? 0),
      unreservedQty: Number(params[5] ?? 0),
      unitPrice: params[6],
      priceType: params[7],
      subtotalAmount: params[8]
    });
    return result();
  }
  if (s.includes("update sale_bill") && s.includes("received_amount = ?")) {
    const bill = state.saleBills.find((b) => b.billNo === params[3] || b.bill_no === params[3]);
    if (bill) {
      const received = Number(params[0]);
      const unreceived = Math.max(Number(bill.receivableAmount ?? bill.receivable_amount ?? 0) - Number(params[1]), 0);
      bill.receivedAmount = received;
      bill.received_amount = received;
      bill.unreceivedAmount = unreceived;
      bill.unreceived_amount = unreceived;
      bill.collectionStatus = params[2];
      bill.collection_status = params[2];
    }
    return result();
  }
  if (s.includes("insert into payment_order") && s.includes("'receivable'")) {
    state.paymentOrders.push({
      payNo: params[0],
      pay_no: params[0],
      sourceType: "RECEIVABLE",
      source_type: "RECEIVABLE",
      sourceNo: params[1],
      source_no: params[1],
      channel: params[2],
      paymentMethod: params[2],
      payment_method: params[2],
      amount: params[3],
      status: "SUCCESS"
    });
    return result();
  }
  if (s.includes("insert into payment_order")) {
    state.paymentOrders.push({
      payNo: params[0],
      pay_no: params[0],
      sourceType: "SALE_BILL",
      source_type: "SALE_BILL",
      sourceNo: params[1],
      source_no: params[1],
      channel: params[2],
      paymentMethod: params[2],
      payment_method: params[2],
      amount: params[3],
      status: s.includes("'success'") ? "SUCCESS" : "PENDING"
    });
    return result();
  }
  if (s.includes("insert into product_spu")) {
    const spuId = state.products.length + 1;
    pendingProduct.spu = {
      spuId,
      spuCode: params[0],
      name: params[1],
      categoryId: params[2],
      mainImage: params[3],
      saleChannels: params[4],
      status: "DRAFT"
    };
    return result(spuId);
  }
  if (s.includes("insert into product_sku")) {
    const skuId = state.products.length + 1;
    pendingProduct.sku = {
      skuId,
      spuId: params[0],
      skuCode: params[1],
      barcode: params[2],
      skuName: params[3],
      boxRatio: params[4],
      temperature: params[5],
      traceEnabled: params[6],
      warningThreshold: params[7]
    };
    return result(skuId);
  }
  if (s.includes("insert into product_price")) {
    if (pendingProduct.spu && pendingProduct.sku) {
      state.products.push({
        spuId: pendingProduct.spu.spuId,
        skuId: pendingProduct.sku.skuId,
        name: pendingProduct.spu.name,
        mainImage: pendingProduct.spu.mainImage,
        skuName: pendingProduct.sku.skuName,
        skuCode: pendingProduct.sku.skuCode,
        barcode: pendingProduct.sku.barcode,
        retailPrice: Number(params[2] ?? 0),
        wholesalePrice: Number(params[3] ?? 0),
        miniappPrice: Number(params[4] ?? params[2] ?? 0),
        status: "DRAFT"
      });
      pendingProduct.spu = undefined;
      pendingProduct.sku = undefined;
    }
    return result();
  }
  if (s.includes("update product_price")) {
    const skuId = Number(params[params.length - 1]);
    const product = state.products.find((p) => p.skuId === skuId);
    if (product) {
      if (params[1] != null) product.retailPrice = Number(params[1]);
      if (params[2] != null) product.wholesalePrice = Number(params[2]);
      if (params[3] != null) product.miniappPrice = Number(params[3]);
    }
    return result();
  }
  if (s.includes("insert into receivable_account")) {
    state.receivables.push({
      receivableNo: params[0],
      receivable_no: params[0],
      sourceType: "MINIAPP_ORDER",
      source_type: "MINIAPP_ORDER",
      sourceNo: params[1],
      source_no: params[1],
      storeId: params[2],
      store_id: params[2],
      customerId: params[3],
      customerName: params[4],
      customerMobile: params[5],
      receivableAmount: params[6],
      receivable_amount: params[6],
      receivedAmount: 0,
      received_amount: 0,
      unreceivedAmount: params[7],
      unreceived_amount: params[7],
      status: "UNPAID",
      createdAt: new Date().toISOString()
    });
    return result();
  }
  if (s.includes("update receivable_account")) {
    const receivable = state.receivables.find((r) => r.receivableNo === params[3] || r.receivable_no === params[3]);
    if (receivable) {
      receivable.receivedAmount = params[0];
      receivable.received_amount = params[0];
      receivable.unreceivedAmount = params[1];
      receivable.unreceived_amount = params[1];
      receivable.status = params[2];
    }
    return result();
  }

  // ===== 第一/二阶段新增表 INSERT/UPDATE 支持 =====

  // 供应商 INSERT
  if (s.includes("insert into supplier (")) {
    const id = state.suppliers.length + 1;
    state.suppliers.push({
      id,
      supplier_code: params[0],
      name: params[1],
      short_name: params[2],
      category: params[3],
      province: params[4],
      city: params[5],
      district: params[6],
      address: params[7],
      credit_level: params[8],
      settlement_type: params[9],
      settlement_day: params[10],
      tax_rate: params[11],
      bank_name: params[12],
      bank_account: params[13],
      bank_account_name: params[14],
      remark: params[15],
      status: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 供应商 UPDATE
  if (s.includes("update supplier set") && s.includes("where id")) {
    const supplier = state.suppliers.find((sup: Row) => sup.id === Number(params[params.length - 1]));
    if (supplier) {
      // params are dynamic based on which fields are set
      for (let i = 0; i < params.length - 1; i++) {
        if (params[i] !== undefined) {
          // Field mapping handled by caller
        }
      }
      supplier.updated_at = new Date().toISOString();
    }
    return result();
  }

  // 采购订单 INSERT
  if (s.includes("insert into purchase_order (")) {
    const id = state.purchaseOrders.length + 1;
    state.purchaseOrders.push({
      id,
      order_no: params[0],
      supplier_id: params[1],
      supplier_name: params[2],
      store_id: params[3],
      order_status: params[4],
      goods_amount: params[5],
      tax_amount: params[6],
      discount_amount: params[7],
      payable_amount: params[8],
      paid_amount: params[9],
      unpaid_amount: params[10],
      expected_date: params[11],
      operator_id: params[12],
      remark: params[13],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 采购订单明细 INSERT
  if (s.includes("insert into purchase_order_item (")) {
    state.purchaseOrderItems.push({
      id: state.purchaseOrderItems.length + 1,
      order_no: params[0],
      sku_id: params[1],
      sku_name: params[2],
      barcode: params[3],
      box_qty: params[4],
      bottle_qty: params[5],
      total_bottle_qty: params[6],
      unit_price: params[7],
      tax_rate: params[8],
      subtotal_amount: params[9],
      tax_amount: params[10],
      total_amount: params[11],
      remark: params[12],
      in_stocked_qty: 0,
    });
    return result();
  }

  // 采购订单明细 DELETE
  if (s.includes("delete from purchase_order_item where order_no")) {
    state.purchaseOrderItems = state.purchaseOrderItems.filter((i: Row) => i.order_no !== params[0]);
    return result();
  }

  // 采购订单 UPDATE (状态变更等)
  if (s.includes("update purchase_order set") && s.includes("where id")) {
    const order = state.purchaseOrders.find((o: Row) => o.id === Number(params[params.length - 1]));
    if (order) {
      if (s.includes("order_status = 'cancelled'")) order.order_status = "CANCELLED";
      if (s.includes("order_status = 'approved'")) order.order_status = "APPROVED";
      if (s.includes("order_status = ?")) {
        // Dynamic status update
      }
      order.updated_at = new Date().toISOString();
    }
    return result();
  }

  // 采购订单明细 UPDATE (入库数量)
  if (s.includes("update purchase_order_item set in_stocked_qty")) {
    const item = state.purchaseOrderItems.find((i: Row) => i.order_no === params[1] && i.sku_id === Number(params[2]));
    if (item) item.in_stocked_qty = (item.in_stocked_qty || 0) + Number(params[0]);
    return result();
  }

  // 采购入库单 INSERT
  if (s.includes("insert into purchase_in_stock (")) {
    const id = state.purchaseInStocks.length + 1;
    state.purchaseInStocks.push({
      id,
      stock_no: params[0],
      order_no: params[1],
      supplier_id: params[2],
      supplier_name: params[3],
      store_id: params[4],
      stock_status: params[5],
      goods_amount: params[6],
      tax_amount: params[7],
      total_amount: params[8],
      operator_id: params[9],
      remark: params[10],
      created_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 采购入库单明细 INSERT
  if (s.includes("insert into purchase_in_stock_item (")) {
    state.purchaseInStockItems.push({
      id: state.purchaseInStockItems.length + 1,
      stock_no: params[0],
      sku_id: params[1],
      sku_name: params[2],
      box_qty: params[3],
      bottle_qty: params[4],
      total_bottle_qty: params[5],
      unit_price: params[6],
      tax_rate: params[7],
      subtotal_amount: params[8],
      tax_amount: params[9],
      total_amount: params[10],
      batch_no: params[11],
      production_date: params[12],
      expiry_date: params[13],
      remark: params[14],
    });
    return result();
  }

  // 采购退货 INSERT
  if (s.includes("insert into purchase_return (")) {
    const id = state.purchaseReturns.length + 1;
    state.purchaseReturns.push({
      id,
      return_no: params[0],
      order_no: params[1],
      stock_no: params[2],
      supplier_id: params[3],
      supplier_name: params[4],
      store_id: params[5],
      return_status: params[6],
      goods_amount: params[7],
      tax_amount: params[8],
      total_amount: params[9],
      refund_amount: params[10],
      refunded_amount: params[11],
      operator_id: params[12],
      remark: params[13],
      created_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 采购退货明细 INSERT
  if (s.includes("insert into purchase_return_item (")) {
    state.purchaseReturnItems.push({
      id: state.purchaseReturnItems.length + 1,
      return_no: params[0],
      sku_id: params[1],
      sku_name: params[2],
      box_qty: params[3],
      bottle_qty: params[4],
      total_bottle_qty: params[5],
      unit_price: params[6],
      tax_rate: params[7],
      subtotal_amount: params[8],
      tax_amount: params[9],
      total_amount: params[10],
      reason: params[11],
    });
    return result();
  }

  // 销售退货 INSERT
  if (s.includes("insert into sale_return (")) {
    const id = state.saleReturns.length + 1;
    state.saleReturns.push({
      id,
      return_no: params[0],
      source_bill_no: params[1],
      store_id: params[2],
      customer_id: params[3],
      customer_name: params[4],
      customer_mobile: params[5],
      return_status: params[6],
      goods_amount: params[7],
      discount_amount: params[8],
      refund_amount: params[9],
      refunded_amount: params[10],
      refund_method: params[11],
      operator_id: params[12],
      remark: params[13],
      created_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 销售退货明细 INSERT
  if (s.includes("insert into sale_return_item (")) {
    state.saleReturnItems.push({
      id: state.saleReturnItems.length + 1,
      return_no: params[0],
      sku_id: params[1],
      sku_name: params[2],
      box_qty: params[3],
      bottle_qty: params[4],
      total_bottle_qty: params[5],
      unit_price: params[6],
      subtotal_amount: params[7],
      reason: params[8],
    });
    return result();
  }

  // 客户对账单 INSERT
  if (s.includes("insert into customer_statement (")) {
    const id = state.customerStatements.length + 1;
    state.customerStatements.push({
      id,
      statement_no: params[0],
      customer_id: params[1],
      customer_name: params[2],
      customer_mobile: params[3],
      statement_type: params[4],
      start_date: params[5],
      end_date: params[6],
      opening_balance: params[7],
      total_sales: params[8],
      total_returns: params[9],
      total_payments: params[10],
      closing_balance: params[11],
      status: params[12],
      operator_id: params[13],
      remark: params[14],
      created_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 客户付款 INSERT
  if (s.includes("insert into customer_payment (")) {
    const id = state.customerPayments.length + 1;
    state.customerPayments.push({
      id,
      receipt_no: params[0],
      customer_id: params[1],
      customer_name: params[2],
      amount: params[3],
      payment_method: params[4],
      source_type: params[5],
      source_no: params[6],
      voucher_no: params[7],
      payment_date: params[8],
      operator_id: params[9],
      status: params[10],
      remark: params[11],
      created_at: new Date().toISOString(),
    });
    return result(id);
  }

  // 库存余额 INSERT（新增表相关的 ON DUPLICATE KEY UPDATE）
  if (s.includes("insert into inventory_balance") && s.includes("on duplicate key update")) {
    const storeId = Number(params[0]);
    const skuId = Number(params[1]);
    const stockType = String(params[2]);
    const qty = Number(params[3]);
    const inv = state.inventory.find(
      (i) => i.storeId === storeId && i.skuId === skuId && i.stockType === stockType
    );
    if (inv) {
      inv.physicalQty = Number(inv.physicalQty) + qty;
      inv.availableQty = Number(inv.availableQty) + qty;
    } else {
      state.inventory.push({
        storeId,
        skuId,
        skuName: "",
        stockType,
        physicalQty: qty,
        lockedQty: 0,
        availableQty: qty,
      });
    }
    return result();
  }

  // 采购退货扣减库存
  if (s.includes("update inventory_balance") && s.includes("greatest(physical_qty -") && s.includes("greatest(available_qty -")) {
    const storeId = Number(params[2]);
    const skuId = Number(params[3]);
    const qty = Number(params[0]);
    const inv = state.inventory.find(
      (i) => i.storeId === storeId && i.skuId === skuId && i.stockType === "OFFLINE"
    );
    if (inv) {
      inv.physicalQty = Math.max(0, Number(inv.physicalQty) - qty);
      inv.availableQty = Math.max(0, Number(inv.availableQty) - qty);
    }
    return result();
  }

  return result();
}

export const mockConn = {
  execute: mockExecute,
  query: async (sql: string, params: unknown[] = []) => [await mockQuery(sql, params), undefined]
} as any;

const initialState = JSON.parse(JSON.stringify(state));

export function resetMockDb() {
  Object.keys(initialState).forEach((key) => {
    (state as any)[key] = JSON.parse(JSON.stringify(initialState[key]));
  });
}
