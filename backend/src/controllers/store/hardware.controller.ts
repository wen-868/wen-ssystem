import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { HardwareConfigService, HARDWARE_CATEGORIES } from "../../services/hardware/hardware-config.service";
import * as cloudSpeaker from "../../services/hardware/cloud-speaker.service";
import * as paymentBox from "../../services/hardware/payment-box.service";
import * as unionpay from "../../services/hardware/unionpay.service";

const categorySchema = z.enum(HARDWARE_CATEGORIES);

/** 硬件配置列表（脱敏） */
export const listHardwareConfigs = asyncHandler(async (req, res) => {
  const data = await HardwareConfigService.listConfigs(req.tenantId!);
  res.json(ok(data));
});

/** 保存硬件配置 */
export const saveHardwareConfig = asyncHandler(async (req, res) => {
  const category = categorySchema.parse(req.params.category);
  const body = z.object({
    config: z.record(z.unknown()),
    enabled: z.boolean().default(true),
  }).parse(req.body);
  const data = await HardwareConfigService.saveConfig(req.tenantId!, category, body.config, body.enabled);
  res.json(ok(data));
});

/** 测试配置完整性 */
export const testHardwareConfig = asyncHandler(async (req, res) => {
  const category = categorySchema.parse(req.params.category);
  const { enabled, config } = await HardwareConfigService.getRawConfig(req.tenantId!, category);
  const missing: string[] = [];
  if (!enabled) missing.push("启用开关");
  if (category === "cloud_speaker") {
    if (!config.apiUrl) missing.push("播报接口地址 apiUrl");
  } else if (category === "unionpay") {
    if (!config.gatewayUrl) missing.push("网关地址 gatewayUrl");
    if (!config.mchId) missing.push("商户号 mchId");
    if (!config.apiKey) missing.push("密钥 apiKey");
  } else if (category === "customer_display") {
    if (!config.port) missing.push("串口 port");
  } else if (category === "scale") {
    if (!config.port) missing.push("串口 port");
  }
  if (missing.length > 0) {
    res.json(ok({ success: false, category, message: `配置不完整：缺少 ${missing.join('、')}` }));
    return;
  }
  res.json(ok({ success: true, category, message: "配置校验通过" }));
});

/** 云喇叭播报（收款成功后调用） */
export const announceCloudSpeaker = asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().min(1),
    channel: z.string().default("SALE"),
  }).parse(req.body);
  const data = await cloudSpeaker.announce({
    tenantId: req.tenantId!,
    amount: body.amount,
    orderNo: body.orderNo,
    channel: body.channel,
  });
  res.json(ok(data));
});

/** 收款盒子支付（HTTP 下发或串口指令返回） */
export const createBoxPay = asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().min(1),
    subject: z.string().default("销售收款"),
  }).parse(req.body);
  const data = await paymentBox.createBoxPayment({
    tenantId: req.tenantId!,
    amount: body.amount,
    orderNo: body.orderNo,
    subject: body.subject,
  });
  res.json(ok(data));
});

/** 收银台读取收款盒子配置（脱敏） */
export const getBoxConfig = asyncHandler(async (req, res) => {
  const data = await paymentBox.getBoxConfigPublic(req.tenantId!);
  res.json(ok(data));
});

/** 收银台保存收款盒子配置 */
export const saveBoxConfig = asyncHandler(async (req, res) => {
  const body = z.object({
    config: z.record(z.unknown()),
    enabled: z.boolean().default(true),
  }).parse(req.body);
  const data = await paymentBox.saveBoxConfig(req.tenantId!, body.config as paymentBox.BoxConfig, body.enabled);
  res.json(ok(data));
});

/** 收款盒子配置测试 */
export const testBoxConfig = asyncHandler(async (req, res) => {
  const { enabled, config } = await paymentBox.getBoxConfigPublic(req.tenantId!);
  const missing: string[] = [];
  if (!enabled) missing.push("启用开关");
  if (!config.apiUrl && !config.comPort) missing.push("HTTP 接口地址或串口参数");
  if (config.apiUrl && !config.activationCode) missing.push("激活码");
  res.json(ok({
    success: missing.length === 0,
    message: missing.length === 0 ? "收款盒子配置校验通过" : `配置不完整：缺少 ${missing.join('、')}`,
  }));
});

/** 云闪付配置测试：以 1 分钱探活（网关需支持 QUERY 类型） */
export const testUnionpay = asyncHandler(async (req, res) => {
  const result = await unionpay.isOrderPaid(req.tenantId!, `TEST${Date.now()}`);
  res.json(ok({ success: result, message: result ? "云闪付网关连通" : "云闪付网关未连通或未配置" }));
});

/** 云喇叭回调（服务商播报确认，外部调用无需登录） */
export const cloudSpeakerCallback = asyncHandler(async (req, res) => {
  const tenantId = String(req.params.tenantId || "");
  const data = await cloudSpeaker.handleCallback(tenantId, req.body);
  res.json(ok(data));
});

/** 收款盒子回调（顾客扫码支付结果，外部调用无需登录） */
export const boxCallback = asyncHandler(async (req, res) => {
  const tenantId = String(req.params.tenantId || "");
  const body = z.record(z.unknown()).parse(req.body ?? {});
  const data = await paymentBox.handleBoxCallback({ tenantId, body });
  res.json(ok(data));
});
