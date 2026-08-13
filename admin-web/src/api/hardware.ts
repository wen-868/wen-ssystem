/**
 * 收银硬件 API（租户级配置 + 云端设备通道）
 * 客显/电子秤串口参数为本机配置（localStorage），不走此接口。
 */
import { api } from "./request";

/** 硬件配置列表（脱敏） */
export async function fetchHardwareConfigs() {
  const { data } = await api.get("/store/hardware/configs");
  return data.data as any[];
}

/** 保存硬件配置 */
export async function saveHardwareConfig(category: string, config: Record<string, unknown>, enabled: boolean) {
  const { data } = await api.put(`/store/hardware/configs/${category}`, { config, enabled });
  return data.data;
}

/** 测试配置完整性 */
export async function testHardwareConfig(category: string) {
  const { data } = await api.post(`/store/hardware/configs/${category}/test`);
  return data.data;
}

/** 收款盒子配置（存于 t_payment_config.box_config） */
export async function fetchBoxConfig() {
  const { data } = await api.get("/store/hardware/box-config");
  return data.data;
}

export async function saveBoxConfig(config: Record<string, unknown>, enabled: boolean) {
  const { data } = await api.put("/store/hardware/box-config", { config, enabled });
  return data.data;
}

export async function testBoxConfig() {
  const { data } = await api.post("/store/hardware/box-config/test");
  return data.data;
}

/** 云喇叭播报 */
export async function announceCloudSpeaker(params: { amount: number; orderNo: string; channel?: string }) {
  const { data } = await api.post("/store/hardware/cloud-speaker/announce", params);
  return data.data;
}

/** 收款盒子发起支付 */
export async function createBoxPay(params: { amount: number; orderNo: string; subject?: string }) {
  const { data } = await api.post("/store/hardware/box/pay", params);
  return data.data;
}

/** 云闪付网关探活 */
export async function testUnionpay() {
  const { data } = await api.post("/store/hardware/unionpay/test");
  return data.data;
}
