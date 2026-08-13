/**
 * 电子秤串口解析
 *
 * 协议：
 * - CONTINUOUS：秤持续输出 ASCII（如 "ST,GS,+0012.345kg" / "       +   12.34kg"）
 * - COMMAND：发命令（如 W/CR、ENQ 0x05）后读一行应答
 */
import { serialRead, serialTransaction } from "./serialClient";

export type ScaleProtocol = "CONTINUOUS" | "COMMAND";

/** 从串口文本解析重量（克自动转千克），解析失败返回 null */
export function parseWeight(raw: string): number | null {
  if (!raw) return null;
  // 匹配如 +0012.345kg / 12.34kg / + 123.4 g（忽略前导空格）
  const m = raw.match(/[+-]?\s*\d{1,5}\.\d{1,3}\s*(kg|g|Kg|KG)?/i);
  if (!m) return null;
  const numberPart = m[0].replace(/[^\d.\-+]/g, "");
  const weight = Number(numberPart);
  if (!Number.isFinite(weight)) return null;
  const unit = (m[1] || "").toLowerCase();
  return unit === "g" ? weight / 1000 : weight;
}

/** 读取电子秤重量 */
export async function readScaleWeight(opts: {
  port: string;
  baudRate?: number;
  protocol: ScaleProtocol;
  commandHex?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; weight?: number; raw?: string; message?: string }> {
  if (!opts.port) return { ok: false, message: "未配置电子秤 COM 口" };
  try {
    if (opts.protocol === "COMMAND") {
      const res = await serialTransaction({
        port: opts.port,
        baudRate: opts.baudRate || 9600,
        writeBase64: opts.commandHex || "",
        readMode: "line",
        timeoutMs: opts.timeoutMs || 3000,
      });
      if (!res.ok || !res.output) return { ok: false, message: res.message || "电子秤无应答" };
      const weight = parseWeight(res.output);
      return weight !== null
        ? { ok: true, weight, raw: res.output }
        : { ok: false, message: `无法解析重量：${res.output}`, raw: res.output };
    }
    const res = await serialRead({
      port: opts.port,
      baudRate: opts.baudRate || 9600,
      readMode: "line",
      timeoutMs: opts.timeoutMs || 3000,
    });
    if (!res.ok || !res.output) return { ok: false, message: res.message || "电子秤无数据" };
    const weight = parseWeight(res.output);
    return weight !== null
      ? { ok: true, weight, raw: res.output }
      : { ok: false, message: `无法解析重量：${res.output}`, raw: res.output };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "读取电子秤失败" };
  }
}
