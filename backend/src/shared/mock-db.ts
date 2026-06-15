import { sha256 } from "./password.js";

type Row = Record<string, any>;

const state = {
  users: [
    { id: 1, username: "admin", password_hash: sha256("admin123"), real_name: "系统管理员", store_id: null, status: 1 },
    { id: 2, username: "store_manager", password_hash: sha256("admin123"), real_name: "默认店长", store_id: 1, status: 1 },
    { id: 3, username: "store_operator", password_hash: sha256("admin123"), real_name: "默认店员", store_id: 1, status: 1 }
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
  priceLogs: [] as Row[],
  holdOrders: [] as Row[],
  viewLogs: [] as Row[],
  inventoryLogs: [] as Row[],
  receivables: [] as Row[],
  operationLogs: [] as Row[]
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
  return result();
}

export const mockConn = {
  execute: mockExecute,
  query: async (sql: string, params: unknown[] = []) => [await mockQuery(sql, params), undefined]
} as any;
