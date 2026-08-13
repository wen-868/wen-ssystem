/**
 * 串口客户端：经本地打印助手（127.0.0.1:5178）访问 COM 口
 *
 * 客显/电子秤都是客户电脑上的串口设备，必须走本机常驻助手；
 * 未安装助手时返回明确错误，提示先安装「智享打印助手」。
 */
import { getLocalPrintConfig } from "../print/localConfig";

export interface SerialOptions {
  port: string;
  baudRate?: number;
  dataBits?: number;
  parity?: string;
  stopBits?: string;
  timeoutMs?: number;
}

function agentBase(): string {
  return getLocalPrintConfig().agentBaseUrl.replace(/\/+$/, "");
}

/** 本机 COM 口列表 */
export async function listSerialPorts(): Promise<string[]> {
  try {
    const res = await fetch(`${agentBase()}/serial/ports`);
    if (!res.ok) return [];
    const data = (await res.json()) as { ports?: string[] };
    return data.ports || [];
  } catch {
    return [];
  }
}

/** 向 COM 口写入字节（base64 → 十六进制），用于客显/盒子指令 */
export async function serialWrite(opt: SerialOptions & { base64: string }): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${agentBase()}/serial/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opt, writeBase64: opt.base64 }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    return { ok: data.ok !== false, message: data.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "无法连接本地打印助手" };
  }
}

/** 从 COM 口读取数据（line=文本行 / bytes=原始字节 hex） */
export async function serialRead(opt: SerialOptions & { readMode: "line" | "bytes"; bytes?: number }): Promise<{ ok: boolean; output?: string; message?: string }> {
  try {
    const res = await fetch(`${agentBase()}/serial/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opt }),
    });
    const data = (await res.json()) as { ok?: boolean; output?: string; message?: string };
    return { ok: data.ok !== false, output: data.output, message: data.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "无法连接本地打印助手" };
  }
}

/** 写后读（电子秤命令应答协议） */
export async function serialTransaction(opt: SerialOptions & { writeBase64?: string; readMode: "line" | "bytes"; bytes?: number }): Promise<{ ok: boolean; output?: string; message?: string }> {
  try {
    const res = await fetch(`${agentBase()}/serial/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opt }),
    });
    const data = (await res.json()) as { ok?: boolean; output?: string; message?: string };
    return { ok: data.ok !== false, output: data.output, message: data.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "无法连接本地打印助手" };
  }
}
