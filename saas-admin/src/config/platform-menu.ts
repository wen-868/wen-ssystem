/**
 * 平台总后台菜单配置
 * ─────────────────────────────────────────────────────────
 * 依据：设计稿 v1.6 侧边栏脚本定义（docs/智享全链_总后台UI设计稿_v1.6.html 第 2568 行 NAVS）
 *   var NAVS=[["概览",[["dashboard","运营大盘"]]],
 *             ["租户",[["tenant","租户管理"],["plan","套餐管理"],["bill","账单计费"]]],
 *             ["营销",[["market","渠道推广"],["agent","代理商管理"],["goods","商品库"],
 *                      ["coupon","优惠码"],["clue","招商线索"]]],
 *             ["平台",[["admin","管理员权限"],["config","系统配置"],["tpl","模板中心"]]],
 *             ["AI 中心",[["aim","模型接入"],["aib","计费管理"],["aiu","用量监控"]]],
 *             ["运维",[["ops","监控告警"],["log","日志中心"],["ntc","公告管理"],
 *                      ["tkt","工单系统"],["rel","版本发布"]]],
 *             ["开放平台",[["apikey","API 密钥"],["webhook","Webhook"]]]];
 *
 * 口径：7 组 22 项，分组名与条目名逐字对齐设计稿，不增删、不重命名。
 * 说明：设计稿侧边栏含「优惠码 / 招商线索」两项，但设计稿 17 个板块中无对应界面规范
 *      （06 营销板块仅含「渠道推广」），故标记 pending，待设计稿补充规范后再实现。
 */

import type { Component } from 'vue'
import {
  DataAnalysis,
  OfficeBuilding,
  Box,
  Money,
  Promotion,
  UserFilled,
  Goods,
  Discount,
  TrendCharts,
  Lock,
  Setting,
  Files,
  Cpu,
  Wallet,
  DataLine,
  Monitor,
  Document,
  ChatDotSquare,
  Tickets,
  UploadFilled,
  Key,
  Link,
} from '@element-plus/icons-vue'

export interface PlatformMenuItem {
  /** 菜单标题（与设计稿 NAVS 逐字一致） */
  title: string
  /** 路由路径（与 router/index.ts 保持一致） */
  path: string
  /** 图标组件 */
  icon: Component
  /** 设计稿有菜单项但无界面规范 / 页面尚未实现时为 true */
  pending?: boolean
}

export interface PlatformMenuGroup {
  /** 分组名（与设计稿 NAVS 逐字一致） */
  group: string
  items: PlatformMenuItem[]
}

export const platformMenus: PlatformMenuGroup[] = [
  {
    group: '概览',
    items: [{ title: '运营大盘', path: '/dashboard', icon: DataAnalysis }],
  },
  {
    group: '租户',
    items: [
      { title: '租户管理', path: '/tenants', icon: OfficeBuilding },
      { title: '套餐管理', path: '/packages', icon: Box },
      { title: '账单计费', path: '/reconciliation', icon: Money },
    ],
  },
  {
    group: '营销',
    items: [
      { title: '渠道推广', path: '/marketing/channels', icon: Promotion },
      { title: '代理商管理', path: '/marketing/agents', icon: UserFilled },
      { title: '商品库', path: '/library/spus', icon: Goods },
      { title: '优惠码', path: '/marketing/coupons', icon: Discount, pending: true },
      { title: '招商线索', path: '/marketing/leads', icon: TrendCharts, pending: true },
    ],
  },
  {
    group: '平台',
    items: [
      { title: '管理员权限', path: '/platform/admins', icon: Lock },
      { title: '系统配置', path: '/settings', icon: Setting },
      { title: '模板中心', path: '/platform/templates', icon: Files },
    ],
  },
  {
    group: 'AI 中心',
    items: [
      { title: '模型接入', path: '/ai-config/platform', icon: Cpu },
      { title: '计费管理', path: '/ai-config/billing', icon: Wallet },
      { title: '用量监控', path: '/ai-config/usage', icon: DataLine },
    ],
  },
  {
    group: '运维',
    items: [
      { title: '监控告警', path: '/monitor', icon: Monitor },
      { title: '日志中心', path: '/audit-logs', icon: Document },
      { title: '公告管理', path: '/announcements', icon: ChatDotSquare },
      { title: '工单系统', path: '/ops/tickets', icon: Tickets },
      { title: '版本发布', path: '/app-versions', icon: UploadFilled },
    ],
  },
  {
    group: '开放平台',
    items: [
      { title: 'API 密钥', path: '/open/api-keys', icon: Key },
      { title: 'Webhook', path: '/open/webhooks', icon: Link },
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
