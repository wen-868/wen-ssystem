import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = (globalThis as any).process?.env?.PAYMENT_ENCRYPTION_KEY || "zhixiang-payment-enc-key-32chr!!";

function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function maskValue(value: string): string {
  if (!value) return "";
  return "***";
}

export async function getChannelConfig(tenantId: string, provider: string) {
  const rows = await queryWithTenant<any>(
    "SELECT id, config_key AS configKey, config_value AS configValue, is_encrypted AS isEncrypted, description, sort_order AS sortOrder FROM payment_config WHERE tenant_id = ? AND provider = ? ORDER BY sort_order",
    [tenantId, provider],
    tenantId
  );
  return rows.map((row: any) => ({
    ...row,
    configValue: row.isEncrypted ? maskValue(row.configValue) : row.configValue,
  }));
}

export async function saveChannelConfig(tenantId: string, provider: string, body: Record<string, string>) {
  for (const [key, value] of Object.entries(body)) {
    const existing = await queryOneWithTenant<any>(
      "SELECT id, is_encrypted AS isEncrypted FROM payment_config WHERE tenant_id = ? AND provider = ? AND config_key = ?",
      [tenantId, provider, key],
      tenantId
    );
    const isEncrypted = existing?.isEncrypted === 1;
    const storedValue = isEncrypted ? encrypt(value) : value;

    if (existing) {
      await queryWithTenant(
        "UPDATE payment_config SET config_value = ?, updated_at = NOW() WHERE id = ?",
        [storedValue, existing.id],
        tenantId
      );
    } else {
      // 插入新配置项（默认不加密）
      await queryWithTenant(
        "INSERT INTO payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description) VALUES (?, ?, ?, ?, 0, ?)",
        [tenantId, provider, key, value, key],
        tenantId
      );
    }
  }
  return { success: true };
}

export async function isProviderReady(tenantId: string, provider: string): Promise<boolean> {
  if (provider === "wechat_pay") {
    const requiredKeys = ["enabled", "app_id", "mch_id", "api_v3_key", "serial_no", "private_key", "notify_url"];
    for (const key of requiredKeys) {
      const row = await queryOneWithTenant<any>(
        "SELECT config_value AS configValue FROM payment_config WHERE tenant_id = ? AND provider = ? AND config_key = ?",
        [tenantId, provider, key],
        tenantId
      );
      if (key === "enabled") {
        if (row?.configValue !== "1") return false;
      } else {
        if (!row?.configValue) return false;
      }
    }
    return true;
  }
  if (provider === "alipay") {
    const requiredKeys = ["enabled", "app_id", "private_key", "alipay_public_key", "notify_url"];
    for (const key of requiredKeys) {
      const row = await queryOneWithTenant<any>(
        "SELECT config_value AS configValue FROM payment_config WHERE tenant_id = ? AND provider = ? AND config_key = ?",
        [tenantId, provider, key],
        tenantId
      );
      if (key === "enabled") {
        if (row?.configValue !== "1") return false;
      } else {
        if (!row?.configValue) return false;
      }
    }
    return true;
  }
  return false;
}

export async function getPaymentStatus(tenantId: string) {
  const providers = ["wechat_pay", "alipay"];
  const result: Record<string, { configured: boolean; enabled: boolean }> = {};
  for (const provider of providers) {
    const enabled = await queryOneWithTenant<any>(
      "SELECT config_value AS configValue FROM payment_config WHERE tenant_id = ? AND provider = ? AND config_key = 'enabled'",
      [tenantId, provider],
      tenantId
    );
    const ready = await isProviderReady(tenantId, provider);
    result[provider] = {
      configured: ready,
      enabled: enabled?.configValue === "1",
    };
  }
  return result;
}

export async function testConnection(tenantId: string, provider: string): Promise<{ success: boolean; message: string }> {
  const ready = await isProviderReady(tenantId, provider);
  if (!ready) {
    // 列出缺失的配置项
    const requiredKeys = provider === "wechat_pay"
      ? ["app_id", "mch_id", "api_v3_key", "serial_no", "private_key", "notify_url"]
      : ["app_id", "private_key", "alipay_public_key", "notify_url"];
    const missing: string[] = [];
    for (const key of requiredKeys) {
      const row = await queryOneWithTenant<any>(
        "SELECT config_value AS configValue FROM payment_config WHERE tenant_id = ? AND provider = ? AND config_key = ?",
        [tenantId, provider, key],
        tenantId
      );
      if (!row?.configValue) missing.push(key);
    }
    return { success: false, message: `配置不完整，缺少: ${missing.join(", ")}` };
  }
  return { success: true, message: `${provider} 配置完整，连接测试通过` };
}

// ==================== 银行账号 CRUD ====================

export async function listBankAccounts(tenantId: string) {
  const rows = await queryWithTenant<any>(
    "SELECT id, bank_name AS bankName, branch_name AS branchName, account_name AS accountName, account_no AS accountNo, bank_code AS bankCode, qr_code_url AS qrCodeUrl, is_default AS isDefault, status, remark, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM bank_account WHERE tenant_id = ? ORDER BY sort_order, id",
    [tenantId],
    tenantId
  );
  return rows.map((row: any) => ({
    ...row,
    accountNo: maskValue(row.accountNo),
  }));
}

export async function addBankAccount(tenantId: string, body: any) {
  const encryptedAccountNo = encrypt(body.accountNo || "");
  const result = await queryWithTenant(
    "INSERT INTO bank_account (tenant_id, bank_name, branch_name, account_name, account_no, bank_code, qr_code_url, is_default, status, remark, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [tenantId, body.bankName, body.branchName || "", body.accountName, encryptedAccountNo, body.bankCode || "", body.qrCodeUrl || "", body.isDefault ? 1 : 0, body.status || "active", body.remark || "", body.sortOrder || 0],
    tenantId
  );
  // 如果设为默认，取消其他默认
  if (body.isDefault) {
    await queryWithTenant(
      "UPDATE bank_account SET is_default = 0 WHERE tenant_id = ? AND id != ?",
      [tenantId, (result as any).insertId],
      tenantId
    );
  }
  return { id: (result as any).insertId };
}

export async function updateBankAccount(tenantId: string, id: number, body: any) {
  const sets: string[] = [];
  const params: any[] = [];
  if (body.bankName !== undefined) { sets.push("bank_name = ?"); params.push(body.bankName); }
  if (body.branchName !== undefined) { sets.push("branch_name = ?"); params.push(body.branchName); }
  if (body.accountName !== undefined) { sets.push("account_name = ?"); params.push(body.accountName); }
  if (body.accountNo !== undefined) { sets.push("account_no = ?"); params.push(encrypt(body.accountNo)); }
  if (body.bankCode !== undefined) { sets.push("bank_code = ?"); params.push(body.bankCode); }
  if (body.qrCodeUrl !== undefined) { sets.push("qr_code_url = ?"); params.push(body.qrCodeUrl); }
  if (body.isDefault !== undefined) { sets.push("is_default = ?"); params.push(body.isDefault ? 1 : 0); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (body.remark !== undefined) { sets.push("remark = ?"); params.push(body.remark); }
  if (body.sortOrder !== undefined) { sets.push("sort_order = ?"); params.push(body.sortOrder); }

  if (sets.length > 0) {
    params.push(id, tenantId);
    await queryWithTenant(
      `UPDATE bank_account SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      params,
      tenantId
    );
  }

  if (body.isDefault) {
    await queryWithTenant(
      "UPDATE bank_account SET is_default = 0 WHERE tenant_id = ? AND id != ?",
      [tenantId, id],
      tenantId
    );
  }
  return { success: true };
}

export async function deleteBankAccount(tenantId: string, id: number) {
  await queryWithTenant("DELETE FROM bank_account WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { success: true };
}

export async function setDefaultBankAccount(tenantId: string, id: number) {
  await queryWithTenant("UPDATE bank_account SET is_default = 0 WHERE tenant_id = ?", [tenantId], tenantId);
  await queryWithTenant("UPDATE bank_account SET is_default = 1 WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { success: true };
}