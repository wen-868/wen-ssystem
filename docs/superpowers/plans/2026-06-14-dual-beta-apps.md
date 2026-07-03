# 双端内测包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成门店端 H5/PWA 内测包和 C 端小程序内测准备包。

**Architecture:** 门店端继续使用现有 `store-terminal` Vite/Vue 应用，补充 PWA manifest、service worker、移动端 meta 和内测打包脚本。C 端移动端继续使用现有 `miniapp` 微信小程序工程，补充内测配置示例和 zip 打包脚本，不重写为 H5。

**Tech Stack:** Vue 3、Vite、微信小程序、Node.js 脚本、npm workspace。

---

## File Structure

- Create `store-terminal/public/manifest.webmanifest`: PWA 元信息。
- Create `store-terminal/public/sw.js`: 只缓存应用壳，不缓存业务接口。
- Create `store-terminal/src/register-sw.ts`: 注册 service worker。
- Modify `store-terminal/src/main.ts`: 引入 `register-sw.ts`。
- Modify `store-terminal/index.html`: 增加 viewport、theme-color、manifest、Apple mobile meta。
- Create `store-terminal/.env.beta.example`: 门店端内测 API 地址示例。
- Create `miniapp/app.config.beta.example.js`: 小程序内测 API 地址示例。
- Create `scripts/build-store-beta.mjs`: 构建并压缩门店端 PWA 包。
- Create `scripts/build-mobile-beta.mjs`: 压缩小程序内测准备包。
- Create `scripts/check-beta-artifacts.mjs`: 校验双端内测产物。
- Modify `package.json`: 增加 `build:store-beta`、`build:mobile-beta`、`build:beta`、`test:beta`。
- Modify `PARTNER_LOG.md`: 记录双端内测包生成安排和验证结果。

---

### Task 1: 内测产物校验脚本

**Files:**
- Create: `scripts/check-beta-artifacts.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test script**

Create `scripts/check-beta-artifacts.mjs`:

```js
import { existsSync, readFileSync, statSync } from "node:fs";

function assertFile(path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`缺少文件: ${path}`);
  }
}

function assertIncludes(path, text) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(text)) {
    throw new Error(`${path} 缺少 ${text}`);
  }
}

assertFile("store-terminal/public/manifest.webmanifest");
assertFile("store-terminal/public/sw.js");
assertFile("store-terminal/src/register-sw.ts");
assertFile("store-terminal/.env.beta.example");
assertFile("miniapp/app.config.beta.example.js");
assertFile("scripts/build-store-beta.mjs");
assertFile("scripts/build-mobile-beta.mjs");

assertIncludes("store-terminal/index.html", "manifest.webmanifest");
assertIncludes("store-terminal/index.html", "#1677FF");
assertIncludes("store-terminal/src/main.ts", "./register-sw");
assertIncludes("store-terminal/public/manifest.webmanifest", "智享门店端");
assertIncludes("store-terminal/public/sw.js", "store-terminal-shell-v1");
assertIncludes("store-terminal/.env.beta.example", "VITE_API_BASE_URL=");
assertIncludes("miniapp/app.config.beta.example.js", "https://api.example.com/api");

console.log("BETA_ARTIFACTS_PASS");
```

- [ ] **Step 2: Add npm script and verify RED**

Modify root `package.json` scripts:

```json
"test:beta": "node scripts/check-beta-artifacts.mjs"
```

Run: `npm run test:beta`

Expected: FAIL with `缺少文件: store-terminal/public/manifest.webmanifest`.

- [ ] **Step 3: Commit RED test**

```bash
git add package.json scripts/check-beta-artifacts.mjs
git commit -m "test: 添加双端内测包契约"
```

---

### Task 2: 门店端 PWA 能力

**Files:**
- Create: `store-terminal/public/manifest.webmanifest`
- Create: `store-terminal/public/sw.js`
- Create: `store-terminal/src/register-sw.ts`
- Modify: `store-terminal/src/main.ts`
- Modify: `store-terminal/index.html`
- Create: `store-terminal/.env.beta.example`

- [ ] **Step 1: Create manifest**

Create `store-terminal/public/manifest.webmanifest`:

```json
{
  "name": "智享门店端",
  "short_name": "智享门店",
  "description": "智享酒业门店内测版，用于开单、挂单、库存、订单和收款。",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#1677FF",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create icons**

Create `store-terminal/public/icons/icon-192.svg` and `store-terminal/public/icons/icon-512.svg` with the same SVG content, changing only width/height if desired:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="42" fill="#1677FF"/>
  <rect x="38" y="48" width="116" height="96" rx="18" fill="#FFFFFF"/>
  <path d="M62 78h68M62 100h68M62 122h42" stroke="#1677FF" stroke-width="10" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 3: Create service worker**

Create `store-terminal/public/sw.js`:

```js
const CACHE_NAME = "store-terminal-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 4: Register service worker**

Create `store-terminal/src/register-sw.ts`:

```ts
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("门店端内测版 Service Worker 注册失败", error);
    });
  });
}
```

Modify `store-terminal/src/main.ts`:

```ts
import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles.css";
import "./register-sw";
import App from "./App.vue";

createApp(App).use(ElementPlus).mount("#app");
```

- [ ] **Step 5: Add mobile metadata**

Modify `store-terminal/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1677FF" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="智享门店" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>智享门店端内测版</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Add beta env example**

Create `store-terminal/.env.beta.example`:

```env
VITE_API_BASE_URL=https://api.example.com
```

- [ ] **Step 7: Verify GREEN**

Run: `npm run test:beta`

Expected: still FAIL because build scripts and mobile config are not yet present; PWA missing-file errors should be gone.

- [ ] **Step 8: Commit**

```bash
git add store-terminal/public store-terminal/src/register-sw.ts store-terminal/src/main.ts store-terminal/index.html store-terminal/.env.beta.example
git commit -m "feat: 添加门店端PWA内测能力"
```

---

### Task 3: 双端打包脚本

**Files:**
- Create: `scripts/build-store-beta.mjs`
- Create: `scripts/build-mobile-beta.mjs`
- Create: `miniapp/app.config.beta.example.js`
- Modify: `package.json`

- [ ] **Step 1: Create mobile beta config example**

Create `miniapp/app.config.beta.example.js`:

```js
App({
  globalData: {
    apiBase: "https://api.example.com/api"
  }
});
```

- [ ] **Step 2: Create store beta builder**

Create `scripts/build-store-beta.mjs`:

```js
import { existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const output = "store-terminal-beta.zip";

if (existsSync(output)) {
  rmSync(output);
}

execFileSync("npm", ["--workspace", "store-terminal", "run", "build"], { stdio: "inherit" });
execFileSync("zip", ["-qr", `../${output}`, "."], {
  cwd: "store-terminal/dist",
  stdio: "inherit"
});

console.log(`STORE_BETA_PACKAGE_READY ${output}`);
console.log("部署建议：上传 zip 内容到 https://store.<正式域名>，API 指向 https://api.<正式域名>。");
```

- [ ] **Step 3: Create mobile beta builder**

Create `scripts/build-mobile-beta.mjs`:

```js
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const workDir = ".beta-build/miniapp";
const output = "miniapp-beta.zip";
const appJs = readFileSync("miniapp/app.js", "utf8");

if (!appJs.includes("globalData") || !appJs.includes("apiBase")) {
  throw new Error("miniapp/app.js 缺少 globalData.apiBase");
}

rmSync(".beta-build", { recursive: true, force: true });
rmSync(output, { force: true });
mkdirSync(workDir, { recursive: true });
cpSync("miniapp", workDir, { recursive: true });

execFileSync("zip", ["-qr", `../../${output}`, "."], {
  cwd: workDir,
  stdio: "inherit"
});

console.log(`MOBILE_BETA_PACKAGE_READY ${output}`);
console.log("微信开发者工具导入 miniapp 或解压 miniapp-beta.zip；上传体验版前替换真实 appid 和 HTTPS API 域名。");
```

- [ ] **Step 4: Add npm scripts**

Modify root `package.json` scripts:

```json
"build:store-beta": "node scripts/build-store-beta.mjs",
"build:mobile-beta": "node scripts/build-mobile-beta.mjs",
"build:beta": "npm run build:store-beta && npm run build:mobile-beta",
"test:beta": "node scripts/check-beta-artifacts.mjs"
```

- [ ] **Step 5: Verify artifact contract passes**

Run: `npm run test:beta`

Expected: `BETA_ARTIFACTS_PASS`

- [ ] **Step 6: Generate packages**

Run: `npm run build:beta`

Expected:

```text
STORE_BETA_PACKAGE_READY store-terminal-beta.zip
MOBILE_BETA_PACKAGE_READY miniapp-beta.zip
```

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/build-store-beta.mjs scripts/build-mobile-beta.mjs miniapp/app.config.beta.example.js
git commit -m "feat: 生成双端内测包"
```

---

### Task 4: 验证、记录、推送

**Files:**
- Modify: `PARTNER_LOG.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:beta
npm run test:ui
npm run build
```

If mock backend is running, also run:

```bash
npm run test:store
npm run test:qa
```

Expected:

```text
BETA_ARTIFACTS_PASS
UI_CONTRACT_PASS
```

Build must exit 0. Store and QA scripts must exit 0 when backend is available.

- [ ] **Step 2: Append project log**

Append to `PARTNER_LOG.md`:

```md
---

### [凌舟] 21:40 → [林夕 / 苏然 / 阿坚]

已生成双端内测包能力：门店端 H5/PWA 内测包与 C 端小程序内测准备包。

**【交付物】**
- `store-terminal/public/manifest.webmanifest`
- `store-terminal/public/sw.js`
- `store-terminal/.env.beta.example`
- `miniapp/app.config.beta.example.js`
- `scripts/build-store-beta.mjs`
- `scripts/build-mobile-beta.mjs`
- `scripts/check-beta-artifacts.mjs`
- `store-terminal-beta.zip`
- `miniapp-beta.zip`

**【验证】**
- `BETA_ARTIFACTS_PASS`
- `UI_CONTRACT_PASS`
- 构建通过

**【下一步】**
- 阿坚部署 `store-terminal-beta.zip` 到 `https://store.<正式域名>`。
- 项目负责人在微信开发者工具中替换真实 appid，上传小程序体验版。
- 苏然基于真实环境做双端内测验收。
```

- [ ] **Step 3: Commit and push**

```bash
git add PARTNER_LOG.md
git commit -m "docs: 记录双端内测包生成"
git push origin main
```

---

## Self-Review

- Spec coverage: 覆盖门店端 PWA、小程序准备包、环境配置、打包产物、验收标准。
- Placeholder scan: 无 TBD/TODO/“稍后实现”等占位。
- Type consistency: 脚本名、npm script 名、文件路径在各任务中保持一致。
