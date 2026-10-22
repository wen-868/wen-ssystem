# QODER-29 · 凭据日志审计（MO-26）

> 目标：登录 / 鉴权 / 请求调试日志禁止输出**明文** password / token / csrf / secret / authorization。
> 机检出处：`app-mobile/scripts/guard-request-contract.mjs` 检查项 C。
> 约束：本卡**未新增任何 `console.*` 调用**；未改动构建配置（去 console 属构建期，登记为待裁定，归属 QODER-31）。

## 1. 全量扫描（改动后现状）

对 `app-mobile/src/**/*.{ts,vue}` 内所有引用凭据词的 `console.*` 逐条核对（命令：`grep -rnaE "console\.(log|info|warn|error|debug)\(" src --include=*.ts --include=*.vue | grep -aiE "password|token|csrf|secret|authorization"`，已排除注释行）：

| 文件:行 | 语句 | 是否明文 | 判定 |
| --- | --- | --- | --- |
| `src/pages/login/login.vue:166` | `console.log('[login] 已自动带出记住的账号 accountLen=%d passwordLen=%d', savedAccount.length, savedPassword.length)` | 否（只打 `.length`） | 合规（脱敏：长度） |
| `src/pages/login/login.vue:276` | `console.log('[demo-login] 自动填入 accountLen=%d passwordLen=%d', loginForm.username.length, loginForm.password.length)` | 否（只打 `.length`） | **本卡修复点**（见下） |

无其它凭据词 console；无新增 console（lint `warning 12872（基线 12872）` 未劣化 ⇒ `no-console` 冻结值未上调，`raw/10:17-18`）。

## 2. 修复明细（login.vue:276）

- 旧实现：`console.log('[demo-login] 自动填入 username=%s password=%s', loginForm.username, loginForm.password)` —— **打印明文口令**。
- 新实现：只打长度 `accountLen=%d passwordLen=%d … username.length, password.length`；`console.*` 条数不变（改同一条，非新增）。
- 275 行的说明注释保留旧写法原文作为「被否定的旧形态」注记；守卫 C 与本卡单测均**跳过注释行**（同口径），故注释不误红。

## 3. 守卫 C 判据（静态、不依赖运行期）

- 按括号深度提取每条 `console.*(...)` 完整文本；起始行为注释行的跳过。
- 命中凭据词 `CRED_TOKEN_RE = /\b(password|passwd|pwd|token|csrf|secret|access[-_]?token|refresh[-_]?token|api[-_]?key|authorization)\b/i`
  **且** 无脱敏痕迹 `MASKED_RE = /\.length\b|Len\b|len\b|slice\(|\.slice|mask|redact|\*\*\*|%\s*d|\{\s*\}/i` ⇒ 判红点名。
- 现状：`A/B/C` 三段全空 ⇒ 守卫 EXIT=0（`raw/30-guard-inventory.json`）。
- 反测：轮 ③ 注入 `console.log('anti-test-plaintext', loginForm.password)` ⇒ 守卫 C 红并点名 `login.vue:277`（`anti/03-inject-plaintext-password-log.txt`），复原后绿。

## 4. 待裁定 / 登记（不在本卡动作面）

- **「生产构建剥离 console」**：属构建配置（vite/esbuild `drop`/`pure` 或 terser 选项）。本卡按派发口径**未动构建配置**，交阿潵转 QODER-31（构建收口）处置。移动端 `src` 里现存的高噪声 console（no-console 基线 225 条）是否在构建期统一剥离、以何种构建开关，应由该单裁定，本卡不自作主张。
