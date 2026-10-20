# QODER-17 证据目录（`--safe-top` 自引用修复）

工作树 `D:\Users\ZXQL\wt-agents\QODER-17`｜分支 `fix/qoder-17-safe-top`｜基线 `321b4f6b`。
读数口径：基线无门禁设施，harness（`app-mobile/vitest.config.ts`、`app-mobile/.eslintrc.cjs`）
借入自链上提交 `9fd90257`，**未提交、交付前已删除**；eslint 全量 json 落盘外 scratch
`D:/Users/ZXQL/wt-agents/_scratch/qoder-17/`（lint-before.json / lint-after.json），仓内只落计数摘要。

## raw/ —— 各判据原始输出（文件号 ↔ 回传卡 §二）

| 文件 | 内容 | 读数 |
| --- | --- | --- |
| 01/02-typecheck-before/after.txt | vue-tsc --noEmit 改前/改后 | 均 EXIT=0，错误 0=0 |
| 03/04-lint-before/after-summary.txt | eslint src 全仓逐规则计数 改前/改后 | files=190 / error=20 / warning=12880，两次完全一致，11 规则逐项不劣化 |
| 05-test-baseline-red.txt | 新增 spec 跑在未修复基线 | EXIT=1，断言①②红并点名 |
| 06-test-after-fix-green.txt | 修复后 | 3/3 绿 EXIT=0 |
| 07-build-h5.txt | npm --workspace app-mobile run build:h5 | EXIT=0 |
| 08-safetop-usage-grep.txt | 使用点统计 | `var(--safe-top)` 命中 **97 处 / 90 文件**，本单零改动 |
| 09-index-html-viewport.txt | index.html meta 取证 | **无 `viewport-fit=cover`** ⇒ 登记 §七，未擅改 |
| 10-dist-css-snippet.txt | H5 产物 CSS 摘录 | `uni-page-body{…--safe-top: env(safe-area-inset-top)}`，唯一定义；APP-PLUS 覆盖被条件编译剔除（符合预期） |
| 11-server-source.txt | 取证用静态服务器脚本 | 300s 自动退出，已退出 |

## anti/ —— 反测「红 → 复原 → 绿」三段

- `00-pre-sha256.txt` / `02-restore-sha256.txt`：注入前 / cp 复原后 SHA256 逐字节一致（7b8d33bd…，SHA256-MATCH-OK）。
- `01-inject-selfref-red.txt`：把 :54 逐字节注回 `var(--safe-top)`（scratch .mjs，latin1，命中≠1 即 exit 9）⇒ vitest **EXIT=1**，断言①点名红（2 failed | 1 passed）。
- `03-restore-green.txt`：复原后复跑 **EXIT=0，3 passed**。

## browser/ —— H5 computed 取证（AGENTS.md R8.1）

- `01-computed-values.txt`：`uni-page-body` 上 `--safe-top` computed = **`0px`（可解析、非空串；桌面 env=0 属正常）**；使用点 `.login-page` padding-top=0px；`documentElement` 为空系**作用域在 uni-page-body**（page 选择器编译目标），非缺陷。
- `02-live-cyclic-contrast.txt`：运行时注入自引用 ⇒ computed 变**空串（无效）**，移除后回 0px —— computed 值坐实原 bug 与修复。
- `03-matched-rule.txt`：运行时匹配规则 `uni-page-body{--safe-top: env(safe-area-inset-top)}`。
- `screenshot-blocked.note.txt`：take_screenshot 两次报 NATIVE_BROWSER_VIEWPORT_UNAVAILABLE（无可见浏览器表面）⇒ **截图未验**，复现命令已给出。

## 真机

App 真机未验：无设备（§七 如实登记，未写通过）。
