import request from '../utils/request'

/**
 * 平台总后台·公告管理接口封装（前缀 /api/platform/announcements，后端要求平台令牌）
 *
 * 来源：
 *   - 既有 6 端点：backend/src/routes/admin-platform-announcement.routes.ts:8-13
 *     （GET / 、GET /:id 、POST / 、PUT /:id 、DELETE /:id 、POST /:id/publish）
 *   - 公告模板 2 端点：同路由（C2-0 新增，注册在 GET /:id 之前，0 DDL 走 t_platform_config）
 *   - 契约：docs/API接口文档.md §公告管理 / §模板中心
 *
 * 口径：状态枚举只有 DRAFT / PUBLISHED 两态（status 走字符串枚举，非数字）；
 * 定时发布 SCHEDULED 与已撤回 RECALLED 为预留状态，后端当前不支持（S3-32），故本模块不提供
 * recall / withdraw 封装，页面也不呈现对应入口。
 */

/** 公告列表 / 详情项 */
export interface AnnouncementItem {
  id: number
  title: string
  type: string
  content: string
  isTop: number
  status: 'DRAFT' | 'PUBLISHED' | string
  publishAt: string
  createdBy: string
  createdAt: string
  updatedAt: string
  /**
   * 以下字段后端当前**不返回**（推送范围 / 渠道无落库列、触达与已读无统计表，
   * 见 C2-0 裁定 §2.3 转 S3-82）。声明为可选：后端补齐后列表即可直接显示，
   * 当前渲染为「-」，不做本地推算。
   */
  subTitle?: string
  scope?: string
  channel?: string
  reach?: string
}

/** 公告模板项（GET/PUT /platform/announcements/templates） */
export interface AnnouncementTemplateItem {
  code: string
  name: string
  content: string
}

/** GET /platform/announcements 查询参数（后端只认 page/pageSize/type/status/keyword） */
export interface AnnouncementListParams {
  page?: number
  pageSize?: number
  type?: string
  status?: 'DRAFT' | 'PUBLISHED'
  keyword?: string
}

/** POST /platform/announcements 请求体 */
export interface AnnouncementCreatePayload {
  title: string
  type: string
  content: string
  isTop?: number
  status?: 'DRAFT' | 'PUBLISHED'
}

/** PUT /platform/announcements/:id 请求体（字段可部分下发） */
export type AnnouncementUpdatePayload = Partial<AnnouncementCreatePayload>

/** 公告列表（分页 + 关键词 + 状态筛选） */
export function listAnnouncementsApi(params: AnnouncementListParams = {}) {
  return request.get('/platform/announcements', { params })
}

/** 公告详情 */
export function getAnnouncementApi(id: number) {
  return request.get(`/platform/announcements/${id}`)
}

/** 新建公告（status=DRAFT 存草稿 / PUBLISHED 直接发布） */
export function createAnnouncementApi(data: AnnouncementCreatePayload) {
  return request.post('/platform/announcements', data)
}

/** 编辑公告 */
export function updateAnnouncementApi(id: number, data: AnnouncementUpdatePayload) {
  return request.put(`/platform/announcements/${id}`, data)
}

/** 删除公告 */
export function deleteAnnouncementApi(id: number) {
  return request.delete(`/platform/announcements/${id}`)
}

/**
 * 发布 / 取消发布（后端为单一开关端点 POST /:id/publish：
 * PUBLISHED ⇒ DRAFT，其它状态 ⇒ PUBLISHED）
 */
export function togglePublishAnnouncementApi(id: number) {
  return request.post(`/platform/announcements/${id}/publish`)
}

/** 公告模板清单（未配置 ⇒ records: []，后端不返回内置默认模板） */
export function listAnnouncementTemplatesApi() {
  return request.get('/platform/announcements/templates')
}

/** 保存公告模板清单（整包覆盖；传 [] 即清空） */
export function saveAnnouncementTemplatesApi(records: AnnouncementTemplateItem[]) {
  return request.put('/platform/announcements/templates', { records })
}
