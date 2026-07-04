/**
 * 供应商/采购 mock handlers: suppliers, supplierContacts, purchaseOrders, purchaseOrderItems,
 *   purchaseInStocks, purchaseInStockItems, purchaseReturns, purchaseReturnItems, purchasePayments
 */
import { state, result, Row } from "./mock-db-state.js";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // supplier
  (s, params) => {
    if (s.includes("from supplier") && s.includes("count(*)")) {
      const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === params[0]) : state.suppliers;
      return [{ total: filtered.length }];
    }
    if (s.includes("from supplier") && s.includes("where id = ?")) {
      const supplier = state.suppliers.find((sup: Row) => sup.id === Number(params[0]));
      if (!supplier) return [];
      const contacts = state.supplierContacts.filter((c: Row) => c.supplier_id === supplier.id);
      return [{ ...supplier, contacts }];
    }
    if (s.includes("from supplier") && !s.includes("count(*)")) {
      return state.suppliers;
    }
    return null;
  },

  // supplier_contact
  (s, params) => {
    if (s.includes("from supplier_contact") && s.includes("where supplier_id")) {
      return state.supplierContacts.filter((c: Row) => c.supplier_id === Number(params[0]));
    }
    return null;
  },

  // purchase_order
  (s, params) => {
    if (s.includes("count(*) as cnt from purchase_order") && s.includes("where supplier_id")) {
      const cnt = state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0])).length;
      return [{ cnt }];
    }
    if (s.includes("from purchase_order") && s.includes("count(*)")) {
      return [{ total: state.purchaseOrders.length }];
    }
    if (s.includes("from purchase_order") && s.includes("where id = ?")) {
      const order = state.purchaseOrders.find((o: Row) => o.id === Number(params[0]));
      return order ? [order] : [];
    }
    if (s.includes("from purchase_order") && !s.includes("count(*)")) {
      const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0])) : state.purchaseOrders;
      return filtered;
    }
    return null;
  },

  // purchase_order_item
  (s, params) => {
    if (s.includes("from purchase_order_item") && s.includes("where order_no")) {
      return state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]);
    }
    if (s.includes("from purchase_order_item poi") && s.includes("join purchase_order po")) {
      return [];
    }
    return null;
  },

  // purchase_payment
  (s, params) => {
    if (s.includes("from purchase_payment") && s.includes("count(*)")) {
      return [{ total: state.purchasePayments.length }];
    }
    if (s.includes("from purchase_payment")) {
      const filtered = s.includes("where supplier_id") ? state.purchasePayments.filter((p: Row) => p.supplier_id === Number(params[0])) : state.purchasePayments;
      return filtered;
    }
    return null;
  },

  // purchase_in_stock
  (s, params) => {
    if (s.includes("from purchase_in_stock") && s.includes("count(*)")) {
      return [{ total: state.purchaseInStocks.length }];
    }
    if (s.includes("from purchase_in_stock") && s.includes("where id = ?")) {
      const stock = state.purchaseInStocks.find((st: Row) => st.id === Number(params[0]));
      return stock ? [stock] : [];
    }
    if (s.includes("from purchase_in_stock") && !s.includes("count(*)")) {
      return state.purchaseInStocks;
    }
    return null;
  },

  // purchase_in_stock_item
  (s, params) => {
    if (s.includes("from purchase_in_stock_item") && s.includes("where stock_no")) {
      return state.purchaseInStockItems.filter((i: Row) => i.stock_no === params[0]);
    }
    return null;
  },

  // purchase_return
  (s, params) => {
    if (s.includes("from purchase_return") && s.includes("count(*)")) {
      return [{ total: state.purchaseReturns.length }];
    }
    if (s.includes("from purchase_return") && !s.includes("count(*)")) {
      return state.purchaseReturns;
    }
    return null;
  },

  // sale_return
  (s, params) => {
    if (s.includes("from sale_return") && s.includes("count(*)")) {
      return [{ total: state.saleReturns.length }];
    }
    if (s.includes("from sale_return") && s.includes("where id = ?")) {
      const ret = state.saleReturns.find((r: Row) => r.id === Number(params[0]));
      return ret ? [ret] : [];
    }
    if (s.includes("from sale_return") && !s.includes("count(*)")) {
      return state.saleReturns;
    }
    return null;
  },

  // sale_return_item
  (s, params) => {
    if (s.includes("from sale_return_item") && s.includes("where return_no")) {
      return state.saleReturnItems.filter((i: Row) => i.return_no === params[0]);
    }
    return null;
  },

  // 供应商绩效统计
  (s, params) => {
    if (s.includes("sum(case when actual_date is not null and actual_date <= expected_date")) {
      return [{ totalOrders: 0, onTimeOrders: 0, lateOrders: 0 }];
    }
    if (s.includes("coalesce(sum(payable_amount), 0) as totalamount") && s.includes("from purchase_order") && s.includes("supplier_id")) {
      return [{ totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }];
    }
    if (s.includes("count(*) as returncount") && s.includes("from purchase_return") && s.includes("supplier_id")) {
      return [{ returnCount: 0, returnAmount: 0 }];
    }
    if (s.includes("count(*) as cnt from purchase_order") && s.includes("supplier_id") && s.includes("order_status not in")) {
      return [{ cnt: 0 }];
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // supplier INSERT
  (s, params) => {
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
    return null;
  },

  // supplier UPDATE
  (s, params) => {
    if (s.includes("update supplier set") && s.includes("where id")) {
      const supplier = state.suppliers.find((sup: Row) => sup.id === Number(params[params.length - 1]));
      if (supplier) {
        supplier.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // supplier_contact INSERT
  (s, params) => {
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
    return null;
  },

  // supplier_contact DELETE
  (s, params) => {
    if (s.includes("delete from supplier_contact")) {
      state.supplierContacts = state.supplierContacts.filter((c: Row) => c.supplier_id !== Number(params[0]));
      return result();
    }
    return null;
  },

  // supplier DELETE
  (s, params) => {
    if (s.includes("delete from supplier") && s.includes("where id")) {
      state.suppliers = state.suppliers.filter((sup: Row) => sup.id !== Number(params[0]));
      return result();
    }
    return null;
  },

  // purchase_order INSERT
  (s, params) => {
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
    return null;
  },

  // purchase_order_item INSERT
  (s, params) => {
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
    return null;
  },

  // purchase_order_item DELETE
  (s, params) => {
    if (s.includes("delete from purchase_order_item where order_no")) {
      state.purchaseOrderItems = state.purchaseOrderItems.filter((i: Row) => i.order_no !== params[0]);
      return result();
    }
    return null;
  },

  // purchase_order UPDATE
  (s, params) => {
    if (s.includes("update purchase_order set") && s.includes("where id")) {
      const order = state.purchaseOrders.find((o: Row) => o.id === Number(params[params.length - 1]));
      if (order) {
        if (s.includes("order_status = 'cancelled'")) order.order_status = "CANCELLED";
        if (s.includes("order_status = 'approved'")) order.order_status = "APPROVED";
        order.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // purchase_order_item UPDATE (in_stocked_qty)
  (s, params) => {
    if (s.includes("update purchase_order_item set in_stocked_qty")) {
      const item = state.purchaseOrderItems.find((i: Row) => i.order_no === params[1] && i.sku_id === Number(params[2]));
      if (item) item.in_stocked_qty = (item.in_stocked_qty || 0) + Number(params[0]);
      return result();
    }
    return null;
  },

  // purchase_in_stock INSERT
  (s, params) => {
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
    return null;
  },

  // purchase_in_stock_item INSERT
  (s, params) => {
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
    return null;
  },

  // purchase_return INSERT
  (s, params) => {
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
    return null;
  },

  // purchase_return_item INSERT
  (s, params) => {
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
    return null;
  },

  // sale_return INSERT
  (s, params) => {
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
    return null;
  },

  // sale_return_item INSERT
  (s, params) => {
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
    return null;
  },
];