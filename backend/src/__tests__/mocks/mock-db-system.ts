/**
 * 系统表 mock handlers: users, roles, userRoles, error_logs, operation_logs, platform_config, platform_credentials, platform_orders
 */
import { state, result, Row } from "./mock-db-state";

// ==================== mockQuery handlers ====================

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // sys_user / t_sys_user（兼容两种表名格式）
  (s, params) => {
    if (s.includes("from sys_user where username") || s.includes("from t_sys_user where username")) {
      return state.users.filter((u) => u.username === params[0]);
    }
    if ((s.includes("from sys_user_role") || s.includes("from t_sys_user_role")) && (s.includes("join sys_role") || s.includes("join t_sys_role"))) {
      const userId = Number(params[0]);
      return state.userRoles.filter((role) => role.user_id === userId).map((role) => ({ role_code: role.role_code }));
    }
    if ((s.includes("from sys_user") || s.includes("from t_sys_user")) && !s.includes("where username")) {
      return state.users.map((u) => ({
        staffId: u.id,
        id: u.id,
        username: u.username,
        realName: u.real_name,
        storeId: u.store_id,
        status: u.status
      }));
    }
    return null;
  },

  // error_logs INSERT
  (s, params) => {
    if (s.includes("insert into error_logs") || s.includes("insert into t_error_logs")) {
      const id = state.errorLogs.length + 1;
      state.errorLogs.push({
        id,
        error_type: params[0],
        severity: params[1],
        message: params[2],
        stack: params[3] || null,
        request_url: params[4] || null,
        request_method: params[5] || null,
        status_code: params[6] || null,
        user_id: params[7] || null,
        tenant_id: params[8] || null,
        source: params[9] || "backend",
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },

  // error_logs
  (s, params) => {
    if ((s.includes("from error_logs") || s.includes("from t_error_logs")) && s.includes("count(*) as count")) {
      return [{ count: state.errorLogs.length }];
    }
    if ((s.includes("from error_logs") || s.includes("from t_error_logs")) && s.includes("date(created_at) as date") && s.includes("group by date(created_at)")) {
      const dateMap = new Map<string, number>();
      for (const e of state.errorLogs) {
        const date = (e.created_at || e.createdAt || "").split("T")[0];
        if (date) {
          dateMap.set(date, (dateMap.get(date) || 0) + 1);
        }
      }
      return Array.from(dateMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
    }
    if ((s.includes("from error_logs") || s.includes("from t_error_logs")) && s.includes("status_code") && s.includes("group by status_code")) {
      const codeMap = new Map<number, number>();
      for (const e of state.errorLogs) {
        const sc = e.status_code;
        if (sc != null) {
          codeMap.set(sc, (codeMap.get(sc) || 0) + 1);
        }
      }
      return Array.from(codeMap.entries()).map(([status_code, count]) => ({ status_code, count }));
    }
    if ((s.includes("from error_logs") || s.includes("from t_error_logs")) && s.includes("count(*) as total")) {
      let filtered = state.errorLogs;
      let paramIdx = 0;
      if (s.includes("error_type = ?")) {
        filtered = filtered.filter((e: Row) => e.error_type === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("severity = ?")) {
        filtered = filtered.filter((e: Row) => e.severity === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("source = ?")) {
        filtered = filtered.filter((e: Row) => e.source === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("message like")) {
        const kw = String(params[paramIdx]).replace(/%/g, "").toLowerCase();
        filtered = filtered.filter((e: Row) =>
          String(e.message || "").toLowerCase().includes(kw) ||
          String(e.request_url || "").toLowerCase().includes(kw)
        );
      }
      return [{ total: filtered.length }];
    }
    if ((s.includes("from error_logs") || s.includes("from t_error_logs")) && s.includes("order by created_at desc")) {
      let filtered = state.errorLogs;
      let paramIdx = 0;
      if (s.includes("error_type = ?")) {
        filtered = filtered.filter((e: Row) => e.error_type === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("severity = ?")) {
        filtered = filtered.filter((e: Row) => e.severity === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("source = ?")) {
        filtered = filtered.filter((e: Row) => e.source === params[paramIdx]);
        paramIdx++;
      }
      if (s.includes("message like")) {
        const kw = String(params[paramIdx]).replace(/%/g, "").toLowerCase();
        filtered = filtered.filter((e: Row) =>
          String(e.message || "").toLowerCase().includes(kw) ||
          String(e.request_url || "").toLowerCase().includes(kw)
        );
        paramIdx += 2;
      }
      const sorted = [...filtered].sort((a: Row, b: Row) =>
        new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
      );
      const pageSize = Number(params[paramIdx]) || 20;
      const offset = Number(params[paramIdx + 1]) || 0;
      return sorted.slice(offset, offset + pageSize);
    }
    if (s.includes("from error_logs") || s.includes("from t_error_logs")) {
      return state.errorLogs;
    }
    return null;
  },

  // operation_logs
  (s, params) => {
    if (s.includes("insert into operation_log") || s.includes("insert into t_operation_log")) {
      state.operationLogs.push({
        operatorId: params[0],
        operatorName: params[1],
        module: params[2],
        action: params[3],
        bizNo: params[4],
        afterData: params[5],
        createdAt: new Date().toISOString()
      });
      return [];
    }
    return null;
  },

  // platform_admin / t_platform_admin
  (s, params) => {
    if ((s.includes("from platform_admin where username") || s.includes("from t_platform_admin where username")) && s.includes("status")) {
      return state.platformAdmins.filter((u: any) => u.username === params[0] && u.status === 1);
    }
    if (s.includes("from platform_admin where id") || s.includes("from t_platform_admin where id")) {
      return state.platformAdmins.filter((u: any) => u.id === Number(params[0]));
    }
    if (s.includes("select id from platform_admin where username") || s.includes("select id from t_platform_admin where username")) {
      return state.platformAdmins.filter((u: any) => u.username === params[0]).map((u: any) => ({ id: u.id }));
    }
    if (s.includes("insert into platform_admin") || s.includes("insert into t_platform_admin")) {
      const id = state.platformAdmins.length + 1;
      state.platformAdmins.push({ id, username: params[0] as string, password: params[1] as string, real_name: params[2] as string, email: params[3] as string, phone: params[4] as string, role: params[5] as string, status: 1 });
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },

  // platform_config / platform_credentials
  (s, params) => {
    if ((s.includes("from platform_config") || s.includes("from t_platform_config")) && s.includes("count(*)")) {
      return [{ total: state.platformCredentials.length }];
    }
    if ((s.includes("from platform_config") || s.includes("from t_platform_config")) && s.includes("where platform = ?")) {
      const found = state.platformCredentials.find((c: Row) => c.platform === params[0]);
      return found ? [found] : [];
    }
    if (s.includes("from platform_config") || s.includes("from t_platform_config")) {
      return state.platformCredentials;
    }
    return null;
  },

  // platform_order
  (s, params) => {
    if ((s.includes("from platform_order") || s.includes("from t_platform_order")) && s.includes("count(*)")) {
      return [{ total: state.platformOrders.length }];
    }
    if ((s.includes("from platform_order") || s.includes("from t_platform_order")) && s.includes("where platform_order_id = ?")) {
      const found = state.platformOrders.find((o: Row) => o.platformOrderId === params[0] || o.platform_order_id === params[0]);
      return found ? [found] : [];
    }
    if (s.includes("from platform_order") || s.includes("from t_platform_order")) {
      return state.platformOrders;
    }
    return null;
  },
];

// ==================== mockExecute handlers ====================

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // error_logs DELETE
  (s, params) => {
    if ((s.includes("delete from error_logs") || s.includes("delete from t_error_logs")) && s.includes("created_at <")) {
      const retainDays = Number(params[0]) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retainDays);
      const beforeLen = state.errorLogs.length;
      state.errorLogs = state.errorLogs.filter((e: Row) => {
        const t = new Date(e.created_at || e.createdAt).getTime();
        return t >= cutoff.getTime();
      });
      return [{ affectedRows: beforeLen - state.errorLogs.length }];
    }
    return null;
  },

  // platform_config INSERT
  (s, params) => {
    if (s.includes("insert into platform_config") || s.includes("insert into t_platform_config")) {
      state.platformCredentials.push({
        id: state.platformCredentials.length + 1,
        platform: params[0],
        store_id: params[1],
        storeId: params[1],
        app_key: params[2],
        appKey: params[2],
        app_secret: params[3],
        appSecret: params[3],
        merchant_id: params[4],
        merchantId: params[4],
        config_json: params[5],
        configJson: params[5],
        enabled: params[6] ?? 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return result(state.platformCredentials.length);
    }
    return null;
  },

  // platform_config UPDATE
  (s, params) => {
    if (s.includes("update platform_config") || s.includes("update t_platform_config")) {
      const cfg = state.platformCredentials.find((c: Row) => c.platform === params[params.length - 1]);
      if (cfg) {
        if (params[0] != null) { cfg.store_id = params[0]; cfg.storeId = params[0]; }
        if (params[1] != null) { cfg.app_key = params[1]; cfg.appKey = params[1]; }
        if (params[2] != null) { cfg.app_secret = params[2]; cfg.appSecret = params[2]; }
        if (params[3] != null) { cfg.merchant_id = params[3]; cfg.merchantId = params[3]; }
        if (params[4] !== undefined) { cfg.config_json = params[4]; cfg.configJson = params[4]; }
        cfg.updated_at = new Date().toISOString();
      }
      return result();
    }
    return null;
  },

  // platform_config DELETE
  (s, params) => {
    if (s.includes("delete from platform_config") || s.includes("delete from t_platform_config")) {
      state.platformCredentials = state.platformCredentials.filter((c: Row) => c.platform !== params[0]);
      return result();
    }
    return null;
  },

  // platform_order INSERT
  (s, params) => {
    if (s.includes("insert into platform_order") || s.includes("insert into t_platform_order")) {
      const existingIdx = state.platformOrders.findIndex((o: Row) =>
        (o.platformOrderId === params[0] || o.platform_order_id === params[0]) && o.platform === params[1]
      );
      const row = {
        platformOrderId: params[0],
        platform_order_id: params[0],
        platform: params[1],
        store_id: params[2],
        storeId: params[2],
        status: params[3],
        order_data_json: params[4],
        orderDataJson: params[4],
        created_at: params[5] ?? new Date().toISOString(),
        createdAt: params[5] ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        state.platformOrders[existingIdx] = { ...state.platformOrders[existingIdx], ...row };
      } else {
        state.platformOrders.push(row);
      }
      return result();
    }
    return null;
  },

  // platform_order UPDATE
  (s, params) => {
    if (s.includes("update platform_order") || s.includes("update t_platform_order")) {
      const order = state.platformOrders.find((o: Row) => o.platformOrderId === params[params.length - 1] || o.platform_order_id === params[params.length - 1]);
      if (order) {
        order.status = params[0];
        order.updated_at = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
      }
      return result();
    }
    return null;
  },
];