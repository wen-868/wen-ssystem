/**
 * 商品 mock handlers: products, product_sku, product_spu, product_price, product_price_log
 */
import { state, pendingProduct, result, Row } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // product_sku count
  (s, _params) => {
    if ((s.includes("from product_sku") || s.includes("from t_product_sku")) && s.includes("count(*)")) return [{ total: state.products.length }];
    return null;
  },

  // sale_bill_item join sale_bill by customer_id
  (s, params) => {
    if ((s.includes("from sale_bill_item") || s.includes("from t_sale_bill_item")) && (s.includes("join sale_bill") || s.includes("join t_sale_bill")) && s.includes("customer_id")) {
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
      return records;
    }
    return null;
  },

  // product_sku join product_price
  (s, params) => {
    if (s.includes("select s.sku_name") && (s.includes("from product_sku s") || s.includes("from t_product_sku s")) && (s.includes("join product_price") || s.includes("join t_product_price"))) {
      const product = state.products.find((p) => p.skuId === params[0]);
      return product
        ? [{
            sku_name: product.skuName,
            retail_price: product.retailPrice,
            wholesale_price: product.wholesalePrice,
            miniapp_price: product.miniappPrice,
            store_price: product.storePrice
          }]
        : [];
    }
    return null;
  },

  // product_sku join product_spu join product_price (product listing)
  (s, _params) => {
    if ((s.includes("from product_sku") || s.includes("from t_product_sku")) && (s.includes("join product_spu") || s.includes("join t_product_spu")) && (s.includes("join product_price") || s.includes("join t_product_price"))) {
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
      });
    }
    return null;
  },

  // product_price 查询
  (s, params) => {
    if (s.includes("from product_price") || s.includes("from t_product_price")) {
      const skuId = Number(params[0]);
      const product = state.products.find((p) => p.skuId === skuId);
      if (!product) return [];
      return [{
        sku_id: product.skuId,
        cost_price: Number(product.costPrice ?? 0),
        retail_price: Number(product.retailPrice ?? 0),
        wholesale_price: product.wholesalePrice == null ? null : Number(product.wholesalePrice),
        miniapp_price: product.miniappPrice == null ? null : Number(product.miniappPrice),
        store_price: product.storePrice == null ? null : Number(product.storePrice)
      }];
    }
    return null;
  },

  // product_price UPDATE (query handler)
  (s, params) => {
    if (s.startsWith("update product_price") || s.startsWith("update t_product_price")) {
      const skuId = Number(params[params.length - 1]);
      const product = state.products.find((p) => p.skuId === skuId);
      if (product) {
        if (params[0] != null) (product as Row).costPrice = Number(params[0]);
        if (params[1] != null) product.retailPrice = Number(params[1]);
        if (params[2] !== undefined) product.wholesalePrice = params[2] == null ? null : Number(params[2]);
        if (params[3] !== undefined) product.miniappPrice = params[3] == null ? null : Number(params[3]);
        if (params[4] !== undefined) (product as Row).storePrice = params[4] == null ? null : Number(params[4]);
      }
      return [];
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // product_spu UPDATE status
  (s, params) => {
    if (s.startsWith("update product_spu set status") || s.startsWith("update t_product_spu set status")) {
      const status = params[0];
      const spuId = Number(params[1]);
      for (const product of state.products) {
        if (Number(product.spuId) === spuId) product.status = status;
      }
      return result();
    }
    return null;
  },

  // product_price_log INSERT
  (s, params) => {
    if (s.includes("insert into product_price_log") || s.includes("insert into t_product_price_log")) {
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
    return null;
  },

  // product_spu INSERT
  (s, params) => {
    if (s.includes("insert into product_spu") || s.includes("insert into t_product_spu")) {
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
    return null;
  },

  // product_sku INSERT
  (s, params) => {
    if (s.includes("insert into product_sku") || s.includes("insert into t_product_sku")) {
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
    return null;
  },

  // product_price INSERT
  (s, params) => {
    if (s.includes("insert into product_price") || s.includes("insert into t_product_price")) {
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
    return null;
  },

  // product_price UPDATE (execute handler)
  (s, params) => {
    if (s.includes("update product_price") || s.includes("update t_product_price")) {
      const skuId = Number(params[params.length - 1]);
      const product = state.products.find((p) => p.skuId === skuId);
      if (product) {
        if (params[1] != null) product.retailPrice = Number(params[1]);
        if (params[2] != null) product.wholesalePrice = Number(params[2]);
        if (params[3] != null) product.miniappPrice = Number(params[3]);
      }
      return result();
    }
    return null;
  },
];