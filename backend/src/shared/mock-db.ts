import { sha256 } from "./password.js";

type Row = Record<string, any>;

const state = {
  users: [
    { id: 1, username: "admin", password_hash: sha256("admin123"), real_name: "系统管理员", store_id: null, status: 1 }
  ],
  roles: [{ id: 1, role_code: "SUPER_ADMIN", role_name: "超级管理员", status: 1 }],
  members: [
    { id: 1, name: "默认零售客户", mobile: "13900000000", customer_type: "RETAIL", points: 120, level_code: "NORMAL", status: 1, staff_id: null as number | null },
    { id: 2, name: "默认批发客户", mobile: "13900000001", customer_type: "WHOLESALE", points: 0, level_code: "WHOLESALE", status: 1, staff_id: 1 }
  ] as Row[],
  stores: [
    { id: 1, store_code: "STORE0001", name: "默认门店", address: "演示地址", contact: "管理员", phone: "13800000000", delivery_radius: 3, business_status: "OPEN", status: 1 }
  ],
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
  holdOrders: [] as Row[],
  viewLogs: [] as Row[],
  inventoryLogs: [] as Row[],
  // phase2
  suppliers: [] as Row[],
  supplierContacts: [] as Row[],
  purchaseOrders: [] as Row[],
  purchaseOrderItems: [] as Row[],
  purchaseInStockOrders: [] as Row[],
  purchaseInStockItems: [] as Row[],
  saleReturns: [] as Row[],
  saleReturnItems: [] as Row[],
  purchaseReturns: [] as Row[],
  purchaseReturnItems: [] as Row[],
  customerStatements: [] as Row[],
  customerStatementItems: [] as Row[],
  purchasePayments: [] as Row[],
  customerPayments: [] as Row[],
  paymentRecords: [] as Row[]
};

const pendingProduct: {
  spu?: Row;
  sku?: Row;
} = {};

function result(insertId: number = Date.now()) {
  return [{ insertId, affectedRows: 1 }, undefined] as any;
}
function extractLiteral(sql: string, field: string): string | null {
  const re = new RegExp(field + "\\s*=\\s*'([^']*)'", "i");
  const m = sql.match(re);
  return m ? m[1] : null;
}
export async function mockQuery<T = any>(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");

  if (s.includes("from sys_user where username")) {
    return state.users.filter((u) => u.username === params[0]) as T[];
  }
  if (s.includes("from sys_user_role") && s.includes("join sys_role")) {
    return state.roles.map((r) => ({ role_code: r.role_code })) as T[];
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
      status: st.status
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
      status: 1
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
      const online = state.inventory.find((inv) => inv.skuId === product.skuId && inv.stockType === "ONLINE");
      return {
        ...product,
        availableQty: online?.availableQty ?? 0,
        available_qty: online?.availableQty ?? 0
      };
    }) as T[];
  }
  if (s.includes("update inventory_balance")) {
    const stockType = s.includes("stock_type = ?") && params[4] ? params[4] : "OFFLINE";
    const inv = state.inventory.find(
      (i) => i.storeId === params[2] && i.skuId === params[3] && String(i.stockType) === String(stockType)
    );
    if (inv) {
      const isSubtract = s.includes("physical_qty = physical_qty - ?");
      const delta = isSubtract ? -Number(params[0]) : Number(params[0]);
      inv.physicalQty = Number(inv.physicalQty) + delta;
      inv.availableQty = Number(inv.availableQty) + delta;
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
  if (s.includes("from inventory_balance") && s.includes("where store_id")) {
    const stockType = s.includes("stock_type = ?") || params[2] ? params[2] : "OFFLINE";
    const inv = state.inventory.find(
      (i) => i.storeId === params[0] && i.skuId === params[1] && String(i.stockType) === String(stockType)
    );
    return inv ? [inv] as T[] : [] as T[];
  }
  if (s.includes("from inventory_balance") && s.includes("where sku_id")) {
    const stockType = s.includes("stock_type = ?") || params[1] ? params[1] : "OFFLINE";
    const inv = state.inventory.find(
      (i) => i.skuId === params[0] && String(i.stockType) === String(stockType)
    );
    return inv ? [inv] as T[] : [] as T[];
  }
  if (s.includes("from inventory_balance")) return state.inventory as T[];
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
  if (s.includes("from sale_bill") && s.includes("where bill_no = ?")) {
    const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
    return bill ? [bill] as T[] : [];
  }
  if (s.includes("from sale_bill_item where bill_no")) {
    return state.saleBillItems.filter((i) => i.billNo === params[0] || i.bill_no === params[0]) as T[];
  }
  if (s.includes("from sale_bill") && !s.includes("join") && !s.includes("group by")) return state.saleBills as T[];
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
    state.inventoryLogs.push({
      logNo: String(params[0]),
      storeId: Number(params[1]),
      skuId: Number(params[2]),
      skuName: product?.skuName ?? "",
      stockType: String(params[3]),
      changeQty: Number(params[5]),
      beforeQty: Number(params[6]),
      afterQty: Number(params[7]),
      reason: String(params[10] ?? ""),
      operatorId: params[8],
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
  // ---- phase2 ----
  // supplier_contact must come before supplier
  if (s.includes("from supplier_contact")) {
    if (s.includes("where supplier_id = ?") || s.includes("where supplier_id=?")) {
      const sid = Number(params[0]);
      return state.supplierContacts.filter((x) => Number(x.supplierId) === sid).map((x) => ({
        ...x,
        supplier_id: x.supplierId,
        contact_name: x.contactName,
        contact_role: x.contactRole,
        contact_phone: x.contactPhone,
        contact_email: x.contactEmail,
        is_primary: x.isPrimary
      })) as T[];
    }
    return state.supplierContacts.slice() as T[];
  }
  if (s.match(/from supplier($| |\n|\))/)) {
    const keyword = params[0] && params[0] !== undefined ? String(params[0]).replace(/^%|%$/g, "") : "";
    if (s.includes("where id = ?") || s.includes("where id=?")) {
      const id = Number(params[0]);
      return state.suppliers.filter((x) => Number(x.id) === id).map((x) => ({
        ...x,
        supplierId: x.id,
        supplierCode: x.supplierCode,
        supplierName: x.supplierName,
        shortName: x.shortName,
        creditLevel: x.creditLevel,
        settlementType: x.settlementType,
        settlementDay: x.settlementDay,
        taxRate: x.taxRate,
        bankName: x.bankName,
        bankAccount: x.bankAccount,
        bankAccountName: x.bankAccountName,
        contactPhone: x.contactPhone,
        creditLimit: x.creditLimit,
        creditDays: x.creditDays,
        supplierType: x.supplierType,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt
      })) as T[];
    }
    if (s.includes("where supplier_code = ?") || s.includes("where supplier_code=?")) {
      const code = String(params[0]);
      return state.suppliers.filter((x) => String(x.supplierCode) === code).map((x) => ({
        ...x,
        supplierId: x.id,
        supplierCode: x.supplierCode,
        supplierName: x.supplierName,
        shortName: x.shortName,
        creditLevel: x.creditLevel,
        settlementType: x.settlementType,
        taxRate: x.taxRate,
        contactPhone: x.contactPhone,
        creditLimit: x.creditLimit,
        creditDays: x.creditDays,
        supplierType: x.supplierType
      })) as T[];
    }
    return state.suppliers
      .filter((x) => !keyword || String(x.supplierName || "").includes(keyword) || String(x.supplierCode || "").includes(keyword) || String(x.shortName || "").includes(keyword))
      .map((x) => ({
        ...x,
        supplierId: x.id,
        supplierCode: x.supplierCode,
        supplierName: x.supplierName,
        shortName: x.shortName,
        creditLevel: x.creditLevel,
        settlementType: x.settlementType,
        taxRate: x.taxRate,
        contactPhone: x.contactPhone,
        creditLimit: x.creditLimit,
        creditDays: x.creditDays,
        supplierType: x.supplierType
      })) as T[];
  }
  // purchase_order_item must be checked before purchase_order to avoid substring match
  if (s.includes("from purchase_order_item")) {
    return state.purchaseOrderItems
      .filter((i) => !params[0] || i.orderNo === params[0])
      .map((i) => ({
        ...i,
        order_no: i.orderNo,
        sku_id: i.skuId,
        sku_name: i.skuName,
        box_qty: i.boxQty,
        bottle_qty: i.bottleQty,
        unit_price: i.unitPrice,
        subtotal_amount: i.subtotalAmount
      })) as T[];
  }
  if (s.includes("from purchase_order") && s.includes("where order_no")) {
    return state.purchaseOrders
      .filter((o) => o.orderNo === params[0])
      .map((o) => ({
        ...o,
        order_no: o.orderNo,
        store_id: o.storeId,
        supplier_id: o.supplierId,
        goods_amount: o.goodsAmount,
        tax_amount: o.taxAmount,
        payable_amount: o.payableAmount,
        paid_amount: o.paidAmount,
        pay_status: o.payStatus,
        audit_time: o.auditTime,
        auditor_id: o.auditorId
      })) as T[];
  }
  if (s.includes("from purchase_order") && !s.includes("insert")) {
    return state.purchaseOrders.map((o) => ({
      ...o,
      order_no: o.orderNo,
      store_id: o.storeId,
      supplier_id: o.supplierId,
      goods_amount: o.goodsAmount,
      tax_amount: o.taxAmount,
      payable_amount: o.payableAmount,
      paid_amount: o.paidAmount,
      pay_status: o.payStatus
    })) as T[];
  }
  // _item tables come before their parent to avoid prefix overlap
  if (s.includes("from purchase_in_stock_item")) {
    return state.purchaseInStockItems.slice() as T[];
  }
  if (s.includes("from purchase_in_stock_order")) {
    return state.purchaseInStockOrders.slice() as T[];
  }
  if (s.includes("from sale_return_item")) {
    return state.saleReturnItems.filter((i) => !params[0] || i.returnNo === params[0]) as T[];
  }
  if (s.includes("from sale_return") && s.includes("where return_no")) {
    return state.saleReturns.filter((r) => r.returnNo === params[0]) as T[];
  }
  if (s.includes("from sale_return") && !s.includes("insert")) {
    return state.saleReturns.map((r) => ({
      ...r,
      return_no: r.returnNo,
      store_id: r.storeId,
      customer_id: r.customerId,
      customer_name: r.customerName,
      total_amount: r.totalAmount,
      stock_rollback_flag: r.stockRollbackFlag,
      auditor_id: r.auditorId ?? null,
      audit_time: r.auditTime ?? null
    })) as T[];
  }
  // purchase_return_item before purchase_return
  if (s.includes("from purchase_return_item")) {
    return state.purchaseReturnItems.filter((i) => !params[0] || i.returnNo === params[0]) as T[];
  }
  if (s.includes("from purchase_return") && s.includes("where return_no")) {
    return state.purchaseReturns.filter((r) => r.returnNo === params[0]) as T[];
  }
  if (s.includes("from purchase_return") && !s.includes("insert")) {
    return state.purchaseReturns.map((r) => ({
      ...r,
      return_no: r.returnNo,
      purchase_order_no: r.purchaseOrderNo,
      supplier_id: r.supplierId,
      total_amount: r.totalAmount,
      stock_rollback_flag: r.stockRollbackFlag,
      auditor_id: r.auditorId ?? null,
      audit_time: r.auditTime ?? null
    })) as T[];
  }
  if (s.includes("from purchase_payment")) {
    return state.purchasePayments.map((p) => ({
      ...p,
      pay_no: p.payNo,
      purchase_order_no: p.purchaseOrderNo,
      supplier_id: p.supplierId,
      pay_method: p.payMethod,
      pay_amount: p.payAmount,
      auditor_id: p.auditorId ?? null,
      audit_time: p.auditTime ?? null
    })) as T[];
  }
  if (s.includes("from customer_statement_item")) {
    return state.customerStatementItems.filter((i) => !params[0] || i.statementNo === params[0]) as T[];
  }
  if (s.includes("from customer_statement")) {
    return state.customerStatements.map((st) => ({
      ...st,
      statement_no: st.statementNo,
      customer_id: st.customerId,
      customer_name: st.customerName,
      start_balance: st.startBalance,
      sales_amount: st.salesAmount,
      return_amount: st.returnAmount,
      received_amount: st.receivedAmount,
      end_balance: st.endBalance,
      auditor_id: (st as any).auditorId ?? null
    })) as T[];
  }
  if (s.includes("from customer_payment")) {
    return state.customerPayments.map((p) => ({
      ...p,
      receipt_no: p.receiptNo,
      customer_id: p.customerId,
      customer_name: p.customerName,
      pay_method: p.payMethod,
      pay_amount: p.payAmount,
      auditor_id: p.auditorId ?? null,
      audit_time: p.auditTime ?? null
    })) as T[];
  }
  if (s.includes("from payment_record")) {
    return state.paymentRecords.slice() as T[];
  }
  return [] as T[];
}

export async function mockExecute(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");
  if (s.includes("insert into sale_bill ")) {
    state.saleBills.push({
      billNo: params[0],
      bill_no: params[0],
      storeId: params[1],
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
      fulfillmentType: params[3],
      fulfillment_type: params[3],
      orderStatus: "PENDING_PAYMENT",
      order_status: "PENDING_PAYMENT",
      payStatus: "UNPAID",
      pay_status: "UNPAID",
      goodsAmount: params[4],
      payableAmount: params[5],
      payable_amount: params[5],
      receiverName: params[6],
      receiverMobile: params[7],
      receiverAddress: params[8],
      remark: params[9],
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
      unitPrice: params[4],
      priceType: params[5],
      subtotalAmount: params[6]
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
  // ---- phase2 ----
  if (s.includes("insert into supplier ")) {
    const supplierCode = String(params[0]);
    const supplierName = String(params[1]);
    const contactName = params[2] ? String(params[2]) : null;
    const contactPhone = params[3] ? String(params[3]) : null;
    const address = params[4] ? String(params[4]) : null;
    const taxNo = params[5] ? String(params[5]) : null;
    const bankName = params[6] ? String(params[6]) : null;
    const bankAccount = params[7] ? String(params[7]) : null;
    const creditLimit = Number(params[8] ?? 0);
    const creditDays = Number(params[9] ?? 30);
    const settlementCycle = String(params[10] ?? "MONTHLY");
    const supplierType = String(params[11] ?? "BRAND");
    const levelCode = params[12] ? String(params[12]) : null;
    const remark = params[13] ? String(params[13]) : null;
    const status = String(params[14] ?? "ACTIVE");
    const id = state.suppliers.length + 1;
    state.suppliers.push({
      id, supplierCode, supplierName, contactName, contactPhone,
      address, taxNo, bankName, bankAccount,
      creditLimit, creditDays, settlementCycle, supplierType,
      levelCode, remark, status, createdAt: new Date().toISOString()
    });
    return result(id);
  }
  if (s.includes("insert into supplier_contact")) {
    const supplierId = Number(params[0]);
    const contactName = String(params[1]);
    const contactRole = params[2] ? String(params[2]) : null;
    const contactPhone = params[3] ? String(params[3]) : null;
    const contactEmail = params[4] ? String(params[4]) : null;
    const isPrimary = Number(params[5] ?? 0);
    const id = state.supplierContacts.length + 1;
    state.supplierContacts.push({ id, supplierId, contactName, contactRole, contactPhone, contactEmail, isPrimary });
    return result(id);
  }
  if (s.includes("update supplier set")) {
    const id = Number(params[params.length - 1]);
    const supplier = state.suppliers.find((x) => x.id === id);
    if (supplier) {
      if (params[0] != null && params[0] !== undefined) supplier.contactPhone = String(params[0]);
      if (params[1] != null && params[1] !== undefined) supplier.creditLimit = Number(params[1]);
      if (params[2] != null && params[2] !== undefined) supplier.supplierType = String(params[2]);
      if (params[3] != null && params[3] !== undefined) supplier.status = String(params[3]);
    }
    return result();
  }
  if (s.includes("insert into purchase_order ")) {
    const orderNo = String(params[0]);
    const storeId = Number(params[1]);
    const supplierId = Number(params[2]);
    const goodsAmount = Number(params[3] ?? 0);
    const payableAmount = Number(params[4] ?? 0);
    const remark = params[5] ? String(params[5]) : null;
    const id = state.purchaseOrders.length + 1;
    state.purchaseOrders.push({
      id, orderNo, storeId, supplierId,
      orderStatus: "DRAFT", payStatus: "UNPAID",
      goodsAmount, taxAmount: 0, payableAmount, paidAmount: 0,
      remark, auditTime: null, auditorId: null, inboundStatus: "NOT_STARTED",
      createdAt: new Date().toISOString(), version: 1
    });
    return result(id);
  }
  if (s.includes("insert into purchase_order_item")) {
    const orderNo = String(params[0]);
    const skuId = Number(params[1]);
    const skuName = String(params[2]);
    const boxQty = Number(params[3] ?? 0);
    const bottleQty = Number(params[4] ?? 0);
    const unitPrice = Number(params[5] ?? 0);
    const subtotal = Number(params[6] ?? (boxQty + bottleQty) * unitPrice);
    const id = state.purchaseOrderItems.length + 1;
    state.purchaseOrderItems.push({ id, orderNo, skuId, skuName, boxQty, bottleQty, unitPrice, subtotalAmount: subtotal, inboundQty: 0 });
    return result(id);
  }
  if (s.includes("update purchase_order set") && s.includes("order_status")) {
    const orderNo = String(params[params.length - 1]);
    const order = state.purchaseOrders.find((o) => o.orderNo === orderNo);
    if (order) {
      const status = extractLiteral(sql, "order_status");
      if (status) order.orderStatus = status;
      if (s.includes("auditor_id")) order.auditorId = Number(params[0] ?? 1);
      if (s.includes("audit_time")) order.auditTime = new Date().toISOString();
      order.version = Number(order.version ?? 1) + 1;
    }
    return result();
  }
  if (s.includes("update purchase_order set") && s.includes("pay_status")) {
    const orderNo = String(params[params.length - 1]);
    const order = state.purchaseOrders.find((o) => o.orderNo === orderNo);
    if (order) {
      const status = extractLiteral(sql, "pay_status");
      if (status) order.payStatus = status;
      if (s.includes("paid_amount") && params[0] != null) {
        order.paidAmount = Number(order.paidAmount ?? 0) + Number(params[0]);
      }
      order.version = Number(order.version ?? 1) + 1;
    }
    return result();
  }
  if (s.includes("insert into purchase_in_stock_order")) {
    const inStockNo = String(params[0]);
    const purchaseOrderNo = params[1] ? String(params[1]) : null;
    const storeId = Number(params[2]);
    const supplierId = Number(params[3]);
    const totalQty = Number(params[4] ?? 0);
    const totalAmount = Number(params[5] ?? 0);
    const id = state.purchaseInStockOrders.length + 1;
    state.purchaseInStockOrders.push({
      id, inStockNo, purchaseOrderNo, storeId, supplierId,
      totalQty, totalAmount, status: "DRAFT",
      auditorId: null, auditTime: null,
      createdAt: new Date().toISOString()
    });
    return result(id);
  }
  if (s.includes("insert into purchase_in_stock_item")) {
    const inStockNo = String(params[0]);
    const skuId = Number(params[1]);
    const skuName = String(params[2]);
    const planQty = Number(params[3] ?? 0);
    const actualQty = Number(params[4] ?? planQty);
    const unitPrice = Number(params[5] ?? 0);
    const subtotal = Number(params[6] ?? actualQty * unitPrice);
    const id = state.purchaseInStockItems.length + 1;
    state.purchaseInStockItems.push({ id, inStockNo, skuId, skuName, planQty, actualQty, unitPrice, subtotalAmount: subtotal });
    return result(id);
  }
  if (s.includes("update purchase_in_stock_order set") && s.includes("status")) {
    const inStockNo = String(params[params.length - 1]);
    const order = state.purchaseInStockOrders.find((o) => o.inStockNo === inStockNo);
    if (order) {
      const status = extractLiteral(sql, "status");
      if (status) order.status = status;
      if (order.status === "AUDITED") {
        order.auditorId = params[0] ? Number(params[0]) : 1;
        order.auditTime = new Date().toISOString();
      }
      if (order.status === "VOID") {
        order.auditorId = params[0] ? Number(params[0]) : 1;
        order.auditTime = new Date().toISOString();
      }
      if (order.status === "CANCELLED") {
        order.auditorId = null;
        order.auditTime = null;
      }
    }
    return result();
  }
  if (s.includes("insert into sale_return ")) {
    const returnNo = String(params[0]);
    const storeId = Number(params[1]);
    const customerId = Number(params[2]);
    const customerName = String(params[3]);
    const totalAmount = Number(params[4] ?? 0);
    const remark = params[5] ? String(params[5]) : null;
    const id = state.saleReturns.length + 1;
    state.saleReturns.push({
      id, returnNo, storeId, customerId, customerName,
      totalAmount, remark, status: "DRAFT",
      auditorId: null, auditTime: null, refundStatus: "UNREFUNDED",
      stockRollbackFlag: 0,
      createdAt: new Date().toISOString()
    });
    return result(id);
  }
  if (s.includes("insert into sale_return_item")) {
    const returnNo = String(params[0]);
    const skuId = Number(params[1]);
    const skuName = String(params[2]);
    const qty = Number(params[3] ?? 0);
    const unitPrice = Number(params[4] ?? 0);
    const subtotal = Number(params[5] ?? qty * unitPrice);
    const id = state.saleReturnItems.length + 1;
    state.saleReturnItems.push({ id, returnNo, skuId, skuName, qty, unitPrice, subtotalAmount: subtotal });
    return result(id);
  }
  if (s.includes("update sale_return set")) {
    const returnNo = String(params[params.length - 1]);
    const r = state.saleReturns.find((x) => x.returnNo === returnNo);
    if (r) {
      if (params[0] != null && params[0] !== undefined) r.status = String(params[0]);
      if (String(params[0]) === "AUDITED") {
        r.auditorId = 1;
        r.auditTime = new Date().toISOString();
        r.stockRollbackFlag = 1;
      }
      if (params[1] != null && params[1] !== undefined) r.refundStatus = String(params[1]);
    }
    return result();
  }
  if (s.includes("insert into customer_statement ")) {
    const statementNo = String(params[0]);
    const customerId = Number(params[1]);
    const customerName = String(params[2]);
    const startBalance = Number(params[3] ?? 0);
    const salesAmount = Number(params[4] ?? 0);
    const returnAmount = Number(params[5] ?? 0);
    const receivedAmount = Number(params[6] ?? 0);
    const endBalance = Number(params[7] ?? (startBalance + salesAmount - returnAmount - receivedAmount));
    const id = state.customerStatements.length + 1;
    state.customerStatements.push({
      id, statementNo, customerId, customerName,
      startBalance, salesAmount, returnAmount, receivedAmount, endBalance,
      status: "DRAFT",
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      createdAt: new Date().toISOString()
    });
    return result(id);
  }
  if (s.includes("insert into customer_statement_item")) {
    const statementNo = String(params[0]);
    const transType = String(params[1]);
    const transNo = params[2] ? String(params[2]) : null;
    const amount = Number(params[3] ?? 0);
    const remark = params[4] ? String(params[4]) : null;
    const id = state.customerStatementItems.length + 1;
    state.customerStatementItems.push({ id, statementNo, transType, transNo, amount, remark, createdAt: new Date().toISOString() });
    return result(id);
  }
  if (s.includes("update customer_statement set")) {
    const statementNo = String(params[params.length - 1]);
    const st = state.customerStatements.find((x) => x.statementNo === statementNo);
    if (st) {
      const status = extractLiteral(sql, "status");
      if (status) st.status = status;
      if (params[0] != null) (st as any).auditorId = Number(params[0]);
      if (s.includes("audit_time")) (st as any).auditTime = new Date().toISOString();
    }
    return result();
  }
  if (s.includes("insert into payment_record")) {
    const payNo = String(params[0]);
    const sourceType = String(params[1]);
    const sourceNo = String(params[2]);
    const amount = Number(params[3] ?? 0);
    const payMethod = String(params[4] ?? "BANK_TRANSFER");
    const id = state.paymentRecords.length + 1;
    state.paymentRecords.push({ id, payNo, sourceType, sourceNo, amount, payMethod, status: "PAID", createdAt: new Date().toISOString() });
    return result(id);
  }
  if (s.includes("insert into purchase_return ")) {
    const returnNo = String(params[0]);
    const storeId = Number(params[1]);
    const purchaseOrderNo = params[2] ? String(params[2]) : null;
    const supplierId = params[3] ? Number(params[3]) : null;
    const totalAmount = Number(params[4] ?? 0);
    const remark = params[5] ? String(params[5]) : null;
    const id = state.purchaseReturns.length + 1;
    state.purchaseReturns.push({
      id, returnNo, storeId, purchaseOrderNo, supplierId, totalAmount, remark, status: "PENDING", stockRollbackFlag: 0, auditorId: null, auditTime: null, audit_time: null, createdAt: new Date().toISOString()
    });
    return result(id);
  }
  if (s.includes("insert into purchase_return_item")) {
    const returnNo = String(params[0]);
    const skuId = Number(params[1]);
    const skuName = String(params[2] ?? `SKU-${skuId}`);
    const qty = Number(params[3] ?? 0);
    const unitPrice = Number(params[4] ?? 0);
    const subtotalAmount = Number(params[5] ?? 0);
    const id = state.purchaseReturnItems.length + 1;
    state.purchaseReturnItems.push({ id, returnNo, skuId, skuName, qty, unitPrice, subtotalAmount });
    return result(id);
  }
  if (s.includes("update purchase_return set")) {
    const returnNo = String(params[params.length - 1]);
    const r = state.purchaseReturns.find((x) => x.returnNo === returnNo);
    if (r) {
      const status = extractLiteral(sql, "status");
      if (status) r.status = status;
      if (s.includes("auditor_id")) r.auditorId = Number(params[0] ?? 1);
      if (s.includes("audit_time")) r.auditTime = new Date().toISOString();
      if (s.includes("stock_rollback_flag")) r.stockRollbackFlag = 1;
    }
    return result();
  }
  if (s.includes("insert into purchase_payment")) {
    const payNo = String(params[0]);
    const purchaseOrderNo = params[1] ? String(params[1]) : null;
    const supplierId = Number(params[2] ?? 0);
    const payAmount = Number(params[3] ?? 0);
    const payMethod = String(params[4] ?? "BANK");
    const id = state.purchasePayments.length + 1;
    state.purchasePayments.push({ id, payNo, purchaseOrderNo, supplierId, payAmount, payMethod, status: "PENDING", auditorId: null, auditTime: null });
    return result(id);
  }
  if (s.includes("update purchase_payment set")) {
    const payNo = String(params[params.length - 1]);
    const p = state.purchasePayments.find((x) => x.payNo === payNo);
    if (p) {
      const status = extractLiteral(sql, "status");
      if (status) p.status = status;
      if (s.includes("auditor_id")) p.auditorId = Number(params[0] ?? 1);
      if (s.includes("audit_time")) p.auditTime = new Date().toISOString();
    }
    return result();
  }
  if (s.includes("insert into customer_payment")) {
    const receiptNo = String(params[0]);
    const customerId = Number(params[1] ?? 0);
    const customerName = String(params[2] ?? "客户");
    const payAmount = Number(params[3] ?? 0);
    const payMethod = String(params[4] ?? "BANK");
    const remark = params[5] ? String(params[5]) : null;
    const id = state.customerPayments.length + 1;
    state.customerPayments.push({ id, receiptNo, customerId, customerName, payAmount, payMethod, remark, status: "PAID", auditorId: 1, auditTime: new Date().toISOString() });
    return result(id);
  }
  if (s.includes("update customer_payment set")) {
    const receiptNo = String(params[params.length - 1]);
    const p = state.customerPayments.find((x) => x.receiptNo === receiptNo);
    if (p) {
      const status = extractLiteral(sql, "status");
      if (status) p.status = status;
      if (s.includes("auditor_id")) p.auditorId = Number(params[0] ?? 1);
      if (s.includes("audit_time")) p.auditTime = new Date().toISOString();
    }
    return result();
  }
  if (s.includes("insert into inventory_balance")) {
    const storeId = Number(params[0]);
    const skuId = Number(params[1]);
    const stockType = String(params[2] ?? "OFFLINE");
    const physicalQty = Number(params[3] ?? 0);
    const skuName = params[4] ? String(params[4]) : `SKU-${skuId}`;
    state.inventory.push({ storeId, skuId, skuName, stockType, physicalQty, lockedQty: 0, availableQty: physicalQty });
    return result(state.inventory.length);
  }
  if (s.includes("update inventory_balance")) {
    const stockType = s.includes("stock_type = ?") && params[4] ? params[4] : "OFFLINE";
    const inv = state.inventory.find(
      (i) => i.storeId === params[2] && i.skuId === params[3] && String(i.stockType) === String(stockType)
    );
    if (inv) {
      const isSubtract = s.includes("physical_qty = physical_qty - ?");
      const delta = isSubtract ? -Number(params[0]) : Number(params[0]);
      inv.physicalQty = Number(inv.physicalQty) + delta;
      inv.availableQty = Number(inv.availableQty) + delta;
    }
    return result();
  }
  return result();
}

export const mockConn = {
  execute: mockExecute,
  query: async (sql: string, params: unknown[] = []) => [await mockQuery(sql, params), undefined]
} as any;

export function resetMockDb() {
  state.suppliers = [];
  state.supplierContacts = [];
  state.purchaseOrders = [];
  state.purchaseOrderItems = [];
  state.purchaseInStockOrders = [];
  state.purchaseInStockItems = [];
  state.saleReturns = [];
  state.saleReturnItems = [];
  state.purchaseReturns = [];
  state.purchaseReturnItems = [];
  state.purchasePayments = [];
  state.customerPayments = [];
  state.customerStatements = [];
  state.customerStatementItems = [];
  state.paymentRecords = [];
  state.saleBills = [];
  state.inventoryLogs = [];
  state.miniappOrders = [];
  state.miniappOrderItems = [];
  state.holdOrders = [];
  state.refundOrders = [];
  state.paymentOrders = [];
  state.collectionLinks = [];
  // Keep existing inventory/users/stores but reset inventory list? Keep as initial snapshot.
  // Reset inventory balance to an initial baseline so tests don't accumulate.
  state.inventory = [
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "ONLINE", physicalQty: 120, lockedQty: 0, availableQty: 120 },
    { storeId: 1, skuId: 1, skuName: "示例白酒 53度 500ml 常温", stockType: "OFFLINE", physicalQty: 2, lockedQty: 0, availableQty: 2 }
  ];
}
