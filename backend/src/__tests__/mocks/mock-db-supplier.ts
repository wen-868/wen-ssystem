/**
 * 供应商/采购 mock handlers: suppliers, supplierContacts, purchaseOrders, purchaseOrderItems,
 *   purchaseInStocks, purchaseInStockItems, purchaseReturns, purchaseReturnItems, purchasePayments,
 *   saleReturns, saleReturnItems, customerStatements, customerPayments
 * 修复坑：
 *   1. 业务表使用 t_ 前缀（如 t_purchase_order），需同时匹配带前缀和不带前缀的形式
 *   2. INSERT 语句中的字面量（如 'DRAFT', 'PENDING', 0）不占用 params 位置，参数映射需跳过
 *   3. 所有 INSERT 必须保存 tenant_id，以支持租户隔离测试
 */
import { state, result, Row, fromTable, updateTable, insertIntoTable, deleteFromTable } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // ========== supplier 表 ==========
  // 供应商统计计数
  (s, params) => {
    if (fromTable(s, "supplier") && s.includes("count(*)")) {
      const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === params[0]) : state.suppliers;
      return [{ total: filtered.length }];
    }
    return null;
  },
  // 供应商详情（含联系人）
  (s, params) => {
    if (fromTable(s, "supplier") && s.includes("where id = ?")) {
      const supplier = state.suppliers.find((sup: Row) => sup.id === Number(params[0]));
      if (!supplier) return [];
      const contacts = state.supplierContacts.filter((c: Row) => c.supplier_id === supplier.id);
      return [{ ...supplier, contacts }];
    }
    return null;
  },
  // 供应商列表（带 LEFT JOIN t_supplier_contact）
  (s, params) => {
    if (fromTable(s, "supplier") && s.includes("left join") && s.includes("sc.is_primary = 1")) {
      return state.suppliers.map((sup: Row) => {
        const contact = state.supplierContacts.find((c: Row) => c.supplier_id === sup.id && c.is_primary === 1);
        return {
          ...sup,
          contact_person: contact?.name || null,
          contact_mobile: contact?.mobile || null,
        };
      });
    }
    return null;
  },
  // 供应商列表（通用）
  (s, params) => {
    if (fromTable(s, "supplier") && !s.includes("count(*)") && !s.includes("where id")) {
      return state.suppliers;
    }
    return null;
  },

  // ========== t_supplier_contact 表 ==========
  (s, params) => {
    if (fromTable(s, "supplier_contact") && s.includes("where supplier_id")) {
      return state.supplierContacts.filter((c: Row) => c.supplier_id === Number(params[0]));
    }
    return null;
  },
  // 按 id 查询联系人
  (s, params) => {
    if (fromTable(s, "supplier_contact") && s.includes("where id = ?") && s.includes("supplier_id")) {
      const contact = state.supplierContacts.find((c: Row) => c.id === Number(params[0]) && c.supplier_id === Number(params[1]));
      return contact ? [contact] : [];
    }
    return null;
  },

  // ========== t_purchase_order 表 ==========
  // 供应商统计：订单数和总金额
  (s, params) => {
    if (fromTable(s, "purchase_order") && s.includes("count(*) as ordercount") && s.includes("supplier_id")) {
      const orders = state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0]) && o.tenant_id === params[1]);
      const totalAmount = orders.reduce((sum, o) => sum + Number(o.payable_amount || 0), 0);
      return [{ orderCount: orders.length, totalAmount }];
    }
    return null;
  },
  // 供应商未完成订单数
  (s, params) => {
    if (s.includes("count(*) as cnt") && fromTable(s, "purchase_order") && s.includes("supplier_id") && s.includes("order_status not in")) {
      const cnt = state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0]) && o.order_status !== "CANCELLED" && o.order_status !== "COMPLETED").length;
      return [{ cnt }];
    }
    return null;
  },
  // 列表计数
  (s, params) => {
    if (fromTable(s, "purchase_order") && s.includes("count(*)") && !s.includes("supplier_id")) {
      return [{ total: state.purchaseOrders.length }];
    }
    return null;
  },
  // 按订单号查询
  (s, params) => {
    if (fromTable(s, "purchase_order") && s.includes("where order_no = ?") && s.includes("tenant_id")) {
      const order = state.purchaseOrders.find((o: Row) => o.order_no === params[0] && o.tenant_id === params[1]);
      if (!order) return [];
      return [{
        ...order,
        orderNo: order.order_no,
        supplierId: order.supplier_id,
        supplierName: order.supplier_name,
        storeId: order.store_id,
        status: order.order_status,
        goodsAmount: order.goods_amount,
        taxAmount: order.tax_amount,
        discountAmount: order.discount_amount,
        payableAmount: order.payable_amount,
        paidAmount: order.paid_amount,
        unpaidAmount: order.unpaid_amount,
        expectedDate: order.expected_date,
        operatorId: order.operator_id,
        tenantId: order.tenant_id,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      }];
    }
    return null;
  },
  // 列表（带别名）
  (s, params) => {
    if (fromTable(s, "purchase_order") && s.includes("as orderno") && !s.includes("count(*)")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const filtered = state.purchaseOrders; // 租户过滤由 queryWithTenant 处理
      const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((o: Row) => ({
        ...o,
        orderNo: o.order_no,
        supplierId: o.supplier_id,
        supplierName: o.supplier_name,
        storeId: o.store_id,
        status: o.order_status,
        goodsAmount: o.goods_amount,
        taxAmount: o.tax_amount,
        discountAmount: o.discount_amount,
        payableAmount: o.payable_amount,
        paidAmount: o.paid_amount,
        unpaidAmount: o.unpaid_amount,
        expectedDate: o.expected_date,
        operatorId: o.operator_id,
        tenantId: o.tenant_id,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      }));
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "purchase_order") && !s.includes("count(*)") && !s.includes("where order_no")) {
      const filtered = s.includes("where supplier_id") ? state.purchaseOrders.filter((o: Row) => o.supplier_id === Number(params[0])) : state.purchaseOrders;
      return filtered;
    }
    return null;
  },

  // ========== t_purchase_order_item 表 ==========
  // 按订单号查询明细（带别名）
  (s, params) => {
    if (fromTable(s, "purchase_order_item") && s.includes("where order_no") && s.includes("as skuid")) {
      return state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]).map((i: Row) => ({
        ...i,
        skuId: i.sku_id,
        skuName: i.sku_name,
        boxQty: i.box_qty,
        bottleQty: i.bottle_qty,
        totalBottleQty: i.total_bottle_qty,
        unitPrice: i.unit_price,
        taxRate: i.tax_rate,
        subtotalAmount: i.subtotal_amount,
        taxAmount: i.tax_amount,
        totalAmount: i.total_amount,
        inStockedQty: i.in_stocked_qty || 0,
      }));
    }
    return null;
  },
  // 按订单号查询入库数量
  (s, params) => {
    if (fromTable(s, "purchase_order_item") && s.includes("in_stocked_qty") && s.includes("where order_no")) {
      return state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]);
    }
    return null;
  },
  // 汇总查询：剩余未入库数量
  (s, params) => {
    if (fromTable(s, "purchase_order_item") && s.includes("sum(total_bottle_qty - in_stocked_qty)")) {
      const items = state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]);
      const remaining = items.reduce((sum, i) => sum + (Number(i.total_bottle_qty || 0) - Number(i.in_stocked_qty || 0)), 0);
      return [{ remainingQty: remaining }];
    }
    return null;
  },
  // 通用查询
  (s, params) => {
    if (fromTable(s, "purchase_order_item") && s.includes("where order_no")) {
      return state.purchaseOrderItems.filter((i: Row) => i.order_no === params[0]);
    }
    return null;
  },
  // JOIN 查询（供应商产品）
  (s, params) => {
    if (fromTable(s, "purchase_order_item") && s.includes("join") && fromTable(s, "purchase_order")) {
      return [];
    }
    return null;
  },

  // ========== t_purchase_in_stock 表 ==========
  // 列表计数
  (s, params) => {
    if (fromTable(s, "purchase_in_stock") && s.includes("count(*)")) {
      return [{ total: state.purchaseInStocks.length }];
    }
    return null;
  },
  // 按入库号查询状态
  (s, params) => {
    if (fromTable(s, "purchase_in_stock") && s.includes("where stock_no = ?") && s.includes("stock_status")) {
      const stock = state.purchaseInStocks.find((st: Row) => st.stock_no === params[0] && st.tenant_id === params[1]);
      if (!stock) return [];
      return [{
        ...stock,
        stockNo: stock.stock_no,
        orderNo: stock.order_no,
        supplierId: stock.supplier_id,
        supplierName: stock.supplier_name,
        storeId: stock.store_id,
        stockStatus: stock.stock_status,
        goodsAmount: stock.goods_amount,
        taxAmount: stock.tax_amount,
        totalAmount: stock.total_amount,
        operatorId: stock.operator_id,
        tenantId: stock.tenant_id,
        status: stock.stock_status,
      }];
    }
    return null;
  },
  // 按入库号查询详情
  (s, params) => {
    if (fromTable(s, "purchase_in_stock") && s.includes("where stock_no = ?") && !s.includes("stock_status")) {
      const stock = state.purchaseInStocks.find((st: Row) => st.stock_no === params[0] && st.tenant_id === params[1]);
      if (!stock) return [];
      return [{
        ...stock,
        stockNo: stock.stock_no,
        orderNo: stock.order_no,
        supplierId: stock.supplier_id,
        supplierName: stock.supplier_name,
        storeId: stock.store_id,
        stockStatus: stock.stock_status,
        goodsAmount: stock.goods_amount,
        taxAmount: stock.tax_amount,
        totalAmount: stock.total_amount,
        operatorId: stock.operator_id,
        tenantId: stock.tenant_id,
        status: stock.stock_status,
      }];
    }
    return null;
  },
  // 列表（带别名）
  (s, params) => {
    if (fromTable(s, "purchase_in_stock") && s.includes("as stockno") && !s.includes("count(*)")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const sorted = [...state.purchaseInStocks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((st: Row) => ({
        ...st,
        stockNo: st.stock_no,
        orderNo: st.order_no,
        supplierId: st.supplier_id,
        supplierName: st.supplier_name,
        storeId: st.store_id,
        stockStatus: st.stock_status,
        goodsAmount: st.goods_amount,
        taxAmount: st.tax_amount,
        totalAmount: st.total_amount,
        operatorId: st.operator_id,
        tenantId: st.tenant_id,
        status: st.stock_status,
      }));
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "purchase_in_stock") && !s.includes("count(*)") && !s.includes("where stock_no")) {
      return state.purchaseInStocks;
    }
    return null;
  },

  // ========== t_purchase_in_stock_item 表 ==========
  (s, params) => {
    if (fromTable(s, "purchase_in_stock_item") && s.includes("where stock_no")) {
      return state.purchaseInStockItems.filter((i: Row) => i.stock_no === params[0]);
    }
    return null;
  },

  // ========== t_purchase_return 表 ==========
  // 列表计数
  (s, params) => {
    if (fromTable(s, "purchase_return") && s.includes("count(*)")) {
      return [{ total: state.purchaseReturns.length }];
    }
    return null;
  },
  // 供应商退货统计
  (s, params) => {
    if (s.includes("count(*) as returncount") && fromTable(s, "purchase_return") && s.includes("supplier_id")) {
      const returns = state.purchaseReturns.filter((r: Row) => r.supplier_id === Number(params[0]));
      const returnAmount = returns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
      return [{ returnCount: returns.length, returnAmount }];
    }
    return null;
  },
  // 按退货号查询状态
  (s, params) => {
    if (fromTable(s, "purchase_return") && s.includes("where return_no = ?") && s.includes("return_status")) {
      const ret = state.purchaseReturns.find((r: Row) => r.return_no === params[0] && r.tenant_id === params[1]);
      if (!ret) return [];
      return [{
        ...ret,
        returnNo: ret.return_no,
        orderNo: ret.order_no,
        stockNo: ret.stock_no,
        supplierId: ret.supplier_id,
        supplierName: ret.supplier_name,
        storeId: ret.store_id,
        returnStatus: ret.return_status,
        goodsAmount: ret.goods_amount,
        taxAmount: ret.tax_amount,
        totalAmount: ret.total_amount,
        refundAmount: ret.refund_amount,
        refundedAmount: ret.refunded_amount,
        operatorId: ret.operator_id,
        tenantId: ret.tenant_id,
        status: ret.return_status,
      }];
    }
    return null;
  },
  // 按退货号查询详情
  (s, params) => {
    if (fromTable(s, "purchase_return") && s.includes("where return_no = ?") && !s.includes("return_status")) {
      const ret = state.purchaseReturns.find((r: Row) => r.return_no === params[0] && r.tenant_id === params[1]);
      if (!ret) return [];
      return [{
        ...ret,
        returnNo: ret.return_no,
        orderNo: ret.order_no,
        stockNo: ret.stock_no,
        supplierId: ret.supplier_id,
        supplierName: ret.supplier_name,
        storeId: ret.store_id,
        returnStatus: ret.return_status,
        goodsAmount: ret.goods_amount,
        taxAmount: ret.tax_amount,
        totalAmount: ret.total_amount,
        refundAmount: ret.refund_amount,
        refundedAmount: ret.refunded_amount,
        operatorId: ret.operator_id,
        tenantId: ret.tenant_id,
        status: ret.return_status,
      }];
    }
    return null;
  },
  // 列表（带别名）
  (s, params) => {
    if (fromTable(s, "purchase_return") && s.includes("as returnno") && !s.includes("count(*)")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const sorted = [...state.purchaseReturns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((r: Row) => ({
        ...r,
        returnNo: r.return_no,
        orderNo: r.order_no,
        stockNo: r.stock_no,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        storeId: r.store_id,
        returnStatus: r.return_status,
        goodsAmount: r.goods_amount,
        taxAmount: r.tax_amount,
        totalAmount: r.total_amount,
        refundAmount: r.refund_amount,
        refundedAmount: r.refunded_amount,
        operatorId: r.operator_id,
        tenantId: r.tenant_id,
        status: r.return_status,
      }));
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "purchase_return") && !s.includes("count(*)") && !s.includes("where return_no")) {
      return state.purchaseReturns;
    }
    return null;
  },

  // ========== t_purchase_return_item 表 ==========
  (s, params) => {
    if (fromTable(s, "purchase_return_item") && s.includes("where return_no")) {
      return state.purchaseReturnItems.filter((i: Row) => i.return_no === params[0]);
    }
    return null;
  },

  // ========== t_purchase_payment 表 ==========
  (s, params) => {
    if (fromTable(s, "purchase_payment") && s.includes("count(*)")) {
      return [{ total: state.purchasePayments.length }];
    }
    return null;
  },
  (s, params) => {
    if (fromTable(s, "purchase_payment") && !s.includes("count(*)")) {
      const filtered = s.includes("where supplier_id") ? state.purchasePayments.filter((p: Row) => p.supplier_id === Number(params[0])) : state.purchasePayments;
      return filtered;
    }
    return null;
  },

  // ========== t_sale_return 表 ==========
  // 列表计数
  (s, params) => {
    if (fromTable(s, "sale_return") && s.includes("count(*)")) {
      return [{ total: state.saleReturns.length }];
    }
    return null;
  },
  // 按退货号查询
  (s, params) => {
    if (fromTable(s, "sale_return") && s.includes("where return_no = ?") && s.includes("tenant_id")) {
      const ret = state.saleReturns.find((r: Row) => r.return_no === params[0] && r.tenant_id === params[1]);
      if (!ret) return [];
      return [{
        ...ret,
        returnNo: ret.return_no,
        sourceBillNo: ret.source_bill_no,
        storeId: ret.store_id,
        customerId: ret.customer_id,
        customerName: ret.customer_name,
        customerMobile: ret.customer_mobile,
        returnStatus: ret.return_status,
        goodsAmount: ret.goods_amount,
        discountAmount: ret.discount_amount,
        refundAmount: ret.refund_amount,
        refundedAmount: ret.refunded_amount,
        refundMethod: ret.refund_method,
        operatorId: ret.operator_id,
        tenantId: ret.tenant_id,
        status: ret.return_status,
      }];
    }
    return null;
  },
  // 列表（带 JOIN t_store）
  (s, params) => {
    if (fromTable(s, "sale_return") && s.includes("left join t_store") && !s.includes("count(*)")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const sorted = [...state.saleReturns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((r: Row) => {
        const store = state.stores.find((st: Row) => st.id === r.store_id);
        return {
          ...r,
          returnNo: r.return_no,
          storeId: r.store_id,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerMobile: r.customer_mobile,
          returnStatus: r.return_status,
          goodsAmount: r.goods_amount,
          refundAmount: r.refund_amount,
          status: r.return_status,
          store_name: store?.name || null,
          storeName: store?.name || null,
        };
      });
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "sale_return") && !s.includes("count(*)") && !s.includes("where return_no")) {
      return state.saleReturns;
    }
    return null;
  },
  // SUM refund_amount 查询（对账单使用）
  (s, params) => {
    if (s.includes("coalesce(sum(refund_amount), 0)") && fromTable(s, "sale_return") && s.includes("customer_id")) {
      return [{ total_returns: 0 }];
    }
    return null;
  },

  // ========== t_sale_return_item 表 ==========
  (s, params) => {
    if (fromTable(s, "sale_return_item") && s.includes("where return_no")) {
      return state.saleReturnItems.filter((i: Row) => i.return_no === params[0]);
    }
    return null;
  },

  // ========== t_customer_payment 表 ==========
  // 列表计数
  (s, params) => {
    if (fromTable(s, "customer_payment") && s.includes("count(*)")) {
      return [{ total: state.customerPayments.length }];
    }
    return null;
  },
  // 按收款号查询（作废检查）
  (s, params) => {
    if (fromTable(s, "customer_payment") && s.includes("where receipt_no = ?") && s.includes("status") && s.includes("source_type")) {
      const payment = state.customerPayments.find((p: Row) => p.receipt_no === params[0] && p.tenant_id === params[1]);
      if (!payment) return [];
      return [{
        ...payment,
        receiptNo: payment.receipt_no,
        customerId: payment.customer_id,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method,
        sourceType: payment.source_type,
        sourceNo: payment.source_no,
        voucherNo: payment.voucher_no,
        paymentDate: payment.payment_date,
        operatorId: payment.operator_id,
        tenantId: payment.tenant_id,
      }];
    }
    return null;
  },
  // 按收款号查询详情
  (s, params) => {
    if (fromTable(s, "customer_payment") && s.includes("where receipt_no = ?") && !s.includes("status") && !s.includes("source_type")) {
      const payment = state.customerPayments.find((p: Row) => p.receipt_no === params[0] && p.tenant_id === params[1]);
      if (!payment) return [];
      return [{
        ...payment,
        receiptNo: payment.receipt_no,
        customerId: payment.customer_id,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method,
        sourceType: payment.source_type,
        sourceNo: payment.source_no,
        voucherNo: payment.voucher_no,
        paymentDate: payment.payment_date,
        operatorId: payment.operator_id,
        tenantId: payment.tenant_id,
      }];
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "customer_payment") && !s.includes("count(*)") && !s.includes("where receipt_no")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const sorted = [...state.customerPayments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((p: Row) => ({
        ...p,
        receiptNo: p.receipt_no,
        customerId: p.customer_id,
        customerName: p.customer_name,
        paymentMethod: p.payment_method,
        sourceType: p.source_type,
        sourceNo: p.source_no,
        voucherNo: p.voucher_no,
        paymentDate: p.payment_date,
        operatorId: p.operator_id,
        tenantId: p.tenant_id,
      }));
    }
    return null;
  },
  // SUM amount 查询（对账单使用）
  (s, params) => {
    if (s.includes("coalesce(sum(amount), 0)") && fromTable(s, "customer_payment") && s.includes("customer_id")) {
      return [{ total_payments: 0 }];
    }
    return null;
  },

  // ========== t_customer_statement 表 ==========
  // 列表计数
  (s, params) => {
    if (fromTable(s, "customer_statement") && s.includes("count(*)")) {
      return [{ total: state.customerStatements.length }];
    }
    return null;
  },
  // 按对账单号查询（确认/结清检查）
  (s, params) => {
    if (fromTable(s, "customer_statement") && s.includes("where statement_no = ?") && s.includes("status") && !s.includes("*")) {
      const stmt = state.customerStatements.find((st: Row) => st.statement_no === params[0] && st.tenant_id === params[1]);
      if (!stmt) return [];
      return [{
        ...stmt,
        statementNo: stmt.statement_no,
        customerId: stmt.customer_id,
        customerName: stmt.customer_name,
        customerMobile: stmt.customer_mobile,
        statementType: stmt.statement_type,
        startDate: stmt.start_date,
        endDate: stmt.end_date,
        openingBalance: stmt.opening_balance,
        totalSales: stmt.total_sales,
        totalReturns: stmt.total_returns,
        totalPayments: stmt.total_payments,
        closingBalance: stmt.closing_balance,
        operatorId: stmt.operator_id,
        tenantId: stmt.tenant_id,
      }];
    }
    return null;
  },
  // 按对账单号查询详情
  (s, params) => {
    if (fromTable(s, "customer_statement") && s.includes("where statement_no = ?") && s.includes("*")) {
      const stmt = state.customerStatements.find((st: Row) => st.statement_no === params[0] && st.tenant_id === params[1]);
      if (!stmt) return [];
      return [{
        ...stmt,
        statementNo: stmt.statement_no,
        customerId: stmt.customer_id,
        customerName: stmt.customer_name,
        customerMobile: stmt.customer_mobile,
        statementType: stmt.statement_type,
        startDate: stmt.start_date,
        endDate: stmt.end_date,
        openingBalance: stmt.opening_balance,
        totalSales: stmt.total_sales,
        totalReturns: stmt.total_returns,
        totalPayments: stmt.total_payments,
        closingBalance: stmt.closing_balance,
        operatorId: stmt.operator_id,
        tenantId: stmt.tenant_id,
      }];
    }
    return null;
  },
  // 通用列表
  (s, params) => {
    if (fromTable(s, "customer_statement") && !s.includes("count(*)") && !s.includes("where statement_no")) {
      const offset = Number(params[params.length - 1]) || 0;
      const pageSize = Number(params[params.length - 2]) || 20;
      const sorted = [...state.customerStatements].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted.slice(offset, offset + pageSize).map((st: Row) => ({
        ...st,
        statementNo: st.statement_no,
        customerId: st.customer_id,
        customerName: st.customer_name,
        customerMobile: st.customer_mobile,
        statementType: st.statement_type,
        startDate: st.start_date,
        endDate: st.end_date,
        openingBalance: st.opening_balance,
        totalSales: st.total_sales,
        totalReturns: st.total_returns,
        totalPayments: st.total_payments,
        closingBalance: st.closing_balance,
        operatorId: st.operator_id,
        tenantId: st.tenant_id,
      }));
    }
    return null;
  },

  // ========== t_sale_bill 表查询（customer-payment 和 customer-statement 服务使用） ==========
  // 按 bill_no 查询 receivable_amount, received_amount
  (s, params) => {
    if (fromTable(s, "sale_bill") && s.includes("where bill_no = ?") && s.includes("receivable_amount")) {
      const bill = state.saleBills.find((b: Row) => b.bill_no === params[0]);
      return bill ? [bill] : [];
    }
    return null;
  },
  // 对账单销售明细查询
  (s, params) => {
    if (fromTable(s, "sale_bill") && s.includes("customer_id") && s.includes("business_status = 'created'") && !s.includes("sum")) {
      return [];
    }
    return null;
  },
  // SUM 查询（期初余额、销售总额）
  (s, params) => {
    if (s.includes("coalesce(sum(unreceived_amount), 0)") && fromTable(s, "sale_bill")) {
      return [{ opening_balance: 0 }];
    }
    return null;
  },
  (s, params) => {
    if (s.includes("coalesce(sum(receivable_amount), 0)") && fromTable(s, "sale_bill")) {
      return [{ total_sales: 0 }];
    }
    return null;
  },

  // ========== 供应商绩效统计 ==========
  (s, params) => {
    if (s.includes("sum(case when actual_date is not null and actual_date <= expected_date")) {
      return [{ totalOrders: 0, onTimeOrders: 0, lateOrders: 0 }];
    }
    if (s.includes("coalesce(sum(payable_amount), 0) as totalamount") && fromTable(s, "purchase_order") && s.includes("supplier_id")) {
      return [{ totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }];
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // ========== supplier INSERT ==========
  // SQL: INSERT INTO t_supplier (supplier_code, name, short_name, category, province, city, district, address,
  //   credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account,
  //   bank_account_name, remark, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..16], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "supplier") && s.includes("supplier_code")) {
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
        tenant_id: params[16],
        status: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== supplier UPDATE ==========
  // SQL: UPDATE t_supplier SET ... WHERE id = ? AND tenant_id = ?
  // 参数顺序: [updateValues..., id, tenant_id]
  (s, params) => {
    if (updateTable(s, "supplier") && s.includes("where id")) {
      const supplierId = Number(params[params.length - 2]);
      const tenantId = params[params.length - 1];
      const supplier = state.suppliers.find((sup: Row) => sup.id === supplierId && sup.tenant_id === tenantId);
      if (supplier) {
        // 动态更新字段：根据 SET 子句中的字段名更新
        const setMatch = s.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          const setClauses = setMatch[1].split(",");
          let paramIdx = 0;
          for (const clause of setClauses) {
            const fieldMatch = clause.trim().match(/^(\w+)\s*=/);
            if (fieldMatch && !fieldMatch[1].startsWith("updated_at")) {
              const field = fieldMatch[1];
              supplier[field] = params[paramIdx];
              paramIdx++;
            } else if (fieldMatch && fieldMatch[1] === "updated_at") {
              // updated_at = NOW()，无参数
            } else if (clause.includes("?")) {
              paramIdx++;
            }
          }
        }
        supplier.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_supplier_contact INSERT ==========
  // 完整 INSERT: 9 个字段 (supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark)
  (s, params) => {
    if (insertIntoTable(s, "supplier_contact") && s.includes("email")) {
      const id = state.supplierContacts.length + 1;
      state.supplierContacts.push({
        id,
        supplier_id: params[0],
        name: params[1],
        mobile: params[2],
        phone: params[3],
        email: params[4],
        wechat: params[5],
        is_primary: params[6],
        position: params[7],
        remark: params[8],
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },
  // 简化 INSERT: 4 个字段 (supplier_id, name, mobile, phone) + 字面量 is_primary=1, position='联系人'
  (s, params) => {
    if (insertIntoTable(s, "supplier_contact") && !s.includes("email")) {
      const id = state.supplierContacts.length + 1;
      state.supplierContacts.push({
        id,
        supplier_id: params[0],
        name: params[1],
        mobile: params[2],
        phone: params[3],
        email: null,
        wechat: null,
        is_primary: 1,
        position: "联系人",
        remark: null,
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_supplier_contact UPDATE ==========
  (s, params) => {
    if (updateTable(s, "supplier_contact") && s.includes("is_primary = 0")) {
      // 取消其他主联系人
      const supplierId = Number(params[0]);
      state.supplierContacts.forEach((c: Row) => {
        if (c.supplier_id === supplierId) c.is_primary = 0;
      });
      return result();
    }
    return null;
  },

  // ========== t_supplier_contact DELETE ==========
  (s, params) => {
    if (deleteFromTable(s, "supplier_contact") && s.includes("where id")) {
      const contactId = Number(params[0]);
      state.supplierContacts = state.supplierContacts.filter((c: Row) => c.id !== contactId);
      return result();
    }
    return null;
  },

  // ========== supplier DELETE ==========
  (s, params) => {
    if (deleteFromTable(s, "supplier") && s.includes("where id")) {
      state.suppliers = state.suppliers.filter((sup: Row) => sup.id !== Number(params[0]));
      return result();
    }
    return null;
  },

  // ========== t_purchase_order INSERT ==========
  // SQL: INSERT INTO t_purchase_order (order_no, supplier_id, supplier_name, store_id, order_status,
  //   goods_amount, tax_amount, discount_amount, payable_amount,
  //   paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id)
  //   VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  // 字面量: order_status='DRAFT', paid_amount=0
  // params: [order_no, supplier_id, supplier_name, store_id, goods_amount, tax_amount, discount_amount,
  //          payable_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id]
  //         索引:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  (s, params) => {
    if (insertIntoTable(s, "purchase_order") && s.includes("order_status")) {
      const id = state.purchaseOrders.length + 1;
      state.purchaseOrders.push({
        id,
        order_no: params[0],
        supplier_id: params[1],
        supplier_name: params[2],
        store_id: params[3],
        order_status: "DRAFT",
        goods_amount: params[4],
        tax_amount: params[5],
        discount_amount: params[6],
        payable_amount: params[7],
        paid_amount: 0,
        unpaid_amount: params[8],
        expected_date: params[9],
        operator_id: params[10],
        remark: params[11],
        tenant_id: params[12],
        warehouse_status: "NONE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_purchase_order_item INSERT ==========
  // SQL: INSERT INTO t_purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
  //   unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..12], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "purchase_order_item")) {
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

  // ========== t_purchase_order_item DELETE ==========
  (s, params) => {
    if (deleteFromTable(s, "purchase_order_item") && s.includes("where order_no")) {
      state.purchaseOrderItems = state.purchaseOrderItems.filter((i: Row) => i.order_no !== params[0]);
      return result();
    }
    return null;
  },

  // ========== t_purchase_order DELETE ==========
  (s, params) => {
    if (deleteFromTable(s, "purchase_order") && s.includes("where order_no")) {
      state.purchaseOrders = state.purchaseOrders.filter((o: Row) => !(o.order_no === params[0] && o.tenant_id === params[1]));
      return result();
    }
    return null;
  },

  // ========== t_purchase_order UPDATE ==========
  // 状态更新：UPDATE t_purchase_order SET order_status = ?, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?
  // 或带额外字段：UPDATE t_purchase_order SET order_status = ?, auditor_id = ?, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?
  // 或动态字段更新
  (s, params) => {
    if (updateTable(s, "purchase_order") && s.includes("where order_no")) {
      const orderNo = params[params.length - 2] || params[params.length - 1];
      const order = state.purchaseOrders.find((o: Row) => o.order_no === orderNo);
      if (order) {
        if (s.includes("order_status = 'cancelled'")) order.order_status = "CANCELLED";
        else if (s.includes("order_status = 'approved'")) order.order_status = "APPROVED";
        else if (s.includes("order_status = 'pending'")) order.order_status = "PENDING";
        else if (s.includes("order_status = 'completed'")) order.order_status = "COMPLETED";
        else if (s.includes("order_status = 'partial'")) order.order_status = "PARTIAL";
        else if (s.includes("order_status = ?")) {
          // 动态状态更新：params[0] 是新状态
          order.order_status = params[0];
        }
        // 处理额外字段更新
        if (s.includes("auditor_id = ?")) {
          order.auditor_id = params[1];
        }
        if (s.includes("warehouse_status = ?")) {
          order.warehouse_status = params[0];
        }
        if (s.includes("actual_date = curdate()")) {
          order.actual_date = new Date().toISOString().split("T")[0];
        }
        // 动态字段更新（updateOrder 方法）
        const setMatch = s.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          const setClauses = setMatch[1].split(",");
          let paramIdx = 0;
          for (const clause of setClauses) {
            const fieldMatch = clause.trim().match(/^(\w+)\s*=/);
            if (fieldMatch) {
              const field = fieldMatch[1];
              if (field === "updated_at" || field === "actual_date") continue;
              if (clause.includes("?")) {
                order[field] = params[paramIdx];
                paramIdx++;
              }
            }
          }
        }
        order.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_purchase_order_item UPDATE (in_stocked_qty) ==========
  (s, params) => {
    if (updateTable(s, "purchase_order_item") && s.includes("in_stocked_qty")) {
      const item = state.purchaseOrderItems.find((i: Row) => i.order_no === params[1] && i.sku_id === Number(params[2]));
      if (item) {
        if (s.includes("in_stocked_qty = in_stocked_qty + ?")) {
          item.in_stocked_qty = Number(item.in_stocked_qty || 0) + Number(params[0]);
        } else {
          item.in_stocked_qty = Number(params[0]);
        }
      }
      return result();
    }
    return null;
  },

  // ========== t_purchase_in_stock INSERT ==========
  // SQL: INSERT INTO t_purchase_in_stock (stock_no, order_no, supplier_id, supplier_name, store_id, stock_status,
  //   goods_amount, tax_amount, total_amount, operator_id, remark, tenant_id)
  //   VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)
  // 字面量: stock_status='PENDING'
  // params: [stock_no, order_no, supplier_id, supplier_name, store_id, goods_amount, tax_amount, total_amount,
  //          operator_id, remark, tenant_id]
  //         索引: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  (s, params) => {
    if (insertIntoTable(s, "purchase_in_stock")) {
      const id = state.purchaseInStocks.length + 1;
      state.purchaseInStocks.push({
        id,
        stock_no: params[0],
        order_no: params[1],
        supplier_id: params[2],
        supplier_name: params[3],
        store_id: params[4],
        stock_status: "PENDING",
        goods_amount: params[5],
        tax_amount: params[6],
        total_amount: params[7],
        operator_id: params[8],
        remark: params[9],
        tenant_id: params[10],
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_purchase_in_stock_item INSERT ==========
  // SQL: INSERT INTO t_purchase_in_stock_item (stock_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
  //   unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, batch_no, production_date, expiry_date, remark)
  //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..14], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "purchase_in_stock_item")) {
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

  // ========== t_purchase_in_stock UPDATE ==========
  (s, params) => {
    if (updateTable(s, "purchase_in_stock") && s.includes("where stock_no")) {
      const stock = state.purchaseInStocks.find((st: Row) => st.stock_no === params[1] && st.tenant_id === params[2]);
      if (stock) {
        if (s.includes("stock_status = 'completed'")) stock.stock_status = "COMPLETED";
        else if (s.includes("stock_status = 'voided'")) stock.stock_status = "VOIDED";
        if (s.includes("auditor_id = ?")) stock.auditor_id = params[0];
        stock.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_purchase_return INSERT ==========
  // SQL: INSERT INTO t_purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id, return_status,
  //   goods_amount, tax_amount, total_amount, refund_amount, refunded_amount, operator_id, remark, tenant_id)
  //   VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)
  // 字面量: return_status='PENDING', refunded_amount=0
  // params: [return_no, order_no, stock_no, supplier_id, supplier_name, store_id, goods_amount, tax_amount,
  //          total_amount, refund_amount, operator_id, remark, tenant_id]
  //         索引: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  (s, params) => {
    if (insertIntoTable(s, "purchase_return") && s.includes("return_status")) {
      const id = state.purchaseReturns.length + 1;
      state.purchaseReturns.push({
        id,
        return_no: params[0],
        order_no: params[1],
        stock_no: params[2],
        supplier_id: params[3],
        supplier_name: params[4],
        store_id: params[5],
        return_status: "PENDING",
        goods_amount: params[6],
        tax_amount: params[7],
        total_amount: params[8],
        refund_amount: params[9],
        refunded_amount: 0,
        operator_id: params[10],
        remark: params[11],
        tenant_id: params[12],
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_purchase_return_item INSERT ==========
  // SQL: INSERT INTO t_purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
  //   unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..11], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "purchase_return_item")) {
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

  // ========== t_purchase_return UPDATE ==========
  (s, params) => {
    if (updateTable(s, "purchase_return") && s.includes("where return_no")) {
      const ret = state.purchaseReturns.find((r: Row) => r.return_no === params[1] && r.tenant_id === params[2]);
      if (ret) {
        if (s.includes("return_status = 'completed'")) ret.return_status = "COMPLETED";
        else if (s.includes("return_status = 'voided'")) ret.return_status = "VOIDED";
        if (s.includes("auditor_id = ?")) ret.auditor_id = params[0];
        ret.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_sale_return INSERT ==========
  // SQL: INSERT INTO t_sale_return (return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
  //   return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
  //   operator_id, remark, tenant_id) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?)
  // 字面量: return_status='PENDING', refunded_amount=0
  // params: [return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile, goods_amount,
  //          discount_amount, refund_amount, operator_id, remark, tenant_id]
  //         索引: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  (s, params) => {
    if (insertIntoTable(s, "sale_return") && s.includes("return_status")) {
      const id = state.saleReturns.length + 1;
      state.saleReturns.push({
        id,
        return_no: params[0],
        source_bill_no: params[1],
        store_id: params[2],
        customer_id: params[3],
        customer_name: params[4],
        customer_mobile: params[5],
        return_status: "PENDING",
        goods_amount: params[6],
        discount_amount: params[7],
        refund_amount: params[8],
        refunded_amount: 0,
        refund_method: null,
        operator_id: params[9],
        remark: params[10],
        tenant_id: params[11],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_sale_return_item INSERT ==========
  // SQL: INSERT INTO t_sale_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
  //   unit_price, subtotal_amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..8], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "sale_return_item")) {
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
        created_at: new Date().toISOString(),
      });
      return result();
    }
    return null;
  },

  // ========== t_sale_return UPDATE ==========
  // 审核更新：UPDATE t_sale_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?
  // 退款更新：UPDATE t_sale_return SET refunded_amount = refund_amount, refund_method = ? WHERE return_no = ?
  (s, params) => {
    if (updateTable(s, "sale_return") && s.includes("where return_no")) {
      const returnNo = params[params.length - 1];
      const ret = state.saleReturns.find((r: Row) => r.return_no === returnNo);
      if (ret) {
        if (s.includes("return_status = 'completed'")) {
          ret.return_status = "COMPLETED";
          if (s.includes("auditor_id = ?")) ret.auditor_id = params[0];
        }
        if (s.includes("refunded_amount = refund_amount")) {
          ret.refunded_amount = ret.refund_amount;
        }
        if (s.includes("refund_method = ?")) {
          ret.refund_method = params[0];
        }
        ret.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_customer_payment INSERT ==========
  // SQL: INSERT INTO t_customer_payment (receipt_no, customer_id, customer_name, amount, payment_method,
  //   source_type, source_no, voucher_no, payment_date, operator_id, status, remark, tenant_id)
  //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
  // 字面量: status='COMPLETED'
  // params: [receipt_no, customer_id, customer_name, amount, payment_method, source_type, source_no, voucher_no,
  //          payment_date, operator_id, remark, tenant_id]
  //         索引: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  (s, params) => {
    if (insertIntoTable(s, "customer_payment")) {
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
        status: "COMPLETED",
        remark: params[10],
        tenant_id: params[11],
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_customer_payment UPDATE ==========
  // 作废：UPDATE t_customer_payment SET status = 'VOIDED' WHERE receipt_no = ? AND tenant_id = ?
  (s, params) => {
    if (updateTable(s, "customer_payment") && s.includes("where receipt_no")) {
      const payment = state.customerPayments.find((p: Row) => p.receipt_no === params[0] && p.tenant_id === params[1]);
      if (payment) {
        if (s.includes("status = 'voided'")) payment.status = "VOIDED";
        payment.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_customer_statement INSERT ==========
  // SQL: INSERT INTO t_customer_statement (statement_no, customer_id, customer_name, customer_mobile, statement_type,
  //   start_date, end_date, opening_balance, total_sales, total_returns, total_payments,
  //   closing_balance, status, operator_id, remark, tenant_id)
  //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)
  // 字面量: status='DRAFT'
  // params: [statement_no, customer_id, customer_name, customer_mobile, statement_type, start_date, end_date,
  //          opening_balance, total_sales, total_returns, total_payments, closing_balance, operator_id, remark, tenant_id]
  //         索引: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  (s, params) => {
    if (insertIntoTable(s, "customer_statement")) {
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
        status: "DRAFT",
        operator_id: params[12],
        remark: params[13],
        tenant_id: params[14],
        created_at: new Date().toISOString(),
      });
      return result(id);
    }
    return null;
  },

  // ========== t_customer_statement UPDATE ==========
  // 确认：UPDATE t_customer_statement SET status = 'CONFIRMED', confirmed_at = NOW() WHERE statement_no = ? AND tenant_id = ?
  // 结清：UPDATE t_customer_statement SET status = 'PAID' WHERE statement_no = ? AND tenant_id = ?
  (s, params) => {
    if (updateTable(s, "customer_statement") && s.includes("where statement_no")) {
      const stmt = state.customerStatements.find((st: Row) => st.statement_no === params[0] && st.tenant_id === params[1]);
      if (stmt) {
        if (s.includes("status = 'confirmed'")) {
          stmt.status = "CONFIRMED";
          stmt.confirmed_at = new Date().toISOString();
        } else if (s.includes("status = 'paid'")) {
          stmt.status = "PAID";
        }
        stmt.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // ========== t_operation_log INSERT ==========
  // SQL: INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
  //   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  // params[0..7], 无字面量
  (s, params) => {
    if (insertIntoTable(s, "operation_log")) {
      state.operationLogs.push({
        id: state.operationLogs.length + 1,
        module: params[0],
        action: params[1],
        target_id: params[2],
        target_type: params[3],
        user_id: params[4],
        user_name: params[5],
        detail: params[6],
        tenant_id: params[7],
        created_at: new Date().toISOString(),
      });
      return result();
    }
    return null;
  },

  // ========== t_sale_bill UPDATE（customer-payment 服务使用） ==========
  // 更新收款金额：UPDATE t_sale_bill SET received_amount = ?, unreceived_amount = ?, collection_status = ? WHERE bill_no = ?
  (s, params) => {
    if (updateTable(s, "sale_bill") && s.includes("received_amount = ?")) {
      const bill = state.saleBills.find((b: Row) => b.bill_no === params[3] || b.bill_no === params[params.length - 1]);
      if (bill) {
        const received = Number(params[0]);
        const unreceived = Number(params[1]);
        bill.received_amount = received;
        bill.receivedAmount = received;
        bill.unreceived_amount = unreceived;
        bill.unreceivedAmount = unreceived;
        bill.collection_status = params[2];
        bill.collectionStatus = params[2];
      }
      return result();
    }
    return null;
  },
];
