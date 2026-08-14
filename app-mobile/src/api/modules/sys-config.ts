/**
 * 系统配置 API 封装
 *
 * 后端路由前缀：/api/admin/sys-config（request.ts BASE_URL 已含 /api，此处只需 /admin/sys-config/...）
 * 后端实现：backend/src/routes/sys-config.routes.ts + services/admin/sys-config.service.ts
 * 关联任务：R95-02 功能中心三入口接入真实后端（系统设置）
 *
 * @author 阿澈
 */

import { get, put } from '../request'

// ====================== 类型定义 ======================

/** 系统配置行（后端返回结构，驼峰） */
export interface SysConfigItem {
  id: number
  configKey: string
  configValue: string
  configGroup: string
  description: string
  updatedAt: string | Date
}

/** 系统配置全量结果：all（平铺）+ grouped（按分组） */
export interface SysConfigResult {
  all: SysConfigItem[]
  grouped: Record<string, SysConfigItem[]>
}

/** 批量更新入参（对齐后端 batchUpdateConfigsSchema：数组 [{ config_key, config_value }]） */
export interface SysConfigUpdateItem {
  config_key: string
  config_value: string
}

/** 当前租户公司信息（GET /admin/sys-config/tenant-info） */
export interface TenantInfo {
  companyName: string
  contactPerson: string
  contactMobile: string
  businessLicense: string
}

// ====================== API 封装 ======================

const sysConfigApi = {
  /**
   * 获取全部系统配置（按分组返回）
   * GET /api/admin/sys-config
   *
   * @returns { all, grouped }
   */
  async getAll(): Promise<SysConfigResult> {
    return get('/admin/sys-config')
  },

  /**
   * 获取指定分组配置
   * GET /api/admin/sys-config/:group
   *
   * @param group 分组名
   * @returns 配置列表
   */
  async getByGroup(group: string): Promise<SysConfigItem[]> {
    return get(`/admin/sys-config/${encodeURIComponent(group)}`)
  },

  /**
   * 批量更新配置
   * PUT /api/admin/sys-config/batch
   *
   * @param items 待更新项（config_key + config_value）
   * @returns 更新数量
   */
  async updateBatch(items: SysConfigUpdateItem[]): Promise<{ updated: number }> {
    return put('/admin/sys-config/batch', items)
  },

  /**
   * 获取当前租户公司信息
   * GET /api/admin/sys-config/tenant-info
   *
   * @returns 公司名称/负责人/联系电话/营业执照
   */
  async getTenantInfo(): Promise<TenantInfo | null> {
    return get('/admin/sys-config/tenant-info')
  },
}

export { sysConfigApi }
