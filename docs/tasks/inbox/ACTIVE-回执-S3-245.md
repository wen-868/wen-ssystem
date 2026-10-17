# ACTIVE-回执 · S3-245（crypto.ts 重复声明根治 + app-mobile 类型门禁接进 CI）

> 对应派单：**S3-245**（卡：`D:\Users\ZXQL\dispatch\dsh\ends\移动端\inbox\S3-245-card.md`）
> 汇报人：**阿潵（移动端前端 owner）**｜日期：**2026-10-17**｜汇报对象：凌舟（总负责人）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-245`｜分支：`feat/s3-245-crypto-iife-tsc-gate`｜基线 `origin/main` = `7ea26e8d`
> 提交：`65a41792`（代码 + CI）｜**未 push / 未开 PR / 未 `git add -A`**
> 完整十项回传：`docs/tasks/cards/R101-S3-245-阿潵回传.md`

## 一、改了什么（两件交付）

1. **根治**：`app-mobile/src/utils/crypto.ts` —— `setSecureStorage` / `getSecureStorage` / `removeSecureStorage` 三个导出**各收敛为单一声明**，H5 与原生两套实现改为**函数体内的条件编译分支**（保留 uni 编译器的分支裁剪），消除 `// #ifdef H5` / `// #ifndef H5` 两套同名导出。
2. **门禁**：`.github/workflows/ci.yml` 新增阻断步骤 `App mobile type gate (vue-tsc --noEmit)`（第 24 步），口径 **0 新增 · 逐条比对**（内嵌空基线 + `comm -13` 逐行输出 + vue-tsc 退出码判红）。

## 二、五条判据的原始输出（逐条）

| 判据 | 读数 |
|:--|:--|
| ① vue-tsc | 改造前 **12 处 / EXIT=2** ⇒ 改造后 **0 行 / EXIT=0** |
| ② 反测 | 还原成双声明 ⇒ **12 处、EXIT=2、全部点名 `src/utils/crypto.ts`**；复原后 SHA256 `23a91b778004afcc3f9826b6ae63e7ed9ed1f34e48b5c62757d1c5e60f864788`（逐字节一致） |
| ③ 构建 | `npm --workspace app-mobile run build:h5` ⇒ `DONE Build complete.` **BUILD_EXIT=0** |
| ④ CI | YAML 本机校验 `YAML_PARSE_OK`；`found "App mobile type gate" steps = 1`（序号 24） |
| ⑤ 三门禁 | `guard-rbac-wiring --strict` **EXIT=0**（297/未登记 0/陈旧 0；consumerEnd 45）｜`guard-migration-manifest` **EXIT=0 PASS**（206=186+8+12）｜`guard-evidence-secrets` **EXIT=0 PASS**（命中 0/豁免 1） |

证据原始输出：`docs/evidence/S3-245/raw/**`（含零字节证据的 `.note.txt` 说明）。

## 三、未完成与阻塞

1. **CI 步骤未在真实 GitHub run 上验红**（本机只做了 YAML 解析 + vue-tsc 自身的红/绿）；按红线未 push、未开 PR，需凌舟推分支或授权后由 CI 触发。
2. `git fetch origin` 首次 `Connection was reset`；改以既有 `origin/main` 引用 `7ea26e8d` 作基线（与本地 HEAD 同值）。

## 四、风险与自我报备

1. **两处形态选择待凌舟裁定**（详见回传卡 §五）：① 基线清单目前**内嵌于 workflow**（因我的代码面只含 `app-mobile/src/**`，未擅自在 `app-mobile/` 根落文件）；② 采用"函数体内条件编译分支"而非严格 IIFE —— 后者会让 uni 无法裁剪另一分支（两套实现都进包）。
2. **行为等价**：H5 的 `b64:` 混淆与旧 AES-GCM 清除逻辑、原生的 `{iv,ciphertext,tag}` 均逐句保留；`h5ls()` 移到模块作用域（App 端 `window` 缺失由 `catch` 兜住，行为不变），包体约 +200 字节。
3. **环境故障**：PowerShell 的 Core 内置模块缺失（`Set-Location`/`Select-Object`/`Measure-Object`/`Test-Path`/`Set-Content`/`New-Item` 全部无法加载），本单全程以 `git -C` + `cmd /c` + `cmd /v:on` + `mklink /J` 绕过。建议排查，否则同端后续取证均受影响。
4. 未碰他人工作树；未改后端 / `admin-web/**` / `saas-admin/**` / 迁移；未用 `.github/workflows/` 以外的东西"绕过"。
