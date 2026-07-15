/**
 * 订单/销售单 mock handlers: saleBills, saleBillItems, miniappOrders, miniappOrderItems, holdOrders, platformOrders
 * 修复坑：业务表使用 t_ 前缀（如 t_sale_bill），需同时匹配带前缀和不带前缀的形式
 */
import { state, result, Row, fromTable, insertIntoTable, updateTable } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // sale_bill 汇总 (sum received_amount, unreceived_amount)
  (s, _params) => {
    if (s.includes("sum(received_amount)")) {
      const amount = state.saleBills.reduce((sum, b) => sum + Number(b.receivedAmount || b.received_amount || 0), 0);
      return [{ amount, count: state.saleBills.length }];
    }
    if (s.includes("sum(unreceived_amount)")) {
      const amount = state.saleBills.reduce((sum, b) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
      return [{ amount }];
    }
    return null;
  },

  // miniapp_order count
  (s, params) => {
    if (s.includes("count(*) as cnt from miniapp_order")) {
      if (s.includes("pending_payment")) {
        const queryStoreId = Number(params[0]);
        const pool = queryStoreId && !Number.isNaN(queryStoreId)
          ? state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId)
          : state.miniappOrders;
        const cnt = pool.filter((o: Row) => (o.orderStatus || o.order_status) === "PENDING_PAYMENT").length;
        return [{ cnt }];
      }
      if (s.includes("store_id")) {
        const queryStoreId = Number(params[0]);
        const cnt = state.miniappOrders.filter((o: Row) => (o.storeId || o.store_id) === queryStoreId).length;
        return [{ cnt }];
      }
      return [{ cnt: state.miniappOrders.length }];
    }
    return null;
  },

  // miniapp_order 状态统计
  (s, _params) => {
    if (s.includes("order_status as status") && s.includes("from miniapp_order")) {
      const map = new Map<string, number>();
      for (const order of state.miniappOrders) {
        const st = String(order.order_status ?? order.orderStatus ?? "未知");
        map.set(st, (map.get(st) || 0) + 1);
      }
      return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
    }
    return null;
  },

  // miniapp_order count by status
  (s, params) => {
    if (s.includes("from miniapp_order") && s.includes("count(*)")) {
      const statusIndex = s.includes("order_status = ?") ? 0 : -1;
      const filtered = statusIndex >= 0
        ? state.miniappOrders.filter((o) => (o.orderStatus || o.order_status) === params[statusIndex])
        : state.miniappOrders;
      return [{ total: filtered.length, count: filtered.length }];
    }
    return null;
  },

  // miniapp_order by order_no
  (s, params) => {
    if (s.includes("from miniapp_order") && s.includes("where order_no = ?")) {
      const order = state.miniappOrders.find((o) => o.orderNo === params[0] || o.order_no === params[0]);
      return order ? [order] : [];
    }
    return null;
  },

  // miniapp_order list
  (s, params) => {
    if (s.includes("from miniapp_order") && !s.includes("group by") && !s.includes("count(*)")) {
      const statusIndex = s.includes("order_status = ?") ? 0 : -1;
      const filtered = statusIndex >= 0
        ? state.miniappOrders.filter((o) => (o.orderStatus || o.order_status) === params[statusIndex])
        : state.miniappOrders;
      return filtered;
    }
    return null;
  },

  // miniapp_order_item
  (s, params) => {
    if (s.includes("from miniapp_order_item") && s.includes("where order_no = ?")) {
      return state.miniappOrderItems.filter((item) => item.orderNo === params[0] || item.order_no === params[0]);
    }
    return null;
  },

  // sale_bill date group by
  (s, _params) => {
    if ((s.includes("date(created_at)") || s.includes("date(sb.created_at)")) && fromTable(s, "sale_bill") && s.includes("group by")) {
      const map = new Map<string, { date: string; count: number; amount: number }>();
      for (const bill of state.saleBills) {
        const d = (bill.createdAt as string).slice(0, 10);
        const entry = map.get(d) || { date: d, count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += Number(bill.receivableAmount || bill.receivable_amount || 0);
        map.set(d, entry);
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
    return null;
  },

  // sale_bill sum receivable_amount
  (s, params) => {
    if (s.includes("coalesce(sum(receivable_amount")) {
      const queryStoreId = Number(params[0]);
      const bills = queryStoreId && !Number.isNaN(queryStoreId)
        ? state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === queryStoreId)
        : state.saleBills;
      const total = bills.reduce((sum: number, b: Row) => sum + Number(b.receivableAmount || b.receivable_amount || 0), 0);
      return [{ total }];
    }
    return null;
  },

  // sale_bill sum unreceived_amount
  (s, params) => {
    if (s.includes("coalesce(sum(unreceived_amount")) {
      const queryStoreId = Number(params[0]);
      const bills = queryStoreId && !Number.isNaN(queryStoreId)
        ? state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === queryStoreId)
        : state.saleBills;
      const total = bills.reduce((sum: number, b: Row) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
      return [{ total }];
    }
    return null;
  },

  // sale_bill count
  (s, _params) => {
    if (fromTable(s, "sale_bill") && s.includes("count(*)")) return [{ total: state.saleBills.length }];
    return null;
  },

  // sale_bill_item by bill_no
  (s, params) => {
    if (fromTable(s, "sale_bill_item") && s.includes("where bill_no")) {
      return state.saleBillItems.filter((i) => i.billNo === params[0] || i.bill_no === params[0]);
    }
    return null;
  },

  // sale_bill by bill_no
  (s, params) => {
    if (fromTable(s, "sale_bill") && s.includes("where bill_no = ?")) {
      const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
      return bill ? [bill] : [];
    }
    return null;
  },

  // sale_bill general
  (s, _params) => {
    if (fromTable(s, "sale_bill") && !s.includes("join") && !s.includes("group by") && !s.includes("count(*)")) return state.saleBills;
    return null;
  },

  // hold_order
  (s, params) => {
    if (s.includes("count(*) from hold_order")) {
      return [{ total: state.holdOrders.filter((h) => h.status !== "DELETED").length }];
    }
    if (s.includes("from hold_order") && s.includes("where hold_no = ?")) {
      const hold = state.holdOrders.find((h) => (h.holdNo === params[0] || h.hold_no === params[0]) && h.status !== "DELETED");
      return hold ? [hold] : [];
    }
    if (s.includes("from hold_order")) {
      return state.holdOrders.filter((h) => h.status !== "DELETED");
    }
    return null;
  },

  // select 1 as ok
  (s, _params) => {
    if (s.includes("select 1 as ok")) return [{ ok: 1 }];
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // sale_bill INSERT
  (s, params) => {
    if (insertIntoTable(s, "sale_bill")) {
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
    return null;
  },

  // sale_bill_item INSERT
  (s, params) => {
    if (insertIntoTable(s, "sale_bill_item")) {
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
    return null;
  },

  // miniapp_order INSERT
  (s, params) => {
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
    return null;
  },

  // miniapp_order_item INSERT
  (s, params) => {
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
    return null;
  },

  // miniapp_order UPDATE
  (s, params) => {
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
      return [];
    }
    return null;
  },

  // sale_bill UPDATE
  (s, params) => {
    if (updateTable(s, "sale_bill")) {
      if (s.includes("collection_status = 'shared'")) {
        const bill = state.saleBills.find((b) => b.billNo === params[0] || b.bill_no === params[0]);
        if (!bill) return [];
        bill.collectionStatus = "SHARED";
        bill.collection_status = "SHARED";
        return [];
      }
      if (s.includes("received_amount = ?")) {
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
      return [];
    }
    return null;
  },

  // hold_order INSERT
  (s, params) => {
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
      return [];
    }
    return null;
  },

  // hold_order UPDATE (DELETE)
  (s, params) => {
    if (s.includes("update hold_order set status = 'DELETED'")) {
      const hold = state.holdOrders.find((h) => h.holdNo === params[0] || h.hold_no === params[0]);
      if (hold) hold.status = "DELETED";
      return [];
    }
    return null;
  },
];