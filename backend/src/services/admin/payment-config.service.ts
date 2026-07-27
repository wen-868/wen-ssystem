﻿﻿﻿import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";

/** 支付渠道配置数据（保存渠道配置用） */
interface ChannelConfigData {
  appId?: string;
  appSecret?: string;
  mchId?: string;
  apiKey?: string;
  apiV3Key?: string;
  privateKey?: string;
  certPath?: string;
  serialNo?: string;
  notifyUrl?: string;
  alipayPublicKey?: string;
  enabled?: number | boolean;
}

/** 银行账号数据（创建/编辑银行账号用，与 controller Zod schema 对齐） */
interface BankAccountData {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  remark?: string;
  isDefault?: number | boolean;
}

export async function isProviderReady(tenantId: string, provider: string): Promise<boolean> {
  return PaymentConfigService.isProviderReady(tenantId, provider);
}

export class PaymentConfigService {
  // 获取渠道配置（敏感字段脱敏：返回 ***）
  static async getChannelConfig(tenantId: string, provider: string) {
    const row = await queryOneWithTenant(
      `SELECT * FROM t_payment_config WHERE provider = ?`,
      [provider],
      tenantId
    );
    if (!row) return null;
    // 脱敏：返回到前端时脱敏 api_v3_key, private_key, app_secret
    row.api_v3_key = row.api_v3_key ? '***' : '';
    row.private_key = row.private_key ? '***' : '';
    row.app_secret = row.app_secret ? '***' : '';
    return row;
  }

  // 保存渠道配置
  static async saveChannelConfig(tenantId: string, provider: string, data: ChannelConfigData) {
    const existing = await queryOneWithTenant(
      `SELECT id FROM t_payment_config WHERE provider = ?`, [provider], tenantId
    );
    if (existing) {
      await executeWithTenant(
        `UPDATE t_payment_config SET app_id=?, mch_id=?, api_v3_key=?, private_key=?, serial_no=?, notify_url=?, alipay_public_key=?, enabled=?, updated_at=NOW() WHERE provider=?`,
        [data.appId || '', data.mchId || '', data.apiV3Key || '', data.privateKey || '', data.serialNo || '', data.notifyUrl || '', data.alipayPublicKey || '', data.enabled ? 1 : 0, provider],
        tenantId
      );
    } else {
      await executeWithTenant(
        `INSERT INTO t_payment_config (provider, app_id, mch_id, api_v3_key, private_key, serial_no, notify_url, alipay_public_key, enabled, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [provider, data.appId || '', data.mchId || '', data.apiV3Key || '', data.privateKey || '', data.serialNo || '', data.notifyUrl || '', data.alipayPublicKey || '', data.enabled ? 1 : 0, tenantId],
        tenantId
      );
    }
    return { success: true };
  }

  // 检查是否已配置
  static async isProviderReady(tenantId: string, provider: string): Promise<boolean> {
    const row = await queryOneWithTenant(
      `SELECT enabled, app_id, mch_id FROM t_payment_config WHERE provider = ?`, [provider], tenantId
    );
    return !!row && row.enabled === 1 && !!row.app_id && !!row.mch_id;
  }

  // 测试连接（mock实现）
  static async testConnection(tenantId: string, provider: string) {
    const config = await queryOneWithTenant(
      `SELECT * FROM t_payment_config WHERE provider = ?`, [provider], tenantId
    );
    if (!config) throw new Error('配置不存在');
    // Mock: 模拟测试连接
    return { success: true, message: '连接测试成功', provider };
  }

  // 各渠道配置状态
  static async getStatus(tenantId: string) {
    const rows = await queryWithTenant(
      `SELECT provider, enabled, app_id, updated_at FROM t_payment_config`,
      [],
      tenantId
    );
    return rows;
  }

  // 银行账号列表
  static async listBankAccounts(tenantId: string) {
    return await queryWithTenant(
      `SELECT * FROM t_bank_account WHERE tenant_id = ? ORDER BY is_default DESC, id ASC`, [tenantId], tenantId
    );
  }

  // 添加银行账号
  static async createBankAccount(tenantId: string, data: BankAccountData) {
    const result = await executeWithTenant(
      `INSERT INTO t_bank_account (bank_name, account_no, account_name, bank_branch, is_default, tenant_id) VALUES (?,?,?,?,?,?)`,
      [data.bankName, data.accountNumber, data.accountName, data.remark || '', data.isDefault ? 1 : 0, tenantId],
      tenantId
    );
    return { id: (result as unknown as Record<string, unknown>).insertId };
  }

  // 编辑银行账号
  static async updateBankAccount(tenantId: string, id: number, data: Partial<BankAccountData>) {
    await executeWithTenant(
      `UPDATE t_bank_account SET bank_name=?, account_no=?, account_name=?, bank_branch=?, is_default=?, updated_at=NOW() WHERE id=? AND tenant_id=?`,
      [data.bankName, data.accountNumber, data.accountName, data.remark || '', data.isDefault ? 1 : 0, id, tenantId],
      tenantId
    );
    return { success: true };
  }

  // 删除银行账号
  static async deleteBankAccount(tenantId: string, id: number) {
    await executeWithTenant(
      `DELETE FROM t_bank_account WHERE id=? AND tenant_id=?`, [id, tenantId], tenantId
    );
    return { success: true };
  }

  // 设为默认银行账号
  static async setDefaultBankAccount(tenantId: string, id: number) {
    await executeWithTenant(
      `UPDATE t_bank_account SET is_default=0 WHERE tenant_id=?`, [tenantId], tenantId
    );
    await executeWithTenant(
      `UPDATE t_bank_account SET is_default=1 WHERE id=? AND tenant_id=?`, [id, tenantId], tenantId
    );
    return { success: true };
  }
}