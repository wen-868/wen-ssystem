/**
 * 短信发送服务（真实短信通道）
 *
 * 配置来源：系统设置 -> 短信配置（t_sys_config）
 *   - sms_provider: aliyun / tencent
 *   - sms_access_key / sms_secret_key / sms_sign_name / sms_sdk_app_id
 *
 * 验证码模板来源：t_sms_template（按 purpose 查询启用的模板 CODE）
 * 验证码记录：t_member_sms_code（purpose 区分业务：REGISTER / TENANT_REGISTER）
 *
 * 注意：不再提供任何模拟/开发降级，配置缺失或发送失败直接抛错。
 */
import { query, queryOne } from "../shared/db";
import { AppError } from "../shared/app-error";
import logger from "../shared/logger";
import Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import tencentcloud from "tencentcloud-sdk-nodejs-sms";

export interface SmsConfig {
  provider: "aliyun" | "tencent" | "";
  accessKey: string;
  secretKey: string;
  signName: string;
  sdkAppId: string;
}

interface ConfigValueRow {
  configValue: string;
}

interface SmsTemplateRow {
  code: string;
}

interface SmsCodeRow {
  id: number;
  used: number;
  expiresAt: string | Date;
}

interface SmsCodeCreatedAtRow {
  createdAt: string | Date;
}

async function getConfigValue(key: string, tenantId: string): Promise<string> {
  const row = await queryOne<ConfigValueRow>(
    "SELECT config_value AS configValue FROM t_sys_config WHERE config_key = ? AND tenant_id = ?",
    [key, tenantId]
  );
  return row?.configValue || "";
}

/** 短信验证开关（总台系统设置-短信配置）：sms_verify_enabled = 1 时注册需验证码 */
export async function isSmsVerifyEnabled(tenantId: string): Promise<boolean> {
  const value = await getConfigValue("sms_verify_enabled", tenantId);
  return value === "1";
}

/** 读取短信配置（系统设置-短信配置） */
export async function getSmsConfig(tenantId: string): Promise<SmsConfig> {
  const [provider, accessKey, secretKey, signName, sdkAppId] = await Promise.all([
    getConfigValue("sms_provider", tenantId),
    getConfigValue("sms_access_key", tenantId),
    getConfigValue("sms_secret_key", tenantId),
    getConfigValue("sms_sign_name", tenantId),
    getConfigValue("sms_sdk_app_id", tenantId),
  ]);
  return {
    provider: (provider as SmsConfig["provider"]) || "",
    accessKey,
    secretKey,
    signName,
    sdkAppId,
  };
}

/** 校验短信配置完整性，缺失直接抛错（不再静默模拟） */
export function assertSmsConfig(cfg: SmsConfig): void {
  if (!cfg.provider) {
    throw new AppError("短信服务未配置，请先在系统设置-短信配置中选择短信服务商", 500);
  }
  if (!cfg.accessKey || !cfg.secretKey) {
    throw new AppError("短信服务 AccessKey 未配置，请先在系统设置-短信配置中填写", 500);
  }
  if (!cfg.signName) {
    throw new AppError("短信签名未配置，请先在系统设置-短信配置中填写短信签名", 500);
  }
  if (cfg.provider === "tencent" && !cfg.sdkAppId) {
    throw new AppError("腾讯云短信需要配置 SdkAppId，请先在系统设置-短信配置中填写", 500);
  }
}

/** 发送短信（真实通道） */
export async function sendSms(params: {
  mobile: string;
  templateCode: string;
  templateParam: Record<string, string>;
  tenantId: string;
}): Promise<{ requestId: string }> {
  const cfg = await getSmsConfig(params.tenantId);
  assertSmsConfig(cfg);

  if (cfg.provider === "aliyun") {
    return sendAliyunSms(cfg, params.mobile, params.templateCode, params.templateParam);
  }
  return sendTencentSms(cfg, params.mobile, params.templateCode, params.templateParam);
}

/** 阿里云短信（Dysmsapi） */
async function sendAliyunSms(
  cfg: SmsConfig,
  mobile: string,
  templateCode: string,
  templateParam: Record<string, string>
): Promise<{ requestId: string }> {
  const client = new Dysmsapi20170525(
    new $OpenApi.Config({
      accessKeyId: cfg.accessKey,
      accessKeySecret: cfg.secretKey,
      endpoint: "dysmsapi.aliyuncs.com",
    })
  );
  const req: any = {
    phoneNumbers: mobile,
    signName: cfg.signName,
    templateCode,
    templateParam: JSON.stringify(templateParam),
  };
  const res: any = await client.sendSmsWithOptions(req, {} as any);
  const body = res?.body;
  if (body?.code !== "OK") {
    logger.error(`[短信] 阿里云发送失败 mobile=${mobile} code=${body?.code} message=${body?.message}`);
    throw new AppError(`阿里云短信发送失败：${body?.message || body?.code || "未知错误"}`, 500);
  }
  return { requestId: body?.requestId || "" };
}

/** 腾讯云短信（SMS v20210111） */
async function sendTencentSms(
  cfg: SmsConfig,
  mobile: string,
  templateCode: string,
  templateParam: Record<string, string>
): Promise<{ requestId: string }> {
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: {
      secretId: cfg.accessKey,
      secretKey: cfg.secretKey,
    },
    region: "ap-guangzhou",
    profile: {
      httpProfile: { endpoint: "sms.tencentcloudapi.com" },
    },
  });
  const params = {
    PhoneNumberSet: [`+86${mobile}`],
    SmsSdkAppId: cfg.sdkAppId,
    SignName: cfg.signName,
    TemplateId: templateCode,
    TemplateParamSet: Object.values(templateParam),
  };
  const res = await client.SendSms(params);
  const status = res.SendStatusSet?.[0];
  if (!status || status.Code !== "Ok") {
    logger.error(`[短信] 腾讯云发送失败 mobile=${mobile} code=${status?.Code} message=${status?.Message}`);
    throw new AppError(`腾讯云短信发送失败：${status?.Message || status?.Code || "未知错误"}`, 500);
  }
  return { requestId: res.RequestId || "" };
}

/** 查询启用的短信模板 CODE（按用途） */
export async function getSmsTemplateCode(purpose: string, tenantId: string): Promise<string> {
  const row = await queryOne<SmsTemplateRow>(
    `SELECT code FROM t_sms_template
     WHERE tenant_id = ? AND purpose = ? AND status = 'ENABLED'
     ORDER BY id DESC LIMIT 1`,
    [tenantId, purpose]
  );
  if (!row?.code) {
    throw new AppError(`短信模板未配置（用途：${purpose}），请先在系统设置-短信配置中新增并启用模板`, 500);
  }
  return row.code;
}

/** 生成并发送验证码（真实短信），60 秒防频、5 分钟过期 */
export async function sendSmsCode(mobile: string, purpose: string, tenantId: string): Promise<{ success: boolean; message: string }> {
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    throw new AppError("手机号格式不正确", 400);
  }

  const recent = await queryOne<SmsCodeCreatedAtRow>(
    `SELECT created_at FROM t_member_sms_code
     WHERE mobile = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`,
    [mobile, purpose]
  );
  if (recent) {
    const created = new Date(recent.createdAt).getTime();
    if (Date.now() - created < 60000) {
      throw new AppError("验证码发送过于频繁，请稍后再试", 400);
    }
  }

  const templateCode = await getSmsTemplateCode(purpose, tenantId);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // 先真实发送，成功后再落库
  await sendSms({
    mobile,
    templateCode,
    templateParam: { code },
    tenantId,
  });

  await query(
    `INSERT INTO t_member_sms_code (mobile, code, purpose, expires_at) VALUES (?, ?, ?, ?)`,
    [mobile, code, purpose, expiresAt]
  );
  logger.info(`[短信验证码] 发送成功 mobile=${mobile} purpose=${purpose} template=${templateCode}`);
  return { success: true, message: "验证码已发送，请查收短信" };
}

/** 校验验证码（存在、未使用、未过期），成功后标记已使用 */
export async function verifySmsCode(mobile: string, code: string, purpose: string, tenantId: string): Promise<void> {
  const row = await queryOne<SmsCodeRow>(
    `SELECT id, used, expires_at FROM t_member_sms_code
     WHERE mobile = ? AND code = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`,
    [mobile, code, purpose]
  );
  if (!row) {
    throw new AppError("验证码错误", 400);
  }
  if (row.used) {
    throw new AppError("验证码已使用", 400);
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new AppError("验证码已过期，请重新获取", 400);
  }
  await query("UPDATE t_member_sms_code SET used = 1 WHERE id = ?", [row.id]);
}
