import request from '../utils/request'

/**
 * 平台总后台·模板中心接口封装（前缀 /api/platform/templates，后端要求平台令牌）
 *
 * 来源：C2-0 已合并后端（main 20fa3b29c）
 *   - 路由：backend/src/routes/platform-templates.routes.ts（routeConfig.auth = requirePlatformAuth）
 *   - 控制器：backend/src/controllers/platform/platform-template.controller.ts（#1~#10）
 *   - 契约：docs/API接口文档.md「模板中心（平台总后台，前缀 /api/platform/templates，C2-0 新增）」
 *
 * 口径：统一响应信封 { code, msg, data, traceId }；请求层（utils/request.ts）已按业务码
 * 拦截失败并给中文提示，故本模块只负责路径与参数，不做二次包封。
 * 空态契约：无数据时后端返回 { records: [], total: 0 }，前端按空态渲染，不造数据。
 */

/** 「将复制的配置」条目（configJson.copyConfigs 元素） */
export interface CopyConfigItem {
  label: string
  public: boolean
}

/** GET /api/platform/templates/init 列表项 */
export interface InitTemplateItem {
  id: number
  code: string
  name: string
  applicable: string
  codeRule: string
  convertRule: string
  printRef: string
  defaultWhAccount: string
  configJson: Record<string, unknown> | null
  copyConfigs: CopyConfigItem[]
  freeAvailable: boolean
  recommended: boolean
  version: number
  refCount: number
  status: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** GET /api/platform/templates/init/:id/versions 版本记录项 */
export interface InitTemplateVersionItem {
  id: number
  templateId: number
  version: number
  configJson: Record<string, unknown> | null
  copyConfigs: CopyConfigItem[]
  changeNote: string | null
  createdBy: string | null
  createdAt: string
}

/** GET /api/platform/templates/print 列表项（公共打印模板） */
export interface PrintTemplateItem {
  id: number
  name: string
  billType: string
  paperType: string
  spec: string
  content: string | null
  public: boolean
  version: number
  status: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** GET /api/platform/templates/import-export 列表项 */
export interface IoTemplateItem {
  id: number
  name: string
  direction: string
  version: string
  fieldCount: number
  compat: string
  fieldDesc: string | null
  fileName: string | null
  hasFile: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** POST /api/platform/templates/init 请求体 */
export interface InitTemplateCreatePayload {
  code: string
  name: string
  applicable?: string
  codeRule?: string
  convertRule?: string
  printRef?: string
  defaultWhAccount?: string
  configJson?: Record<string, unknown>
  freeAvailable?: boolean | number
  recommended?: boolean | number
  changeNote?: string
}

/** PUT /api/platform/templates/init/:id 请求体（字段全集可部分下发，另可传 status 0/1） */
export type InitTemplateUpdatePayload = Partial<InitTemplateCreatePayload> & { status?: number }

/** POST /api/platform/templates/print/upload 请求体 */
export interface PrintTemplateUploadPayload {
  name: string
  billType: string
  content: string
  paperType?: string
  spec?: string
}

/** POST /api/platform/templates/import-export 请求体 */
export interface IoTemplateCreatePayload {
  name: string
  direction: 'IMPORT' | 'EXPORT'
  version?: string
  fieldCount?: number
  compat?: string
  fieldDesc?: string
  fileName?: string
  fileContent?: string
}

/** #1 初始化模板列表 */
export function listInitTemplatesApi() {
  return request.get('/platform/templates/init')
}

/** #2 新建初始化模板（后端写入 version=1 版本快照） */
export function createInitTemplateApi(data: InitTemplateCreatePayload) {
  return request.post('/platform/templates/init', data)
}

/** #3 编辑初始化模板（后端 version+1 并写入版本快照） */
export function updateInitTemplateApi(id: number, data: InitTemplateUpdatePayload) {
  return request.put(`/platform/templates/init/${id}`, data)
}

/** #4 初始化模板版本记录 */
export function listInitTemplateVersionsApi(id: number) {
  return request.get(`/platform/templates/init/${id}/versions`)
}

/** #5 公共打印模板列表（billType 不传/空串 ⇒ 全部） */
export function listPrintTemplatesApi(params?: { billType?: string }) {
  return request.get('/platform/templates/print', { params: params?.billType ? { billType: params.billType } : {} })
}

/** #6 上传（新建）公共打印模板 */
export function uploadPrintTemplateApi(data: PrintTemplateUploadPayload) {
  return request.post('/platform/templates/print/upload', data)
}

/** #7 设为公共模板（后端幂等） */
export function setPrintTemplatePublicApi(id: number) {
  return request.post(`/platform/templates/print/${id}/public`)
}

/** #8 导入 / 导出模板清单（direction 不传/空串 ⇒ 全部） */
export function listIoTemplatesApi(params?: { direction?: string }) {
  return request.get('/platform/templates/import-export', {
    params: params?.direction ? { direction: params.direction } : {},
  })
}

/** #9 新增导入 / 导出模板（列表与下载端点的数据来源） */
export function createIoTemplateApi(data: IoTemplateCreatePayload) {
  return request.post('/platform/templates/import-export', data)
}

/**
 * #10 模板文件下载
 * 该端点返回原始文件流（不走 { code, msg, data } 信封），故取 blob；
 * 模板无 file_content 时后端返回 404，由请求层统一中文提示。
 */
export function downloadIoTemplateApi(id: number) {
  return request.get(`/platform/templates/import-export/${id}/download`, { responseType: 'blob' })
}
