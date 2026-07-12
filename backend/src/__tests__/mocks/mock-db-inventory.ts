/**
 * 库存 mock handlers: inventory, inventory_balance, inventory_log, inventory_ledger
 * 修复坑：业务表使用 t_ 前缀（如 t_inventory_balance），需同时匹配带前缀和不带前缀的形式
 */
import { state, result, Row, updateTable, fromTable, insertIntoTable } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // inventory_balance UPDATE
  (s, params) => {
    if (updateTable(s, "inventory_balance")) {
      const stockType = params.length >= 5 ? params[4] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : (s.includes("stock_type = 'online'") ? "ONLINE" : params[4]));
      const inv = state.inventory.find(
        (i) => i.storeId === params[2] && i.skuId === params[3] && i.stockType === stockType
      );
      if (inv) {
        if (s.includes("locked_qty = locked_qty +")) {
          inv.lockedQty = Number(inv.lockedQty) + Number(params[0]);
          inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
        } else if (s.includes("physical_qty = physical_qty -") && s.includes("locked_qty = greatest(locked_qty -")) {
          inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
          inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[2]));
        } else if (s.includes("physical_qty = physical_qty -")) {
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
      return [];
    }
    return null;
  },

  // inventory_balance left join store
  (s, params) => {
    if (fromTable(s, "inventory_balance") && s.includes("left join store")) {
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
      });
    }
    return null;
  },

  // inventory_balance specific query
  (s, params) => {
    if (fromTable(s, "inventory_balance") && s.includes("physical_qty") && s.includes("where store_id")) {
      const stockType = params.length >= 3 ? params[2] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : params[2]);
      const inv = state.inventory.find(
        (i) => i.storeId === params[0] && i.skuId === params[1] && i.stockType === stockType
      );
      return inv ? [{ physicalQty: inv.physicalQty, physical_qty: inv.physicalQty, lockedQty: inv.lockedQty, locked_qty: inv.lockedQty, availableQty: inv.availableQty, available_qty: inv.availableQty }] : [];
    }
    return null;
  },

  // inventory_balance general
  (s, params) => {
    if (fromTable(s, "inventory_balance")) return state.inventory;
    return null;
  },

  // inventory_ledger / inventory_log
  (s, params) => {
    if (s.includes("select id from inventory_ledger") && s.includes("biz_type = 'sale_out'")) {
      return state.inventoryLogs
        .filter((log) => log.bizType === "SALE_OUT" && log.bizNo === params[0])
        .map((log) => ({ id: log.id ?? log.logNo }));
    }
    if ((fromTable(s, "inventory_log") || fromTable(s, "inventory_ledger")) && s.includes("count(*)")) {
      return [{ total: state.inventoryLogs.length }];
    }
    if (fromTable(s, "inventory_log") || fromTable(s, "inventory_ledger")) return state.inventoryLogs;
    return null;
  },

  // inventory_log INSERT
  (s, params) => {
    if (insertIntoTable(s, "inventory_log")) {
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
      return [];
    }
    return null;
  },

  // inventory_ledger INSERT
  (s, params) => {
    if (insertIntoTable(s, "inventory_ledger")) {
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
      return [];
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // inventory_balance UPDATE
  (s, params) => {
    if (updateTable(s, "inventory_balance")) {
      const stockType = params.length >= 5 ? params[4] : (s.includes("stock_type = 'offline'") ? "OFFLINE" : (s.includes("stock_type = 'online'") ? "ONLINE" : params[4]));
      const inv = state.inventory.find(
        (i) => i.storeId === params[2] && i.skuId === params[3] && i.stockType === stockType
      );
      if (inv) {
        if (s.includes("locked_qty = locked_qty +")) {
          inv.lockedQty = Number(inv.lockedQty) + Number(params[0]);
          inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
        } else if (s.includes("physical_qty = physical_qty -") && s.includes("locked_qty = greatest(locked_qty -")) {
          inv.physicalQty = Number(inv.physicalQty) - Number(params[0]);
          inv.lockedQty = Math.max(0, Number(inv.lockedQty) - Number(params[2]));
        } else if (s.includes("physical_qty = physical_qty -")) {
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
    return null;
  },

  // inventory_balance INSERT ON DUPLICATE KEY UPDATE
  (s, params) => {
    if (insertIntoTable(s, "inventory_balance") && s.includes("on duplicate key update")) {
      const storeId = Number(params[0]);
      const skuId = Number(params[1]);
      const stockType = String(params[2]);
      const qty = Number(params[3]);
      const inv = state.inventory.find(
        (i) => i.storeId === storeId && i.skuId === skuId && i.stockType === stockType
      );
      if (inv) {
        inv.physicalQty = Number(inv.physicalQty) + qty;
        inv.availableQty = Number(inv.availableQty) + qty;
      } else {
        state.inventory.push({
          storeId,
          skuId,
          skuName: "",
          stockType,
          physicalQty: qty,
          lockedQty: 0,
          availableQty: qty,
        });
      }
      return result();
    }
    return null;
  },

  // 采购退货扣减库存
  (s, params) => {
    if (updateTable(s, "inventory_balance") && s.includes("greatest(physical_qty -") && s.includes("greatest(available_qty -")) {
      const storeId = Number(params[2]);
      const skuId = Number(params[3]);
      const qty = Number(params[0]);
      const inv = state.inventory.find(
        (i) => i.storeId === storeId && i.skuId === skuId && i.stockType === "OFFLINE"
      );
      if (inv) {
        inv.physicalQty = Math.max(0, Number(inv.physicalQty) - qty);
        inv.availableQty = Math.max(0, Number(inv.availableQty) - qty);
      }
      return result();
    }
    return null;
  },
];