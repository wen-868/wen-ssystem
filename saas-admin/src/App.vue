<template>
  <router-view />
</template>

<style>
/* ═══════════════════════════════════════════════════════════════
   TOTAL-SAAS-UI-TOKENS-01 · 令牌单一真源收口
   ───────────────────────────────────────────────────────────────
   原此处曾用 `:root {}` 重定义 --text-primary / --text-secondary /
   --bg-page 三个基线令牌（#1a1a2e / #6b7280 / #f5f7fa），与
   styles/tokens.css 形成端内双定义（R101-N1-freeze-scan §3.2）。

   computed 定论（本卡实测，evidence/before/computed.json）：
   dev 注入顺序下本文件的旧值**实际生效**——
   --text-primary=#1a1a2e、--text-secondary=#6b7280、--bg-page=#f5f7fa，
   body 呈 rgb(26,26,46) / rgb(245,247,250)，tokens.css 的可达性修订值
   （S3-47/53/54：#000000/#444444/#f7f7f7）从未真正上场。
   层叠结果依赖样式注入顺序，本身脆弱（历史 H-2 实测曾得到相反结论），
   故正确收口不是「调整顺序」，而是**删除重复定义**。

   处置：删除该 :root 重定义块，基线色单一真源回归
   saas-admin/src/styles/tokens.css。body 仍以 var() 引用，无缝切换。
   契约测试：src/styles/tokens.contract.spec.ts（B1/B2/B3 防回归）。
   若日后确需调整基线色，请改 tokens.css，勿在此处再开第二真源。
   ═══════════════════════════════════════════════════════════════ */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--text-primary);
  background: var(--bg-page);
}
</style>
