/**
 * 财务/收款/付款 mock handlers: collectionLinks, paymentOrders, refundOrders, receivables, viewLogs, salePayments
 */
import { state, result, Row } from "./mock-db-state.js";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // collection_link INSERT
  (s, params) => {
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
      return [];
    }
    return null;
  },

  // collection_link join
  (s, params) => {
    if (s.includes("from collection_link") && s.includes("where cl.token")) {
      const link = state.collectionLinks.find((l) => l.token === params[0]);
      if (!link) return [];
      const bill = state.saleBills.find((b) => b.billNo === link.sourceNo);
      return [{ ...link, storeName: "默认门店", customerName: bill?.customerName }];
    }
    return null;
  },

  // collection_link by token
  (s, params) => {
    if (s.includes("from collection_link where token")) {
      const link = state.collectionLinks.find((l) => l.token === params[0]);
      return link ? [{ link_no: link.linkNo, amount: link.amount, status: link.status }] : [];
    }
    return null;
  },

  // collection_view_log INSERT
  (s, params) => {
    if (s.includes("insert into collection_view_log")) {
      state.viewLogs.push({ linkNo: params[0], ip: params[1], userAgent: params[2] });
      return [];
    }
    return null;
  },

  // payment_order
  (s, params) => {
    if (s.includes("count(*) from payment_order")) {
      return [{ total: state.paymentOrders.length }];
    }
    if (s.includes("from payment_order")) {
      return state.paymentOrders;
    }
    return null;
  },

  // refund_order
  (s, params) => {
    if (s.includes("count(*) from refund_order")) {
      return [{ total: state.refundOrders.length }];
    }
    if (s.includes("from refund_order")) {
      return state.refundOrders;
    }
    return null;
  },

  // collection_link
  (s, params) => {
    if (s.includes("count(*) from collection_link")) {
      return [{ total: state.collectionLinks.length }];
    }
    if (s.includes("from collection_link")) {
      return state.collectionLinks;
    }
    return null;
  },

  // receivable_account
  (s, params) => {
    if (s.includes("from receivable_account")) {
      if (s.includes("count(*) as total")) {
        return [{ total: state.receivables.length }];
      }
      if (s.includes("where receivable_no = ?")) {
        const found = state.receivables.find((r) => r.receivableNo === params[0] || r.receivable_no === params[0]);
        return found ? [found] : [];
      }
      return state.receivables;
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // payment_order INSERT (sale_bill)
  (s, params) => {
    if (s.includes("insert into payment_order") && s.includes("'sale_bill'")) {
      state.paymentOrders.push({
        payNo: params[0],
        pay_no: params[0],
        sourceType: "SALE_BILL",
        source_type: "SALE_BILL",
        sourceNo: params[1],
        source_no: params[1],
        channel: params[2],
        amount: params[3],
        status: "SUCCESS",
        paymentMethod: params[2],
        payment_method: params[2]
      });
      return [];
    }
    return null;
  },

  // payment_order INSERT (receivable)
  (s, params) => {
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
    return null;
  },

  // payment_order INSERT (generic)
  (s, params) => {
    if (s.includes("insert into payment_order")) {
      state.paymentOrders.push({
        payNo: params[0],
        pay_no: params[0],
        sourceType: params[1] ?? "SALE_BILL",
        source_type: params[1] ?? "SALE_BILL",
        sourceNo: params[2],
        source_no: params[2],
        channel: params[2],
        paymentMethod: params[2],
        payment_method: params[2],
        amount: params[3],
        status: "PENDING"
      });
      return result();
    }
    return null;
  },

  // refund_order INSERT
  (s, params) => {
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
      return [];
    }
    return null;
  },

  // receivable_account INSERT
  (s, params) => {
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
    return null;
  },

  // receivable_account UPDATE
  (s, params) => {
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
    return null;
  },
];