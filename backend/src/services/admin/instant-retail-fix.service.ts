import { query, queryOne, queryWithTenant } from "../../shared/db";

/**
 * 即时零售补全服务（R100 商用化）：
 * - 订单同步日志 / 统计（t_miniapp_order_sync_log）
 * - 平台商品映射 / 统计（t_platform_product_map）
 */

// ==================== 1. 订单同步日志 ====================
export async function listSyncLogs(tenantId: string, params: {
  page?: number; pageSize?: number; status?: string; platform?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.status) { where.push("status = ?"); args.push(params.status); }
  if (params.platform) { where.push("platform = ?"); args.push(params.platform); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_miniapp_order_sync_log WHERE ${whereSql}`,
    args
  );
  const rows = await query<SyncLogRow>(
    `SELECT id, order_no, platform, sync_type, sync_direction, status, error_msg, created_at
     FROM t_miniapp_order_sync_log WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      channelOrderNo: r.order_no,
      channelType: r.platform,
      syncType: r.sync_direction === "PUSH_TO_PLATFORM" ? "PUSH" : r.sync_direction === "PULL_FROM_PLATFORM" ? "PULL" : r.sync_type || "-",
      fromStatus: "-",
      toStatus: "-",
      syncResult: r.status,
      errorMessage: r.error_msg || "",
      syncedAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getSyncStats(tenantId: string) {
  const stat = await queryOne<{ totalSync: number; successCount: number; failCount: number }>(
    `SELECT COUNT(*) AS totalSync,
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END), 0) AS successCount,
            COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failCount
     FROM t_miniapp_order_sync_log WHERE tenant_id = ?`,
    [tenantId]
  );
  return {
    totalSync: stat?.totalSync ?? 0,
    successCount: stat?.successCount ?? 0,
    failCount: stat?.failCount ?? 0,
    pendingCount: 0,
  };
}

// ==================== 2. 平台商品映射 ====================
export async function listProductMaps(tenantId: string, params: {
  page?: number; pageSize?: number; platform?: string; syncStatus?: string; keyword?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["m.tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.platform) { where.push("m.platform = ?"); args.push(params.platform); }
  if (params.syncStatus) { where.push("m.sync_status = ?"); args.push(params.syncStatus); }
  if (params.keyword) {
    where.push("(m.platform_sku_id LIKE ? OR m.platform_spu_id LIKE ? OR spu.name LIKE ?)");
    const kw = `%${params.keyword}%`;
    args.push(kw, kw, kw);
  }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_product_map m LEFT JOIN t_product_sku sku ON sku.id = m.local_sku_id
     LEFT JOIN t_product_spu spu ON spu.id = sku.spu_id WHERE ${whereSql}`,
    args
  );
  const rows = await query<ProductMapRow>(
    `SELECT m.id, m.platform, m.local_sku_id, m.platform_sku_id, m.platform_spu_id, m.sync_status,
            m.sync_msg, m.synced_at, m.updated_at, sku.sku_code, spu.name AS local_product_name
     FROM t_platform_product_map m
     LEFT JOIN t_product_sku sku ON sku.id = m.local_sku_id
     LEFT JOIN t_product_spu spu ON spu.id = sku.spu_id
     WHERE ${whereSql} ORDER BY m.updated_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      channelType: r.platform,
      channelSkuId: r.platform_sku_id || "",
      channelProductName: r.platform_spu_id || "",
      channelPrice: null,
      localSkuId: r.local_sku_id,
      localSkuCode: r.sku_code || "",
      localProductName: r.local_product_name || "",
      syncStatus: r.sync_status,
      syncMsg: r.sync_msg || "",
      syncedAt: r.synced_at,
      updatedAt: r.updated_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getProductMapStats(tenantId: string) {
  const rows = await query<{ platform: string; mapped: number; unmapped: number }>(
    `SELECT platform,
            COALESCE(SUM(CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END), 0) AS mapped,
            COALESCE(SUM(CASE WHEN sync_status <> 'SYNCED' THEN 1 ELSE 0 END), 0) AS unmapped
     FROM t_platform_product_map WHERE tenant_id = ? GROUP BY platform`,
    [tenantId]
  );
  const byChannel: Record<string, { mapped: number; unmapped: number }> = {};
  let mapped = 0;
  let unmapped = 0;
  for (const r of rows) {
    byChannel[r.platform] = { mapped: r.mapped, unmapped: r.unmapped };
    mapped += r.mapped;
    unmapped += r.unmapped;
  }
  return { total: mapped + unmapped, mapped, unmapped, byChannel };
}

interface SyncLogRow {
  id: number; order_no: string; platform: string; sync_type: string;
  sync_direction: string; status: string; error_msg: string | null; created_at: string;
}
interface ProductMapRow {
  id: number; platform: string; local_sku_id: number; platform_sku_id: string | null;
  platform_spu_id: string | null; sync_status: string; sync_msg: string | null;
  synced_at: string | null; updated_at: string; sku_code: string | null; local_product_name: string | null;
}

// ==================== 3. 订单路由规则 ====================
export async function listRoutingRules(tenantId: string, params: { page?: number; pageSize?: number; channelType?: string }) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.channelType) { where.push("channel_type = ?"); args.push(params.channelType); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_order_routing_rule WHERE ${whereSql}`,
    args
  );
  const rows = await query<RoutingRuleRow>(
    `SELECT id, rule_name, channel_type, store_id, store_name, priority, condition_summary, action_type, is_enabled, created_at
     FROM t_order_routing_rule WHERE ${whereSql} ORDER BY priority ASC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      ruleName: r.rule_name,
      channelType: r.channel_type,
      storeId: r.store_id,
      storeName: r.store_name || "",
      priority: r.priority,
      conditionSummary: r.condition_summary || "",
      actionType: r.action_type,
      isEnabled: !!r.is_enabled,
      createdAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function createRoutingRule(tenantId: string, body: any) {
  const insert = (await query(
    `INSERT INTO t_order_routing_rule (tenant_id, rule_name, channel_type, store_id, store_name, priority, condition_summary, action_type, is_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, body.ruleName, body.channelType, body.storeId ?? null, body.storeName ?? null,
      body.priority ?? 0, body.conditionSummary ?? null, body.actionType ?? "ASSIGN_STORE", body.isEnabled === false ? 0 : 1]
  )) as unknown as { insertId: number };
  return { id: insert.insertId };
}

export async function updateRoutingRule(tenantId: string, id: number, body: any) {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.ruleName !== undefined) { sets.push("rule_name = ?"); args.push(body.ruleName); }
  if (body.channelType !== undefined) { sets.push("channel_type = ?"); args.push(body.channelType); }
  if (body.storeId !== undefined) { sets.push("store_id = ?"); args.push(body.storeId ?? null); }
  if (body.storeName !== undefined) { sets.push("store_name = ?"); args.push(body.storeName ?? null); }
  if (body.priority !== undefined) { sets.push("priority = ?"); args.push(body.priority); }
  if (body.conditionSummary !== undefined) { sets.push("condition_summary = ?"); args.push(body.conditionSummary ?? null); }
  if (body.actionType !== undefined) { sets.push("action_type = ?"); args.push(body.actionType); }
  if (body.isEnabled !== undefined) { sets.push("is_enabled = ?"); args.push(body.isEnabled === false ? 0 : 1); }
  if (!sets.length) return { success: true };
  sets.push("updated_at = NOW()");
  args.push(id, tenantId);
  await query(`UPDATE t_order_routing_rule SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, args);
  return { success: true };
}

export async function deleteRoutingRule(tenantId: string, id: number) {
  const result = (await query("DELETE FROM t_order_routing_rule WHERE id = ? AND tenant_id = ?", [id, tenantId])) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new Error("路由规则不存在");
  return { success: true };
}

// ==================== 4. 门店负载 ====================
export async function getStoreLoad(tenantId: string) {
  const rows = await query<{ storeId: number; storeName: string; orderCount: number }>(
    `SELECT store_id AS storeId, s.name AS storeName, COUNT(*) AS orderCount
     FROM t_platform_order po LEFT JOIN t_store s ON s.id = po.store_id
     WHERE po.tenant_id = ? AND DATE(po.created_at) = CURDATE()
     GROUP BY store_id, s.name ORDER BY orderCount DESC`,
    [tenantId]
  );
  const capacity = 100;
  return rows.map((r) => ({
    storeName: r.storeName || `门店${r.storeId}`,
    orderCount: r.orderCount,
    capacity,
    loadRate: Math.min(100, Math.round((r.orderCount / capacity) * 100)),
  }));
}

// ==================== 5. 订单异常 ====================
export async function listExceptions(tenantId: string, params: {
  page?: number; pageSize?: number; handleStatus?: string; level?: string; channelType?: string; keyword?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.handleStatus) { where.push("handle_status = ?"); args.push(params.handleStatus); }
  if (params.level) { where.push("exception_level = ?"); args.push(params.level); }
  if (params.channelType) { where.push("channel_type = ?"); args.push(params.channelType); }
  if (params.keyword) { where.push("(channel_order_no LIKE ? OR exception_detail LIKE ?)"); const kw = `%${params.keyword}%`; args.push(kw, kw); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_order_exception WHERE ${whereSql}`,
    args
  );
  const rows = await query<ExceptionRow>(
    `SELECT id, exception_no, exception_level, channel_order_no, channel_type, exception_type, exception_detail,
            handle_status, handler_name, handle_result, handled_at, created_at
     FROM t_order_exception WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      exceptionLevel: r.exception_level,
      channelOrderNo: r.channel_order_no || "",
      channelType: r.channel_type || "",
      exceptionType: r.exception_type,
      exceptionDetail: r.exception_detail || "",
      handleStatus: r.handle_status,
      handlerName: r.handler_name || "",
      handleResult: r.handle_result || "",
      createdAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getExceptionStats(tenantId: string) {
  const stat = await queryOne<{ pending: number; today: number; weekResolved: number; avgHours: number | null }>(
    `SELECT
      COALESCE(SUM(CASE WHEN handle_status IN ('PENDING', 'PROCESSING') THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN handle_status IN ('RESOLVED', 'CLOSED') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END), 0) AS weekResolved,
      ROUND(AVG(CASE WHEN handled_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, handled_at) ELSE NULL END), 1) AS avgHours
     FROM t_order_exception WHERE tenant_id = ?`,
    [tenantId]
  );
  const byType = await query<{ exception_type: string; count: number }>(
    `SELECT exception_type, COUNT(*) AS count FROM t_order_exception WHERE tenant_id = ? GROUP BY exception_type ORDER BY count DESC LIMIT 8`,
    [tenantId]
  );
  const byChannel = await query<{ channel_type: string; total: number; abnormal: number }>(
    `SELECT channel_type, COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN handle_status IN ('PENDING', 'PROCESSING') THEN 1 ELSE 0 END), 0) AS abnormal
     FROM t_order_exception WHERE tenant_id = ? AND channel_type IS NOT NULL GROUP BY channel_type`,
    [tenantId]
  );
  const trend = await query<{ date: string; count: number }>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM t_order_exception
     WHERE tenant_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
     GROUP BY DATE(created_at) ORDER BY date ASC`,
    [tenantId]
  );
  return {
    pendingCount: stat?.pending ?? 0,
    todayNewCount: stat?.today ?? 0,
    weekResolvedCount: stat?.weekResolved ?? 0,
    avgHandleHours: stat?.avgHours ?? 0,
    exceptionTypes: byType.map((r) => ({ type: r.exception_type, name: r.exception_type, count: r.count })),
    channelException: byChannel.map((r) => ({
      channel: r.channel_type,
      name: r.channel_type,
      rate: r.total ? Number(((r.abnormal / r.total) * 100).toFixed(1)) : 0,
    })),
    exceptionTrend: trend.map((r) => ({ date: r.date, count: r.count })),
  };
}

export async function handleException(tenantId: string, id: number, handlerId: number, handlerName: string, body: { action: string; result?: string; status?: string }) {
  const status = body.status || "RESOLVED";
  const result = (await query(
    `UPDATE t_order_exception SET handle_status = ?, handler_id = ?, handler_name = ?, handle_result = ?, handled_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [status, handlerId, handlerName || null, body.result || null, id, tenantId]
  )) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new Error("异常记录不存在");
  await query(
    `INSERT INTO t_order_exception_log (tenant_id, exception_id, handler_name, action, result) VALUES (?, ?, ?, ?, ?)`,
    [tenantId, id, handlerName || null, body.action || status, body.result || null]
  );
  return { success: true };
}

export async function listExceptionLogs(tenantId: string, exceptionId: number) {
  return query<ExceptionLogRow>(
    `SELECT id, handler_name, action, result, created_at FROM t_order_exception_log
     WHERE tenant_id = ? AND exception_id = ? ORDER BY created_at ASC`,
    [tenantId, exceptionId]
  ).then((rows) => rows.map((r) => ({
    id: r.id,
    handlerName: r.handler_name || "",
    action: r.action,
    result: r.result || "",
    createdAt: r.created_at,
  })));
}

interface RoutingRuleRow {
  id: number; rule_name: string; channel_type: string; store_id: number | null; store_name: string | null;
  priority: number; condition_summary: string | null; action_type: string; is_enabled: number; created_at: string;
}
interface ExceptionRow {
  id: number; exception_no: string; exception_level: string; channel_order_no: string | null;
  channel_type: string | null; exception_type: string; exception_detail: string | null;
  handle_status: string; handler_name: string | null; handle_result: string | null;
  handled_at: string | null; created_at: string;
}
interface ExceptionLogRow {
  id: number; handler_name: string | null; action: string; result: string | null; created_at: string;
}
