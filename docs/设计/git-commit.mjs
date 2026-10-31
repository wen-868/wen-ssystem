#!/usr/bin/env node
/** 仅提交 TOTAL-SAAS-UI-TOKENS-01 相关文件，避开其他 agent 的并发改动 */
import { execFileSync } from 'node:child_process'

const FILES = [
  'saas-admin/src/App.vue',
  'saas-admin/src/styles/components.css',
  'saas-admin/src/styles/tokens.css',
  'saas-admin/src/views/AuditLogs.vue',
  'saas-admin/src/views/Dashboard.vue',
  'saas-admin/src/views/ErrorLogs.vue',
  'saas-admin/src/views/MessageConfig.vue',
  'saas-admin/src/views/MobilePreview.vue',
  'saas-admin/src/views/PackageForm.vue',
  'saas-admin/src/views/PlatformReviews.vue',
  'saas-admin/src/views/SubscriptionDetail.vue',
  'saas-admin/src/views/Subscriptions.vue',
  'saas-admin/src/views/TenantUsage.vue',
  'saas-admin/src/views/ai-config/AiBillingConfig.vue',
  'saas-admin/src/views/ai-config/PlatformAiConfig.vue',
  'saas-admin/src/views/login/PlatformRegister.vue',
  'saas-admin/src/views/subscription/SubscriptionApplies.vue',
  'saas-admin/src/views/tenant/ApplicationDetail.vue',
  'docs/设计/token-audit.mjs',
  'docs/设计/contrast.mjs',
  'docs/设计/apply-tokens.mjs',
  'docs/设计/check-cascade.mjs',
  'docs/设计/check-dist.mjs',
  'docs/设计/check-dist2.mjs',
  'docs/设计/check-dist3.mjs',
  'docs/设计/token-audit-report.md',
  'docs/设计/总后台令牌收口报告-TOTAL-SAAS-UI-TOKENS-01.md',
  'docs/设计/git-commit.mjs',
]

const MSG = `fix(saas-admin): TOTAL-SAAS-UI-TOKENS-01 总后台令牌与视觉漂移收口

P0 双源覆盖:
- 删除 App.vue 的 :root 第二真源。其旧值(#1a1a2e/#6b7280/#f5f7fa)因后加载
  静默覆盖 tokens.css 的可达性修订值(#000000/#444444/#f7f7f7)，使 S3-47/53/54
  从未真正生效；修复后次级文字对比度 4.50:1 -> 9.09:1(实测 contrast.mjs)

令牌迁移:
- 残留 Element 旧色 33 处迁至语义令牌；其中 #909399 实测 3.08:1 违反
  WCAG AA，改用 --text-muted(4.54:1 达标)
- TenantUsage 图表/统计卡由 Tailwind 色板改为运行时解析 --chart-* 令牌，
  兜底值取令牌字面值本身，单一真源仍是 tokens.css
- 圆角 26 处、阴影 1 处归入令牌阶梯(4/6/8/10/12/16/20)
- 新增 --color-star 令牌，收口星级评分硬编码 #ff9900(取值沿用默认色，零位移)
- MobilePreview 的手机机身造型色与异形圆角按「被模拟硬件」豁免并登记

验证(真跑):
- vue-tsc --noEmit: 0 错误
- vite build: 通过(1m59s)
- 审计 ①②③ 由 93 -> 0
- 产物校验: 旧色板 #10b981/#f59e0b/#8b5cf6/#ef4444/#1a1a2e 均 0 次

待决策(不在本单自决范围):
- Element 跨体系漂移 8 项(含 --el-color-info 灰 vs 蓝的语义冲突)，附草案
- admin-web 同名不同值 61 项，建议单独立卡
- 本单号尚未登记入 ACTIVE.md/当前批次/current-tasks，建议补登记`

const run = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

try {
  console.log(run(['add', '--', ...FILES]) || '(add 无输出)')
  const staged = run(['diff', '--cached', '--name-only']).trim().split('\n').filter(Boolean)
  console.log(`\n已暂存 ${staged.length} 个文件：`)
  staged.forEach((f) => console.log('  ' + f))
  const out = run(['commit', '-m', MSG])
  console.log('\n' + out)
} catch (e) {
  console.error('失败：', e.stdout || '', e.stderr || '', e.message)
  process.exit(1)
}
