<template>
  <router-view />
</template>

<style>
:root {
  --text-primary: #1a1a2e;
  --text-secondary: #6b7280;
  --bg-page: #f5f7fa;
}

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