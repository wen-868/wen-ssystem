import { api } from "./request";

export type WorkbenchSettingsScope = "tenant" | "me";
export type WorkbenchSettingValue = string | number | boolean | null;
export type WorkbenchSettingsValues = Record<string, WorkbenchSettingValue>;

export interface WorkbenchSettingsSnapshot {
  version: number;
  revision: number;
  updatedAt: string | null;
  values: WorkbenchSettingsValues;
  changedKeys?: string[];
  resetKeys?: string[];
  auditLogId?: number;
}

export async function fetchWorkbenchSettings(scope: WorkbenchSettingsScope): Promise<WorkbenchSettingsSnapshot> {
  const { data } = await api.get(`/admin/workbench-settings/${scope}`);
  return data.data;
}

export async function saveWorkbenchSettings(
  scope: WorkbenchSettingsScope,
  settings: WorkbenchSettingsValues,
  baseRevision?: number | null,
): Promise<WorkbenchSettingsSnapshot> {
  const { data } = await api.put(`/admin/workbench-settings/${scope}`, { settings, baseRevision });
  return data.data;
}

export async function resetWorkbenchSettings(
  scope: WorkbenchSettingsScope,
  options: { keys?: string[]; baseRevision?: number | null } = {},
): Promise<WorkbenchSettingsSnapshot> {
  const { data } = await api.post(`/admin/workbench-settings/${scope}/reset`, options);
  return data.data;
}

export async function fetchWorkbenchSettingsAudit(params: {
  page?: number;
  pageSize?: number;
  dateStart?: string;
  dateEnd?: string;
} = {}) {
  const { data } = await api.get("/admin/system/audit-logs", {
    params: {
      page: 1,
      pageSize: 20,
      resourceType: "workbench_settings",
      ...params,
    },
  });
  return data.data;
}
