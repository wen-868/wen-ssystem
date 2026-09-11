/**
 * 平台总后台菜单配置
 * ─────────────────────────────────────────────────────────
 * 依据：R101-S1-00 任务卡第三节 + 改造方案 §D 类「视觉底座与布局差距」
 * 要求：现有 26 个菜单条目按「运营 / 租户 / 计费 / 服务 / 生态 / 系统」六组重排。
 *
 * 口径说明：
 * 1. 条目只做归组重排，不新增、不删除、不改路由 —— 设计稿未列出但代码已有的能力
 *    （注册审核、订阅管理、订阅申请、平台评价、移动端预览等）按改造方案 C 类「保留不删」处理。
 * 2. 改造方案原文「平铺 28 个菜单项（2 个分组 + 26 个条目）」中的 28 = 2 个旧分组 + 26 个条目；
 *    重排后为 6 个分组 + 26 个条目，条目数保持不变。
 */

import type { Component } from 'vue'
import {
  DataAnalysis,
  ChatDotSquare,
  Star,
  Check,
  OfficeBuilding,
  DataLine,
  CreditCard,
  Tickets,
  Box,
  Money,
  Cpu,
  User,
  Monitor,
  Document,
  WarningFilled,
  Promotion,
  Goods,
  Cellphone,
  Setting,
  Message,
} from '@element-plus/icons-vue'

export interface PlatformMenuItem {
  /** 菜单标题 */
  title: string
  /** 路由路径（与 router/index.ts 保持一致） */
  path: string
  /** 图标组件 */
  icon: Component
}

export interface PlatformMenuGroup {
  /** 分组名 */
  group: string
  items: PlatformMenuItem[]
}

export const platformMenus: PlatformMenuGroup[] = [
  {
    group: '运营',
    items: [
      { title: '平台看板', path: '/dashboard', icon: DataAnalysis },
      { title: '平台公告', path: '/announcements', icon: ChatDotSquare },
      { title: '平台评价', path: '/reviews', icon: Star },
    ],
  },
  {
    group: '租户',
    items: [
      { title: '注册审核', path: '/applications', icon: Check },
      { title: '租户管理', path: '/tenants', icon: OfficeBuilding },
      { title: '租户使用统计', path: '/tenant-usage', icon: DataLine },
      { title: '订阅管理', path: '/subscriptions', icon: CreditCard },
      { title: '订阅申请', path: '/subscription-applies', icon: Tickets },
    ],
  },
  {
    group: '计费',
    items: [
      { title: '套餐管理', path: '/packages', icon: Box },
      { title: '财务结算', path: '/reconciliation', icon: Money },
      { title: 'AI 平台默认', path: '/ai-config/platform', icon: Cpu },
      { title: 'AI 租户配置', path: '/ai-config/tenants', icon: User },
      { title: 'AI 用量统计', path: '/ai-config/usage', icon: DataLine },
      { title: 'AI 计费套餐', path: '/ai-config/billing', icon: Money },
    ],
  },
  {
    group: '服务',
    items: [
      { title: '系统监控', path: '/monitor', icon: Monitor },
      { title: '操作日志', path: '/audit-logs', icon: Document },
      { title: '错误日志', path: '/error-logs', icon: WarningFilled },
      { title: '版本发布', path: '/app-versions', icon: Promotion },
    ],
  },
  {
    group: '生态',
    items: [
      { title: '商品库 · SPU 管理', path: '/library/spus', icon: Goods },
      { title: '商品库 · 品牌管理', path: '/library/brands', icon: Goods },
      { title: '商品库 · 审核列表', path: '/library/reviews', icon: Goods },
      { title: '商品库 · 批量导入', path: '/library/import', icon: Goods },
      { title: '商品库 · API 密钥', path: '/library/api-keys', icon: Goods },
      { title: '移动端预览', path: '/mobile-preview', icon: Cellphone },
    ],
  },
  {
    group: '系统',
    items: [
      { title: '平台配置', path: '/settings', icon: Setting },
      { title: '消息配置', path: '/message-config', icon: Message },
    ],
  },
]

/** 全部条目标题 → 路径的扁平映射，供面包屑等处复用 */
export function findMenuTitleByPath(path: string): { group: string; title: string } | null {
  for (const g of platformMenus) {
    const hit = g.items.find((i) => i.path === path)
    if (hit) return { group: g.group, title: hit.title }
  }
  return null
}
