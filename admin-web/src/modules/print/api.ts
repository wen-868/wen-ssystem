/**
 * 打印模块 API 封装（服务端模板管理 + 打印记录上报）
 */
import { api } from "../../api/request";
import type {
  PrintBillType,
  PrintPaperType,
  PrintRecordInput,
  PrintTemplate,
} from "./types";

/** 单据/纸张枚举元数据 */
export interface PrintMeta {
  billTypes: Array<{ value: string; label: string }>;
  paperTypes: Array<{ value: string; label: string }>;
}

/** 获取枚举元数据 */
export async function fetchPrintMeta(): Promise<PrintMeta> {
  const { data } = await api.get("/admin/print/meta");
  return data.data;
}

/** 模板列表（首次访问服务端自动初始化默认模板） */
export async function fetchPrintTemplates(params?: {
  billType?: string;
  paperType?: string;
}): Promise<PrintTemplate[]> {
  const { data } = await api.get("/admin/print/templates", { params });
  return data.data;
}

/** 模板详情 */
export async function fetchPrintTemplate(id: number): Promise<PrintTemplate> {
  const { data } = await api.get(`/admin/print/templates/${id}`);
  return data.data;
}

/** 新建模板 */
export async function createPrintTemplate(payload: {
  billType: PrintBillType;
  paperType: PrintPaperType;
  templateName?: string;
  content?: string;
  status?: number;
}): Promise<{ id: number }> {
  const { data } = await api.post("/admin/print/templates", payload);
  return data.data;
}

/** 更新模板 */
export async function updatePrintTemplate(
  id: number,
  payload: Partial<{
    paperType: PrintPaperType;
    templateName: string;
    content: string;
    status: number;
  }>
): Promise<{ id: number }> {
  const { data } = await api.put(`/admin/print/templates/${id}`, payload);
  return data.data;
}

/** 删除模板 */
export async function deletePrintTemplate(id: number): Promise<{ id: number }> {
  const { data } = await api.delete(`/admin/print/templates/${id}`);
  return data.data;
}

/** 重置为系统默认模板 */
export async function resetPrintTemplate(id: number): Promise<{ id: number }> {
  const { data } = await api.post(`/admin/print/templates/${id}/reset`);
  return data.data;
}

/** 上报打印记录（留痕审计） */
export async function reportPrintRecord(input: PrintRecordInput): Promise<{ id: number }> {
  const { data } = await api.post("/admin/print/records", input);
  return data.data;
}
