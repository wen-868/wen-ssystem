﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ===== 类型定义 =====
/** COUNT(*) AS total 查询行 */
interface CountTotalRow {
  total: number | string;
}

/** 满减活动详情查询行 */
interface FullReductionRow {
  id: number | string;
  name: string;
  rules: string;
  applicableScope: string;
  applicableIds: string | null;
  startTime: string | Date;
  endTime: string | Date;
  status: string;
  priority: number | string;
  stackable: number | string;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 满减活动 id/status 查询行 */
interface FullReductionIdStatusRow {
  id: number | string;
  status: string;
}

export async function createFullReduction(body: {
  name: string;
  rules: Array<{ minAmount: number; reduceAmount: number }>;
  applicableScope: string;
  applicableIds: number[] | null;
  startTime: string;
  endTime: string;
  priority: number;
  stackable: boolean;
  description: string;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO t_full_reduction (name, rules, applicable_scope, applicable_ids,
        start_time, end_time, priority, stackable, description, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.name, JSON.stringify(body.rules), body.applicableScope,
      JSON.stringify(body.applicableIds), body.startTime, body.endTime,
      body.priority, body.stackable ? 1 : 0, body.description, tenantId
    ],
    tenantId
  );

  const record = await queryOneWithTenant<FullReductionRow>(
    `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            start_time AS startTime, end_time AS endTime, status, priority, stackable,
            description, created_at AS createdAt, updated_at AS updatedAt
     FROM t_full_reduction ORDER BY id DESC LIMIT 1`,
    [],
    tenantId
  );

  return record;
}

export async function listFullReductions(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<FullReductionRow>(
    `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            start_time AS startTime, end_time AS endTime, status, priority, stackable,
            description, created_at AS createdAt, updated_at AS updatedAt
     FROM t_full_reduction
     ${where}
     ORDER BY priority DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_full_reduction ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getFullReduction(id: number, tenantId: string) {
  const record = await queryOneWithTenant<FullReductionRow>(
    `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            start_time AS startTime, end_time AS endTime, status, priority, stackable,
            description, created_at AS createdAt, updated_at AS updatedAt
     FROM t_full_reduction WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("满减活动不存在"), { statusCode: 404 });
  }
  return record;
}

export async function updateFullReduction(id: number, body: {
  name?: string;
  rules?: Array<{ minAmount: number; reduceAmount: number }>;
  applicableScope?: string;
  applicableIds?: number[] | null;
  startTime?: string;
  endTime?: string;
  priority?: number;
  stackable?: boolean;
  description?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<FullReductionIdStatusRow>("SELECT id, status FROM t_full_reduction WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("满减活动不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.rules !== undefined) { updates.push("rules = ?"); params.push(JSON.stringify(body.rules)); }
  if (body.applicableScope !== undefined) { updates.push("applicable_scope = ?"); params.push(body.applicableScope); }
  if (body.applicableIds !== undefined) { updates.push("applicable_ids = ?"); params.push(JSON.stringify(body.applicableIds)); }
  if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
  if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }
  if (body.priority !== undefined) { updates.push("priority = ?"); params.push(body.priority); }
  if (body.stackable !== undefined) { updates.push("stackable = ?"); params.push(body.stackable ? 1 : 0); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }

  if (updates.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE t_full_reduction SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
  }

  const record = await queryOneWithTenant<FullReductionRow>(
    `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            start_time AS startTime, end_time AS endTime, status, priority, stackable,
            description, created_at AS createdAt, updated_at AS updatedAt
     FROM t_full_reduction WHERE id = ?`,
    [id],
    tenantId
  );

  return record;
}

export async function deleteFullReduction(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<FullReductionIdStatusRow>("SELECT id, status FROM t_full_reduction WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("满减活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态的满减活动可删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM t_full_reduction WHERE id = ?", [id], tenantId);
  return { id, deleted: true };
}

export async function activateFullReduction(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<FullReductionIdStatusRow>("SELECT id, status FROM t_full_reduction WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("满减活动不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PAUSED"].includes(existing.status)) {
    throw Object.assign(new Error("仅草稿或暂停状态的活动可激活"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE t_full_reduction SET status = 'ACTIVE' WHERE id = ?", [id], tenantId);
  return { id, status: "ACTIVE" };
}

export async function pauseFullReduction(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<FullReductionIdStatusRow>("SELECT id, status FROM t_full_reduction WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("满减活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅激活状态的活动可暂停"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE t_full_reduction SET status = 'PAUSED' WHERE id = ?", [id], tenantId);
  return { id, status: "PAUSED" };
}
