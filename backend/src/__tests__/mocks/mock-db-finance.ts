/**
 * 财务/收款/付款 mock handlers: collectionLinks, paymentOrders, refundOrders, receivables, viewLogs, salePayments
 */
import { state, result, Row } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // collection_link join
  (s, params) => {
    if (s.includes("from t_collection_link") && s.includes("where cl.token")) {
      const link = state.collectionLinks.find((l) => l.token === params[0]);
      if (!link) return [];
      const bill = state.saleBills.find((b) => b.billNo === link.sourceNo);
      return [{ ...link, tenantId: link.tenant_id, storeName: "默认门店", customerName: bill?.customerName }];
    }
    return null;
  },

  // collection_link by token
  (s, params) => {
    if (s.includes("from t_collection_link where token")) {
      const link = state.collectionLinks.find((l) => l.token === params[0]);
      return link ? [{ link_no: link.linkNo, tenant_id: link.tenant_id, amount: link.amount, status: link.status }] : [];
    }
    return null;
  },

  // payment_order
  (s, _params) => {
    if (s.includes("count(*) from t_payment_order") || s.includes("count(*) from t_payment_order")) {
      return [{ total: state.paymentOrders.length }];
    }
    if (s.includes("from t_payment_order") || s.includes("from t_payment_order")) {
      return state.paymentOrders;
    }
    return null;
  },

  // refund_order
  (s, _params) => {
    if (s.includes("count(*) from t_refund_order") || s.includes("count(*) from t_refund_order")) {
      return [{ total: state.refundOrders.length }];
    }
    if (s.includes("from t_refund_order") || s.includes("from t_refund_order")) {
      return state.refundOrders;
    }
    return null;
  },

  // collection_link
  (s, _params) => {
    if (s.includes("count(*) from t_collection_link")) {
      return [{ total: state.collectionLinks.length }];
    }
    if (s.includes("from t_collection_link")) {
      return state.collectionLinks;
    }
    return null;
  },

  // receivable_account
  (s, params) => {
    if (s.includes("from t_receivable_account")) {
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
  // customer_payment INSERT
  (s, params) => {
    if (s.includes("insert into t_customer_payment")) {
      state.customerPayments.push({
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
        status: "COMPLETED",
        remark: params[10],
        tenant_id: params[11],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return [{ insertId: state.customerPayments.length, affectedRows: 1 }];
    }
    return null;
  },
  // customer_payment UPDATE (voided)
  (s, params) => {
    if (s.includes("update t_customer_payment set status = 'voided'")) {
      const payment = state.customerPayments.find((p: Row) => p.receipt_no === params[0] && p.tenant_id === params[1]);
      if (payment) payment.status = "VOIDED";
      return [{ affectedRows: 1 }];
    }
    return null;
  },
  // customer_statement INSERT
  (s, params) => {
    if (s.includes("insert into t_customer_statement")) {
      state.customerStatements.push({
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
        status: "DRAFT",
        operator_id: params[12],
        remark: params[13],
        tenant_id: params[14],
        created_at: new Date().toISOString(),
        confirmed_at: null
      });
      return [{ insertId: state.customerStatements.length, affectedRows: 1 }];
    }
    return null;
  },
  // customer_statement UPDATE (confirmed)
  (s, params) => {
    if (s.includes("update t_customer_statement set status = 'confirmed'")) {
      const st = state.customerStatements.find((x: Row) => x.statement_no === params[0] && x.tenant_id === params[1]);
      if (st) st.status = "CONFIRMED";
      return [{ affectedRows: 1 }];
    }
    return null;
  },
  // customer_statement UPDATE (paid)
  (s, params) => {
    if (s.includes("update t_customer_statement set status = 'paid'")) {
      const st = state.customerStatements.find((x: Row) => x.statement_no === params[0] && x.tenant_id === params[1]);
      if (st) st.status = "PAID";
      return [{ affectedRows: 1 }];
    }
    return null;
  },
  // collection_link INSERT
  (s, params) => {
    if (s.includes("insert into t_collection_link")) {
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
        taxAmount: Number(params[9] ?? 0),
        tenant_id: params[10]
      });
      return [];
    }
    return null;
  },
  // collection_view_log INSERT
  (s, params) => {
    if (s.includes("insert into t_collection_view_log")) {
      state.viewLogs.push({ linkNo: params[0], ip: params[1], userAgent: params[2] });
      return [];
    }
    return null;
  },
  (s, params) => {
    if ((s.includes("insert into t_payment_order") || s.includes("insert into t_payment_order")) && s.includes("'sale_bill'")) {
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
    if ((s.includes("insert into t_payment_order") || s.includes("insert into t_payment_order")) && s.includes("'receivable'")) {
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
    if (s.includes("insert into t_payment_order") || s.includes("insert into t_payment_order")) {
      // share.service payCollection 场景：列顺序为 (tenant_id, pay_no, source_type, source_no, channel, amount, status)，
      // 参数为 [tenantId, payNo, sourceNo, amount]，与 createPaymentOrder 的 [payNo, sourceType, sourceNo, amount, tenantId] 布局不同。
      if (s.includes("'collection_link'")) {
        state.paymentOrders.push({
          payNo: params[1],
          pay_no: params[1],
          sourceType: "COLLECTION_LINK",
          source_type: "COLLECTION_LINK",
          sourceNo: params[2],
          source_no: params[2],
          channel: params[3] === undefined ? "WECHAT" : params[3],
          paymentMethod: params[3] === undefined ? "WECHAT" : params[3],
          payment_method: params[3] === undefined ? "WECHAT" : params[3],
          amount: params[4] ?? params[3],
          status: "PENDING",
          tenant_id: params[0]
        });
        return result();
      }
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
    if (s.includes("insert into t_refund_order") || s.includes("insert into t_refund_order")) {
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
    if (s.includes("insert into t_receivable_account")) {
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
    if (s.includes("update t_receivable_account")) {
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

  // payment_order UPDATE (支付成功回调/状态确认)
  (s, params) => {
    if (s.includes("update t_payment_order set status")) {
      // SQL 形如：UPDATE t_payment_order SET status = 'SUCCESS', transaction_id = ?, paid_at = NOW()
      //          WHERE pay_no = ? AND source_no = ? AND tenant_id = ?
      // params[0]=transactionId, params[1]=payNo, params[2]=source_no, params[3]=tenant_id
      const payment = state.paymentOrders.find((p) => p.payNo === params[1] || p.pay_no === params[1]);
      if (payment) {
        payment.status = "SUCCESS";
        payment.transactionId = params[0] ?? null;
        payment.transaction_id = params[0] ?? null;
        payment.paidAt = new Date().toISOString();
        payment.paid_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },
];
