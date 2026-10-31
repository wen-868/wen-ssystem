<template>
  <router-view />
</template>

<style>
/* ═══════════════════════════════════════════════════════════════
   TOTAL-SAAS-UI-TOKENS-01 · 令牌单一真源收口
   ───────────────────────────────────────────────────────────────
   原此处曾用 `:root {}` 重定义 --text-primary / --text-secondary /
   --bg-page 三个基线令牌（#1a1a2e / #6b7280 / #f5f7fa）。

   问题：main.ts 的样式加载顺序为 tokens.css → components.css →
   App.vue，App.vue 的 :root 与 tokens.css 的 :root 特异性相同且
   **后加载**，故此处旧值会静默覆盖 tokens.css v5.0 的可达性修订值
   （#000000 / #444444 / #f7f7f7），形成「改了令牌却不生效」的视觉漂移。

   实测影响（docs/设计/contrast.mjs）：次级文字对比度由令牌值的
   9.09:1 回退到 4.50:1（虽仍达 AA，但可达性余量被腰斩）。

   处置：删除该 :root 重定义块，基线色单一真源回归
   saas-admin/src/styles/tokens.css。body 仍以 var() 引用，无缝切换。
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