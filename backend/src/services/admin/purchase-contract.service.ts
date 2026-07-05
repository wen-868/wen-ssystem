import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function listPurchaseContracts(params: {
  supplierId?: number; status?: string; page: number; pageSize: number; tenantId: string;
}) {
  const { supplierId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["pc.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("pc.supplier_id = ?"); queryParams.push(supplierId); }
  if (status) { conditions.push("pc.status = ?"); queryParams.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT pc.contract_no AS contractNo, pc.supplier_id AS supplierId,
            s.name AS supplierName, pc.contract_name AS contractName,
            pc.contract_type AS contractType, pc.total_amount AS totalAmount,
            pc.paid_amount AS paidAmount, pc.sign_date AS signDate,
            pc.start_date AS startDate, pc.end_date AS endDate,
            pc.status, pc.file_url AS fileUrl, pc.remark, pc.created_at AS createdAt
     FROM purchase_contract pc
     LEFT JOIN supplier s ON s.id = pc.supplier_id
     ${where}
     ORDER BY pc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM purchase_contract pc ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createPurchaseContract(params: {
  supplierId: number; contractName: string; contractType?: string;
  totalAmount?: number; signDate?: string; startDate?: string; endDate?: string;
  remark?: string; tenantId: string;
}) {
  const { supplierId, contractName, contractType, totalAmount, signDate, startDate, endDate, remark, tenantId } = params;
  const contractNo = makeBizNo("HT");
  const result = await queryWithTenant<any>(
    `INSERT INTO purchase_contract (contract_no, supplier_id, contract_name, contract_type, total_amount, sign_date, start_date, end_date, remark, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contractNo, supplierId, contractName, contractType ?? "PURCHASE", totalAmount ?? 0, signDate ?? null, startDate ?? null, endDate ?? null, remark ?? null, tenantId],
    tenantId
  );
  return { contractNo, supplierId, contractName, id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updatePurchaseContract(contractNo: string, params: {
  contractName?: string; contractType?: string; totalAmount?: number;
  signDate?: string; startDate?: string; endDate?: string;
  status?: string; remark?: string; tenantId: string;
}) {
  const existing = await queryOneWithTenant<any>(
    "SELECT contract_no FROM purchase_contract WHERE contract_no = ? AND tenant_id = ?",
    [contractNo, params.tenantId],
    params.tenantId
  );
  if (!existing) throw new Error("合同不存在");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (params.contractName !== undefined) { fields.push("contract_name = ?"); values.push(params.contractName); }
  if (params.contractType !== undefined) { fields.push("contract_type = ?"); values.push(params.contractType); }
  if (params.totalAmount !== undefined) { fields.push("total_amount = ?"); values.push(params.totalAmount); }
  if (params.signDate !== undefined) { fields.push("sign_date = ?"); values.push(params.signDate); }
  if (params.startDate !== undefined) { fields.push("start_date = ?"); values.push(params.startDate); }
  if (params.endDate !== undefined) { fields.push("end_date = ?"); values.push(params.endDate); }
  if (params.status !== undefined) { fields.push("status = ?"); values.push(params.status); }
  if (params.remark !== undefined) { fields.push("remark = ?"); values.push(params.remark); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(contractNo, params.tenantId);
  await queryWithTenant<any>(
    `UPDATE purchase_contract SET ${fields.join(", ")} WHERE contract_no = ? AND tenant_id = ?`,
    values,
    params.tenantId
  );
  return { contractNo, ...params };
}

export async function deletePurchaseContract(contractNo: string, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT contract_no FROM purchase_contract WHERE contract_no = ? AND tenant_id = ?",
    [contractNo, tenantId],
    tenantId
  );
  if (!existing) throw new Error("合同不存在");
  await queryWithTenant<any>(
    "DELETE FROM purchase_contract WHERE contract_no = ? AND tenant_id = ?",
    [contractNo, tenantId],
    tenantId
  );
  return { contractNo };
}

export async function uploadContractFile(contractNo: string, fileUrl: string, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT contract_no FROM purchase_contract WHERE contract_no = ? AND tenant_id = ?",
    [contractNo, tenantId],
    tenantId
  );
  if (!existing) throw new Error("合同不存在");
  await queryWithTenant<any>(
    "UPDATE purchase_contract SET file_url = ? WHERE contract_no = ? AND tenant_id = ?",
    [fileUrl, contractNo, tenantId],
    tenantId
  );
  return { contractNo, fileUrl };
}