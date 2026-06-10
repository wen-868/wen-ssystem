import { sha256 } from "./password.js";

type Row = Record<string, any>;

const state = {
  users: [
    { id: 1, username: "admin", password_hash: sha256("admin123"), real_name: "系统管理员", store_id: null, status: 1 }
  ],
  roles: [{ id: 1, role_code: "SUPER_ADMIN", role_name: "超级管理员", status: 1 }],
  stores: [
    { id: 1, store_code: "STORE0001", name: "默认门店", address: "演示地址", contact: "管理员", phone: "13800000000", delivery_radius: 3, business_status: "OPEN", status: 1 }
  ],
  products: [
    { spuId: 1, skuId: 1, name: "示例白酒 53度 500ml", skuName: "示例白酒 53度 500ml 常温", skuCode: "SKU-DEMO-001", barcode: "690000000001", retailPrice: 129, wholesalePrice: 99, miniappPrice: 119, costPrice: 0, storePrice: null as number | null, status: "ON_SALE" }
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
  viewLogs: [] as Row[],
  inventoryLogs: [] as Row[]
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
    return state.roles.map((r) => ({ role_code: r.role_code })) as T[];
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
  if (s.includes("select s.sku_name") && s.includes("from product_sku s") && s.includes("join product_price")) {
    const product = state.products.find((p) => p.skuId === params[0]);
    return product
      ? [{
          sku_name: product.skuName,
          retail_price: product.retailPrice,
          wholesale_price: product.wholesalePrice,
          miniapp_price: product.miniappPrice,
          store_price: product.retailPrice
        }] as T[]
      : [];
  }
  if (s.includes("from product_sku") && s.includes("join product_spu") && s.includes("join product_price")) {
    return state.products as T[];
  }
  if (s.includes("update inventory_balance")) {
    const inv = state.inventory.find(
      (i) => i.storeId === params[2] && i.skuId === params[3] && i.stockType === params[4]
    );
    if (inv) {
      inv.physicalQty = Number(inv.physicalQty) + Number(params[0]);
      inv.availableQty = Number(inv.availableQty) + Number(params[1]);
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
    const inv = state.inventory.find(
      (i) => i.storeId === params[0] && i.skuId === params[1] && i.stockType === params[2]
    );
    return inv ? [{ physicalQty: inv.physicalQty, physical_qty: inv.physicalQty }] as T[] : [] as T[];
  }
  if (s.includes("from inventory_balance")) return state.inventory as T[];
  if (s.includes("from inventory_log") && s.includes("count(*)")) {
    return [{ total: state.inventoryLogs.length }] as T[];
  }
  if (s.includes("from inventory_log")) return state.inventoryLogs as T[];
  if (s.includes("sum(received_amount)")) {
    const amount = state.saleBills.reduce((sum, b) => sum + Number(b.receivedAmount || b.received_amount || 0), 0);
    return [{ amount, count: state.saleBills.length }] as T[];
  }
  if (s.includes("sum(unreceived_amount)")) {
    const amount = state.saleBills.reduce((sum, b) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
    return [{ amount }] as T[];
  }
  if (s.includes("from miniapp_order") && s.includes("count(*)")) return [{ total: state.miniappOrders.length, count: state.miniappOrders.length }] as T[];
  if (s.includes("from miniapp_order") && s.includes("where order_no = ?")) {
    const order = state.miniappOrders.find((o) => o.orderNo === params[0] || o.order_no === params[0]);
    return order ? [order] as T[] : [];
  }
  if (s.includes("from miniapp_order") && !s.includes("group by") && !s.includes("count(*)")) return state.miniappOrders as T[];
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
  if (s.includes("order_status as status") && s.includes("from miniapp_order")) {
    const map = new Map<string, number>();
    for (const order of state.miniappOrders) {
      const st = String(order.order_status ?? order.orderStatus ?? "未知");
      map.set(st, (map.get(st) || 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count })) as T[];
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
  if (s.includes("count(*) as cnt from miniapp_order")) {
    if (s.includes("pending_payment")) {
      const queryStoreId = Number(params[0]);
      const pool = queryStoreId && !Number.isNaN(queryStoreId)
        ? state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId)
        : state.miniappOrders;
      const cn = pool.filter((o: Row) => (o.orderStatus || o.order_status) === "PENDING_PAYMENT").length;
      return [{ cnt: cn }] as T[];
    }
    if (s.includes("store_id")) {
      const queryStoreId = Number(params[0]);
      const cn = state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId).length;
      return [{ cnt: cn }] as T[];
    }
    return [{ cnt: state.miniappOrders.length }] as T[];
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
    state.collectionLinks.push({ linkNo: params[0], sourceType: "SALE_BILL", sourceNo: params[1], amount: params[2], paidAmount: 0, status: "PENDING", shareChannel: params[3], expireAt: new Date(Date.now() + Number(params[5]) * 3600_000).toISOString(), token: params[6] });
    return [] as T[];
  }
  if (s.includes("update sale_bill")) {
    const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
    if (bill && s.includes("collection_status = 'shared'")) {
      bill.collectionStatus = "SHARED";
      bill.collection_status = "SHARED";
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
    state.paymentOrders.push({ payNo: params[0], sourceType: params[1], sourceNo: params[2], amount: params[3], status: "PENDING" });
    return [] as T[];
  }
  if (s.includes("insert into refund_order")) {
    state.refundOrders.push({ refundNo: params[0], amount: params[1], reason: params[2], payNo: params[3], status: "PENDING" });
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
  return result();
}

export const mockConn = {
  execute: mockExecute,
  query: async (sql: string, params: unknown[] = []) => [await mockQuery(sql, params), undefined]
} as any;
