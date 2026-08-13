/**
 * 数据导入导出服务（商品/客户）
 * 导出复用 export.service 查询，导入支持 CSV 文本解析写入。
 */
import { query } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { exportProducts, exportCustomers } from "./export.service";

/** 商品导出（数组，前端转 CSV） */
export function exportProductsData(tenantId: string, keyword?: string) {
  return exportProducts(tenantId, keyword);
}

/** 客户导出（数组，前端转 CSV） */
export function exportCustomersData(tenantId: string, keyword?: string) {
  return exportCustomers(tenantId, keyword);
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** 解析 CSV 文本为二维数组（支持引号包裹） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** 客户 CSV 导入：表头 name,mobile,customerType */
export async function importCustomersCsv(csv: string, tenantId: string): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    throw new AppError("CSV 内容为空或缺少数据行", 400);
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const mobileIdx = header.indexOf("mobile");
  if (nameIdx < 0 || mobileIdx < 0) {
    throw new AppError("CSV 表头需包含 name 与 mobile 列", 400);
  }
  const typeIdx = header.indexOf("customertype");

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[nameIdx] || "").trim();
    const mobile = (r[mobileIdx] || "").trim();
    if (!name || !/^1[3-9]\d{9}$/.test(mobile)) {
      skipped++;
      errors.push(`第 ${i + 1} 行：姓名或手机号不合法`);
      continue;
    }
    const existing = await query<{ id: number }>(
      "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
      [mobile, tenantId]
    );
    if (existing.length > 0) {
      skipped++;
      errors.push(`第 ${i + 1} 行：手机号 ${mobile} 已存在`);
      continue;
    }
    const customerType = typeIdx >= 0 && r[typeIdx]?.trim() === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
    await query(
      `INSERT INTO t_member (name, mobile, customer_type, status, tenant_id)
       VALUES (?, ?, ?, 1, ?)`,
      [name, mobile, customerType, tenantId]
    );
    imported++;
  }

  return { imported, skipped, errors: errors.slice(0, 20) };
}
