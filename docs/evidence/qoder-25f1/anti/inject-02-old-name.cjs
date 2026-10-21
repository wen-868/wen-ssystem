/* eslint-disable */
/**
 * QODER-25F1 反测②注入器（.cjs）
 *
 * 注入内容：把 AI 页（app-mobile/src/pages/ai-chat/ai-chat.vue）的自绘栏标签与导入路径
 *           注回上一轮的旧组件名 custom-tab-bar（即"组件注册面撞 uni-app 平台保留名"）：
 *             `<app-tab-bar :current="'ai'" />`                 -> `<custom-tab-bar ... />`
 *             `import AppTabBar from '@/components/app-tab-bar.vue'` -> `.../custom-tab-bar.vue'`
 * 目标红名：tabbar-name-reactivity.spec.ts › S1（保留名扫描）与 S2（挂载配对），
 *           并连带 ai-cross-platform.spec.ts › G6（AI 页模板未挂载 / 未 import）
 *
 * 用法：node inject-02-old-name.cjs <ai-chat.vue 绝对路径>
 * 退出码：0 = 两处都命中 1 次并写入；2 = 任一 hits!=1 或基线不干净
 */
const fs = require('fs')

const TARGET = process.argv[2]
if (!TARGET) {
  console.error('[inject-02] usage: node inject-02-old-name.cjs <path-to-ai-chat.vue>')
  process.exit(2)
}

const PAIRS = [
  [`<app-tab-bar :current="'ai'" />`, `<custom-tab-bar :current="'ai'" />`],
  [`import AppTabBar from '@/components/app-tab-bar.vue'`, `import AppTabBar from '@/components/custom-tab-bar.vue'`]
]

let text = fs.readFileSync(TARGET, 'utf8')

for (const [before, after] of PAIRS) {
  const hits = text.split(before).length - 1
  if (hits !== 1) {
    console.error(`[inject-02] ABORT hits=${hits} (expect exactly 1) for needle: ${before}`)
    process.exit(2)
  }
  if (text.includes(after)) {
    console.error(`[inject-02] ABORT baseline is not clean, already contains: ${after}`)
    process.exit(2)
  }
  text = text.replace(before, after)
}

fs.writeFileSync(TARGET, text)
console.log(`[inject-02] OK injected=${PAIRS.length} pairs, each hits=1`)
