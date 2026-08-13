/**
 * 收银台硬件设置（localStorage 持久化，每台终端独立）
 *
 * 与打印配置同思路：钱箱/语音等设备相关能力全部本机保存，
 * 不同门店/终端可各自开关。
 */

export interface PosHardwareSettings {
  /** 现金收款成功后自动弹钱箱 */
  cashDrawerEnabled: boolean;
  /** 收款成功语音播报 */
  voiceEnabled: boolean;
  /** 结算弹窗打开后自动聚焦付款码输入框（扫码枪反扫） */
  scanPayAutoFocus: boolean;
}

const STORAGE_KEY = "zx_pos_hardware_v1";

export const DEFAULT_POS_HARDWARE: PosHardwareSettings = {
  cashDrawerEnabled: true,
  voiceEnabled: true,
  scanPayAutoFocus: true,
};

function isPosHardwareSettings(value: unknown): value is PosHardwareSettings {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.cashDrawerEnabled === "boolean" &&
    typeof v.voiceEnabled === "boolean" &&
    typeof v.scanPayAutoFocus === "boolean"
  );
}

/** 读取收银台硬件设置（无/损坏时回退默认） */
export function getPosHardwareSettings(): PosHardwareSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POS_HARDWARE };
    const parsed = JSON.parse(raw) as unknown;
    if (!isPosHardwareSettings(parsed)) return { ...DEFAULT_POS_HARDWARE };
    return { ...DEFAULT_POS_HARDWARE, ...parsed };
  } catch {
    return { ...DEFAULT_POS_HARDWARE };
  }
}

/** 保存收银台硬件设置 */
export function savePosHardwareSettings(settings: PosHardwareSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** 重置为默认 */
export function resetPosHardwareSettings(): PosHardwareSettings {
  const def = { ...DEFAULT_POS_HARDWARE };
  savePosHardwareSettings(def);
  return def;
}
