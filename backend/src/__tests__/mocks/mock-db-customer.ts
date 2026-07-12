import { state, Row } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  (s, params) => {
    if (s.includes("count(*) as total from member")) return [{ total: state.members.length }];
    if (s.includes("from member") && s.includes("where id = ?")) {
      const member = state.members.find((m) => Number(m.id) === Number(params[0]));
      if (!member) return [];
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
      }];
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
      });
    }
    return null;
  },
  (s, params) => {
    if (s.includes("from customer_statement") && s.includes("count(*)")) {
      return [{ total: state.customerStatements.length }];
    }
    if (s.includes("from customer_statement") && s.includes("where id = ?")) {
      const stmt = state.customerStatements.find((st: Row) => st.id === Number(params[0]));
      return stmt ? [stmt] : [];
    }
    if (s.includes("from customer_statement") && !s.includes("count(*)")) {
      return state.customerStatements;
    }
    return null;
  },
  (s, params) => {
    if (s.includes("from customer_payment") && s.includes("count(*)")) {
      return [{ total: state.customerPayments.length }];
    }
    if (s.includes("from customer_payment") && !s.includes("count(*)")) {
      return state.customerPayments;
    }
    return null;
  },
  (s, params) => {
    if (s.includes("from sale_bill") && s.includes("where customer_id = ?") && s.includes("count(*)")) {
      const cnt = state.saleBills.filter((b: Row) => b.customerId === Number(params[0]) || b.customer_id === Number(params[0])).length;
      return [{ total: cnt }];
    }
    if (s.includes("from sale_bill") && s.includes("where customer_id = ?") && !s.includes("count(*)") && !s.includes("sum(")) {
      return state.saleBills.filter((b: Row) => b.customerId === Number(params[0]) || b.customer_id === Number(params[0]));
    }
    return null;
  },
  (s, params) => {
    if (s.includes("from sale_payment") && s.includes("from customer_payment")) {
      const memberId = Number(params[0]);
      const sp = state.salePayments.filter((p: Row) => p.customer_id === memberId);
      const cp = state.customerPayments.filter((p: Row) => p.customer_id === memberId);
      return [...sp, ...cp];
    }
    return null;
  },
  (s, params) => {
    if (s.includes("count(*) as total from member where status")) {
      return [{ total: state.members.length }];
    }
    if (s.includes("count(*) as cnt from member") && s.includes("date_format")) {
      return [{ cnt: 0 }];
    }
    if (s.includes("count(distinct customer_id) as cnt") && s.includes("created_at >= date_sub")) {
      const activeIds = new Set(state.saleBills.filter((b: Row) => b.customerId || b.customer_id).map((b: Row) => b.customerId || b.customer_id));
      return [{ cnt: activeIds.size }];
    }
    if (s.includes("count(distinct customer_id) as cnt") && s.includes("unreceived_amount > 0")) {
      const debtIds = new Set(state.saleBills.filter((b: Row) => (b.unreceivedAmount || b.unreceived_amount) > 0).map((b: Row) => b.customerId || b.customer_id));
      return [{ cnt: debtIds.size }];
    }
    if (s.includes("coalesce(sum(unreceived_amount), 0) as total") && s.includes("unreceived_amount > 0") && s.includes("customer_id is not null")) {
      const total = state.saleBills.reduce((sum: number, b: Row) => sum + Number(b.unreceivedAmount || b.unreceived_amount || 0), 0);
      return [{ total }];
    }
    return null;
  },
  (s, params) => {
    if (s.includes("count(*) as billcount") && s.includes("from sale_bill") && s.includes("where customer_id")) {
      const bills = state.saleBills.filter((b: Row) => (b.customerId || b.customer_id) === Number(params[0]) && b.businessStatus !== "DRAFT" && b.businessStatus !== "VOIDED");
      return [{ billCount: bills.length, totalAmount: 0, receivedAmount: 0, unpaidAmount: 0 }];
    }
    if (s.includes("from sale_bill_item sbi") && s.includes("join sale_bill sb") && s.includes("group by sbi.sku_id")) {
      return [];
    }
    if (s.includes("max(created_at) as lastorderat") && s.includes("from sale_bill") && s.includes("where customer_id")) {
      return [{ lastOrderAt: null }];
    }
    return null;
  },
  (s, params) => {
    if (s.includes("coalesce(sum(unreceived_amount), 0) as balance") && s.includes("date(created_at) < ?")) {
      return [{ balance: 0 }];
    }
    if (s.includes("coalesce(sum(receivable_amount), 0) as total") && s.includes("from sale_bill") && s.includes("date(created_at) >= ?") && s.includes("date(created_at) <= ?")) {
      return [{ total: 0 }];
    }
    if (s.includes("coalesce(sum(refund_amount), 0) as total") && s.includes("from sale_return")) {
      return [{ total: 0 }];
    }
    if (s.includes("coalesce(sum(amount), 0) as total") && s.includes("from customer_payment") && s.includes("payment_date >= ?")) {
      return [{ total: 0 }];
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  (s, params) => {
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
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },
  (s, params) => {
    if (s.includes("update member set staff_id")) {
      const member = state.members.find((m) => Number(m.id) === Number(params[1]));
      if (member) member.staff_id = Number(params[0]);
      return [];
    }
    return null;
  },
  (s, params) => {
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
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },
  (s, params) => {
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
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },
];
