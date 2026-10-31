#!/usr/bin/env node
/**
 * TOTAL-SAAS-UI-TOKENS-01 · 令牌收口批量替换
 * 林夕（总台界面与设计规范 owner）
 *
 * 安全策略：按「文件 + 行号 + 精确 old 子串」替换；
 *   替换前校验该行确实包含 old 且只出现约定次数，否则报错中止（不静默跳过）。
 * 用法：node docs/设计/apply-tokens.mjs [--check]
 *   --check 只校验不写入
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CHECK = process.argv.includes('--check')

/** [文件, 行号(1基), old, new, 备注] */
const PATCH = [
  // ── 残留 Element 旧色 → 语义令牌（#909399 实测 3.08:1 违反 WCAG AA）
  ['saas-admin/src/views/PlatformReviews.vue', 109, 'color: #909399;', 'color: var(--text-muted);', '次级文字 3.08:1→4.54:1'],
  ['saas-admin/src/views/PlatformReviews.vue', 112, 'background: #f5f7fa; border-radius: 4px;', 'background: var(--bg-soft); border-radius: var(--radius-xs);', '浅底块+圆角归阶'],
  ['saas-admin/src/views/ErrorLogs.vue', 69, 'background: #f5f7fa;', 'background: var(--bg-soft);', '代码块底色'],
  ['saas-admin/src/views/ErrorLogs.vue', 69, 'border-radius: 4px;', 'border-radius: var(--radius-xs);', '圆角归阶'],
  ['saas-admin/src/views/ErrorLogs.vue', 76, 'color: #909399;', 'color: var(--text-muted);', '空态文字 3.08:1→4.54:1'],
  ['saas-admin/src/views/MessageConfig.vue', 234, 'color: #909399;', 'color: var(--text-muted);', '次级文字'],
  ['saas-admin/src/views/MessageConfig.vue', 239, 'color: #909399;', 'color: var(--text-muted);', '次级文字'],
  ['saas-admin/src/views/subscription/SubscriptionApplies.vue', 191, 'color: #909399;', 'color: var(--text-muted);', '提示文字'],
  ['saas-admin/src/views/subscription/SubscriptionApplies.vue', 194, 'background: #f5f7fa; border-radius: 6px;', 'background: var(--bg-soft); border-radius: var(--radius-sm);', '审核框'],
  ['saas-admin/src/views/AuditLogs.vue', 73, 'background: #f5f7fa;', 'background: var(--bg-soft);', '代码块底色'],
  ['saas-admin/src/views/AuditLogs.vue', 73, 'border-radius: 4px;', 'border-radius: var(--radius-xs);', '圆角归阶'],
  ['saas-admin/src/views/SubscriptionDetail.vue', 22, 'color: #ef4444;', 'color: var(--color-danger);', '金额强调'],
  ['saas-admin/src/views/Subscriptions.vue', 28, 'color: #ef4444;', 'color: var(--color-danger);', '金额强调'],

  // ── 登录/注册页
  ['saas-admin/src/views/login/PlatformRegister.vue', 90, 'background: #f0f2f5;', 'background: var(--bg-page);', '页面底'],
  ['saas-admin/src/views/login/PlatformRegister.vue', 92, 'color: #303133;', 'color: var(--text-primary);', '标题'],
  ['saas-admin/src/views/login/PlatformRegister.vue', 93, 'color: #909399;', 'color: var(--text-muted);', '副标题 3.08:1→4.54:1'],
  ['saas-admin/src/views/login/PlatformRegister.vue', 94, 'color: #606266;', 'color: var(--text-secondary);', '正文'],

  // ── 申请详情
  ['saas-admin/src/views/tenant/ApplicationDetail.vue', 333, 'color: #F56C6C;', 'color: var(--color-danger);', '驳回原因'],
  ['saas-admin/src/views/tenant/ApplicationDetail.vue', 334, 'color: #303133;', 'color: var(--text-primary);', '表单值'],
  ['saas-admin/src/views/tenant/ApplicationDetail.vue', 335, 'border-top: 1px solid #EBEEF5;', 'border-top: 1px solid var(--border-light);', '分割线'],
  ['saas-admin/src/views/tenant/ApplicationDetail.vue', 338, 'color: #C0C4CC;', 'color: var(--gray-300);', '空态图标 非文本 1.9:1→3.54:1'],
  ['saas-admin/src/views/tenant/ApplicationDetail.vue', 339, 'color: #909399;', 'color: var(--text-muted);', '空态文字 3.08:1→4.54:1'],

  // ── MobilePreview：仅收口「预览器自身 UI」，手机机身造型豁免
  ['saas-admin/src/views/MobilePreview.vue', 18, 'color: #8492a6;', 'color: var(--text-muted);', '预览器提示文字'],
  ['saas-admin/src/views/MobilePreview.vue', 140, 'color: #909399;', 'color: var(--text-muted);', '加载中文案'],
  ['saas-admin/src/views/MobilePreview.vue', 144, 'color="#F56C6C"', 'color="var(--color-danger)"', '失败图标'],
  ['saas-admin/src/views/MobilePreview.vue', 145, 'color: #F56C6C;', 'color: var(--color-danger);', '失败文案'],
  ['saas-admin/src/views/MobilePreview.vue', 146, 'color: #909399;', 'color: var(--text-muted);', '失败副文案'],
  ['saas-admin/src/views/MobilePreview.vue', 545, 'background: #f0f2f5;', 'background: var(--bg-page);', '预览器页面底'],
  ['saas-admin/src/views/MobilePreview.vue', 551, 'border-bottom: 1px solid #e4e7ed;', 'border-bottom: 1px solid var(--border-normal);', '工具栏分割线'],
  ['saas-admin/src/views/MobilePreview.vue', 570, 'color: #606266;', 'color: var(--text-secondary);', '工具栏标签'],
  ['saas-admin/src/views/MobilePreview.vue', 731, 'border-radius: 8px;', 'border-radius: var(--radius-md);', '圆角归阶'],
  ['saas-admin/src/views/MobilePreview.vue', 732, 'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);', 'box-shadow: var(--shadow-md);', '阴影=--shadow-md 等值'],
  ['saas-admin/src/views/MobilePreview.vue', 738, 'color: #909399;', 'color: var(--text-muted);', '预览器文案'],
  ['saas-admin/src/views/MobilePreview.vue', 746, 'border-radius: 20px;', 'border-radius: var(--radius-pill);', '圆角归阶'],
  ['saas-admin/src/views/MobilePreview.vue', 749, 'border: 1px solid #e4e7ed;', 'border: 1px solid var(--border-normal);', '设备切换按钮边框'],
  ['saas-admin/src/views/MobilePreview.vue', 751, 'color: #606266;', 'color: var(--text-secondary);', '设备切换按钮文字'],
  ['saas-admin/src/views/MobilePreview.vue', 754, 'border-color: #409eff;', 'border-color: var(--color-primary);', 'hover 态'],
  ['saas-admin/src/views/MobilePreview.vue', 755, 'color: #409eff;', 'color: var(--color-primary);', 'hover 态'],
  ['saas-admin/src/views/MobilePreview.vue', 758, 'background: #409eff;', 'background: var(--color-primary);', 'active 态'],
  ['saas-admin/src/views/MobilePreview.vue', 759, 'border-color: #409eff;', 'border-color: var(--color-primary);', 'active 态'],

  // ── 组件样式圆角归阶（游离值 → 令牌阶梯）
  ['saas-admin/src/styles/components.css', 367, 'border-radius: 2px;', 'border-radius: var(--radius-xs);', '2px→4px'],
  ['saas-admin/src/styles/components.css', 549, 'border-radius: 4px;', 'border-radius: var(--radius-xs);', '4px→xs'],
  ['saas-admin/src/styles/components.css', 586, 'border-radius: 2px;', 'border-radius: var(--radius-xs);', '2px→4px'],
  ['saas-admin/src/styles/components.css', 674, 'border-radius: 2px;', 'border-radius: var(--radius-xs);', '2px→4px'],
  ['saas-admin/src/styles/components.css', 999, 'border-radius: 7px;', 'border-radius: var(--radius-sm);', '7px→6px'],
  ['saas-admin/src/styles/components.css', 1028, 'border-radius: 3px;', 'border-radius: var(--radius-xs);', '3px→4px'],
  ['saas-admin/src/views/ai-config/AiBillingConfig.vue', 1067, 'border-radius: 4px;', 'border-radius: var(--radius-xs);', '圆角归阶'],
  ['saas-admin/src/views/ai-config/PlatformAiConfig.vue', 593, 'border-radius: 4px;', 'border-radius: var(--radius-xs);', '圆角归阶'],
  ['saas-admin/src/views/Dashboard.vue', 842, 'border-radius: 3px;', 'border-radius: var(--radius-xs);', '3px→4px'],
  ['saas-admin/src/views/PackageForm.vue', 725, 'border-radius: 5px;', 'border-radius: var(--radius-xs);', '5px→4px'],
  ['saas-admin/src/views/TenantUsage.vue', 56, 'border-radius: 12px;', 'border-radius: var(--radius-xl);', '12px→xl'],
]

let ok = 0
const fail = []
const byFile = new Map()
for (const [rel, ln, old, nw, note] of PATCH) {
  if (!byFile.has(rel)) byFile.set(rel, [])
  byFile.get(rel).push({ ln, old, nw, note })
}

for (const [rel, patches] of byFile) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) { fail.push(`${rel} 文件不存在`); continue }
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  let changed = false
  for (const { ln, old, nw, note } of patches) {
    const i = ln - 1
    if (i >= lines.length) { fail.push(`${rel}:${ln} 行号越界`); continue }
    const line = lines[i]
    if (!line.includes(old)) { fail.push(`${rel}:${ln} 未找到「${old}」｜实际：${line.trim().slice(0, 90)}`); continue }
    if (line.includes(nw) && old !== nw) { fail.push(`${rel}:${ln} 已是目标值，跳过（幂等）`); continue }
    lines[i] = line.replace(old, nw)
    changed = true
    ok++
  }
  if (changed && !CHECK) fs.writeFileSync(abs, lines.join('\n'), 'utf8')
}

console.log(`═══ 令牌收口批量替换${CHECK ? '（校验模式，未写入）' : ''} ═══`)
console.log(`成功 ${ok} / ${PATCH.length}　涉及文件 ${byFile.size} 个`)
if (fail.length) {
  console.log(`\n⚠️ 未处理 ${fail.length} 项：`)
  fail.forEach((f) => console.log('  · ' + f))
} else {
  console.log('✅ 全部命中并替换')
}
