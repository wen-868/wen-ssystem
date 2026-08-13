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
  boxConfig?: string;
  enabled?: number | boolean | string;
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
    // 收款盒子配置复用微信配置行的 box_config 字段
    if (provider === 'box') {
      const row = await queryOneWithTenant(
        `SELECT enabled, box_config FROM t_payment_config WHERE provider = 'wechat'`,
        [],
        tenantId
      );
      if (!row) return null;
      let boxData: Record<string, unknown> = {};
      try {
        boxData = row.box_config ? JSON.parse(row.box_config) : {};
      } catch { /* 忽略解析错误 */ }
      return {
        provider: 'box',
        enabled: Number(row.enabled) === 1,
        boxConfig: boxData,
      };
    }
    const row = await queryOneWithTenant(
      `SELECT * FROM t_payment_config WHERE provider = ?`,
      [provider],
      tenantId
    );
    if (!row) return null;
    // 脱敏：返回到前端时脱敏 api_v3_key, private_key, app_secret
    row.api_v3_key = row.api_v3_key ? '***' : '';
    row.api_key = row.api_key ? '***' : '';
    row.private_key = row.private_key ? '***' : '';
    row.app_secret = row.app_secret ? '***' : '';
    return row;
  }

  // 保存渠道配置
  static async saveChannelConfig(tenantId: string, provider: string, data: ChannelConfigData) {
    const enabledFlag = data.enabled === true || data.enabled === 1 || data.enabled === "1" ? 1 : 0;
    // 收款盒子配置保存到微信配置行的 box_config 字段
    if (provider === 'box') {
      await executeWithTenant(
        `UPDATE t_payment_config SET box_config=?, enabled=?, updated_at=NOW() WHERE provider='wechat'`,
        [data.boxConfig || null, enabledFlag],
        tenantId
      );
      return { success: true };
    }
    const existing = await queryOneWithTenant(
      `SELECT id FROM t_payment_config WHERE provider = ?`, [provider], tenantId
    );
    if (existing) {
      await executeWithTenant(
        `UPDATE t_payment_config SET app_id=?, mch_id=?, api_v3_key=?, api_key=?, private_key=?, serial_no=?, notify_url=?, alipay_public_key=?, box_config=?, enabled=?, updated_at=NOW() WHERE provider=?`,
        [data.appId || '', data.mchId || '', data.apiV3Key || '', data.apiKey || '', data.privateKey || '', data.serialNo || '', data.notifyUrl || '', data.alipayPublicKey || '', data.boxConfig || null, enabledFlag, provider],
        tenantId
      );
    } else {
      await executeWithTenant(
        `INSERT INTO t_payment_config (provider, app_id, mch_id, api_v3_key, api_key, private_key, serial_no, notify_url, alipay_public_key, box_config, enabled, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [provider, data.appId || '', data.mchId || '', data.apiV3Key || '', data.apiKey || '', data.privateKey || '', data.serialNo || '', data.notifyUrl || '', data.alipayPublicKey || '', data.boxConfig || null, enabledFlag, tenantId],
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

  // 测试连接：真实校验渠道配置完整性（无模拟数据）
  static async testConnection(tenantId: string, provider: string) {
    if (provider === 'box') {
      const row = await queryOneWithTenant(
        `SELECT enabled, box_config FROM t_payment_config WHERE provider = 'wechat'`,
        [],
        tenantId
      );
      if (!row) throw new Error('配置不存在');
      let boxData: Record<string, unknown> = {};
      try {
        boxData = row.box_config ? JSON.parse(row.box_config) : {};
      } catch { /* 忽略 */ }
      const missing: string[] = [];
      if (Number(row.enabled) !== 1) missing.push('启用开关');
      if (!boxData.provider) missing.push('服务商名称');
      if (!boxData.activationCode && !boxData.comPort) missing.push('激活码或串口参数');
      if (missing.length > 0) {
        return { success: false, message: `配置不完整：缺少 ${missing.join('、')}`, provider: 'box' };
      }
      return { success: true, message: '收款盒子配置校验通过', provider: 'box' };
    }
    const config = await queryOneWithTenant(
      `SELECT * FROM t_payment_config WHERE provider = ?`, [provider], tenantId
    );
    if (!config) throw new Error('配置不存在');
    const enabled = Number(config.enabled) === 1;
    const missing: string[] = [];
    if (!config.app_id) missing.push('AppID');
    if (!config.mch_id) missing.push('商户号');
    if (provider === 'wechat' && !config.api_v3_key) missing.push('API V3 密钥');
    if (provider === 'wechat' && !config.api_key) missing.push('APIv2 密钥（扫码枪反扫必需）');
    if (provider === 'wechat' && !config.private_key) missing.push('商户私钥');
    if (provider === 'alipay' && !config.alipay_public_key) missing.push('支付宝公钥');
    if (!enabled) missing.push('启用开关');
    if (missing.length > 0) {
      return { success: false, message: `配置不完整：缺少 ${missing.join('、')}`, provider };
    }
    return { success: true, message: '配置校验通过', provider };
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
