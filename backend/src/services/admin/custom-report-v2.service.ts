import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export interface ReportListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  reportType?: string;
  status?: string;
}

export interface ReportCreateData {
  reportName: string;
  reportType: string;
  dataSource: string;
  config?: unknown;
  chartType?: string;
  description?: string;
}

export interface ReportUpdateData {
  reportName?: string;
  reportType?: string;
  dataSource?: string;
  config?: unknown;
  chartType?: string;
  description?: string;
  status?: string;
}

export interface ReportGenerateParams {
  dateStart?: string;
  dateEnd?: string;
  filters?: Record<string, unknown>;
}

/** 报表列表 */
export async function listReports(tenantId: string, params: ReportListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.keyword) {
    conditions.push("report_name LIKE ?");
    sqlParams.push(`%${params.keyword}%`);
  }
  if (params.reportType) {
    conditions.push("report_type = ?");
    sqlParams.push(params.reportType);
  }
  if (params.status) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM custom_report ${where}`,
    sqlParams,
    tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT id, report_name AS reportName, report_type AS reportType,
            data_source AS dataSource, config, chart_type AS chartType,
            description, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM custom_report ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

/** 创建报表 */
export async function createReport(tenantId: string, data: ReportCreateData, userId?: number) {
  const result = await queryWithTenant<Record<string, unknown>>(
    `INSERT INTO custom_report (tenant_id, report_name, report_type, data_source, config, chart_type, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      data.reportName,
      data.reportType,
      data.dataSource,
      JSON.stringify(data.config || {}),
      data.chartType || "TABLE",
      data.description || null,
      userId || null,
    ],
    tenantId
  );
  const insertId = (result as unknown as Record<string, unknown>).insertId as number;
  return { id: insertId };
}

/** 报表详情 */
export async function getReport(tenantId: string, id: number) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, report_name AS reportName, report_type AS reportType,
            data_source AS dataSource, config, chart_type AS chartType,
            description, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM custom_report
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("报表不存在"), { statusCode: 404 });
  }
  return record;
}

/** 更新报表 */
export async function updateReport(tenantId: string, id: number, data: ReportUpdateData) {
  const existing = await queryOneWithTenant<{ id: number }>(
    "SELECT id FROM custom_report WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报表不存在"), { statusCode: 404 });
  }

  const sets: string[] = [];
  const sqlParams: unknown[] = [];

  if (data.reportName !== undefined) { sets.push("report_name = ?"); sqlParams.push(data.reportName); }
  if (data.reportType !== undefined) { sets.push("report_type = ?"); sqlParams.push(data.reportType); }
  if (data.dataSource !== undefined) { sets.push("data_source = ?"); sqlParams.push(data.dataSource); }
  if (data.config !== undefined) { sets.push("config = ?"); sqlParams.push(JSON.stringify(data.config)); }
  if (data.chartType !== undefined) { sets.push("chart_type = ?"); sqlParams.push(data.chartType); }
  if (data.description !== undefined) { sets.push("description = ?"); sqlParams.push(data.description); }
  if (data.status !== undefined) { sets.push("status = ?"); sqlParams.push(data.status); }

  if (sets.length === 0) {
    return { id };
  }

  sets.push("updated_at = NOW()");
  sqlParams.push(id, tenantId);

  await queryWithTenant(
    `UPDATE custom_report SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    sqlParams,
    tenantId
  );
  return { id };
}

/** 删除报表 */
export async function deleteReport(tenantId: string, id: number) {
  const existing = await queryOneWithTenant<{ id: number }>(
    "SELECT id FROM custom_report WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报表不存在"), { statusCode: 404 });
  }

  await queryWithTenant(
    "DELETE FROM custom_report WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id, deleted: true };
}

/** 生成报表数据 */
export async function generateReport(tenantId: string, id: number, params: ReportGenerateParams) {
  const report = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, report_name AS reportName, report_type AS reportType, data_source AS dataSource, config, chart_type AS chartType FROM custom_report WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!report) {
    throw Object.assign(new Error("报表不存在"), { statusCode: 404 });
  }

  const config = typeof report.config === "string" ? JSON.parse(report.config) : report.config;
  const { dimensions, metrics, filters: configFilters } = config as {
    dimensions?: string[];
    metrics?: string[];
    filters?: Array<{ field: string; op: string; value: unknown }>;
  };

  const dataSource = String(report.dataSource || "sale_bill");

  const selectParts: string[] = [];
  const groupParts: string[] = [];

  if (dimensions && dimensions.length > 0) {
    dimensions.forEach((d) => {
      selectParts.push(d);
      groupParts.push(d);
    });
  }
  if (metrics && metrics.length > 0) {
    metrics.forEach((m) => {
      selectParts.push(m);
    });
  }

  if (selectParts.length === 0) {
    selectParts.push("*");
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM ${dataSource}`;

  const whereConditions: string[] = ["tenant_id = ?"];
  const whereParams: unknown[] = [tenantId];

  if (configFilters && Array.isArray(configFilters)) {
    configFilters.forEach((f) => {
      whereConditions.push(`${f.field} ${f.op} ?`);
      whereParams.push(f.value);
    });
  }

  if (params.filters && typeof params.filters === "object") {
    Object.entries(params.filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        whereConditions.push(`${field} = ?`);
        whereParams.push(value);
      }
    });
  }

  if (params.dateStart) {
    whereConditions.push("created_at >= ?");
    whereParams.push(params.dateStart);
  }
  if (params.dateEnd) {
    whereConditions.push("created_at <= ?");
    whereParams.push(params.dateEnd);
  }

  sql += " WHERE " + whereConditions.join(" AND ");

  if (groupParts.length > 0) {
    sql += " GROUP BY " + groupParts.join(", ");
  }

  sql += " ORDER BY created_at DESC LIMIT 1000";

  const rows = await queryWithTenant<Record<string, unknown>>(sql, whereParams, tenantId);

  // 记录生成日志
  await queryWithTenant(
    `INSERT INTO custom_report_log (report_id, params, row_count, status, tenant_id)
     VALUES (?, ?, ?, 'SUCCESS', ?)`,
    [id, JSON.stringify(params || {}), rows.length, tenantId],
    tenantId
  );

  return {
    report: {
      id: report.id,
      reportName: report.reportName,
      reportType: report.reportType,
      chartType: report.chartType,
    },
    rows,
    total: rows.length,
  };
}

/** 导出报表 */
export async function exportReport(tenantId: string, id: number, format: string, params: ReportGenerateParams) {
  const result = await generateReport(tenantId, id, params);

  const fileName = `${result.report.reportName}_${Date.now()}.${format.toLowerCase()}`;
  const fileUrl = `/exports/${fileName}`;

  // 记录导出日志
  await queryWithTenant(
    `INSERT INTO custom_report_log (report_id, params, row_count, file_url, export_format, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?)`,
    [id, JSON.stringify(params || {}), result.total, fileUrl, format.toUpperCase(), tenantId],
    tenantId
  );

  return {
    ...result,
    exportFormat: format.toUpperCase(),
    fileUrl,
    fileName,
  };
}
