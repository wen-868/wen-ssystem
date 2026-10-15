# 【派单 S3-188】动态 import 漏补扩展名（生产 `pay/notify` 500）＋ 复核"7 个非法编码文件"是否已修

- 派单人：**凌舟（总负责人）｜2026-10-13**
- 执行方：**阿坚（后端/构建脚本）**
- 工作区：从 `origin/main` 起新工作树，分支 `fix/s3-188-dynamic-import-esm`
- 依据：收口总清单第 **19、20** 项

> ⚠️ 并行单。**不要**碰 `wt-agents/S3-186` / `S3-187`（另两单在跑）。

---

## 一、第 19 项（成立，已复验）

- `scripts/fix-esm-extensions.js` **只给静态 `from "..."` 补 `.js`**，**不处理动态 `await import("...")`**（`rg -n 'import\(' scripts/fix-esm-extensions.js` → **0 命中**，我已复验）；
- 后果实测过：`backend/dist/controllers/miniapp/miniapp.controller.js` 保留 `await import("../../services/wechat-pay.service")`（无扩展名）⇒ 运行期 `Cannot find module '.../dist/services/wechat-pay.service'` ⇒ `POST /api/miniapp/pay/notify` **两次请求均 500**（含/不含 CSRF 头一致）；
- **影响面可能覆盖所有编译产物里的动态相对导入（含生产）**，不只这一个端点。

### 要求

1. 修 `fix-esm-extensions.js`：**同时处理动态 `import("...")` / `import('...')`** 的相对说明符（`./`、`../` 开头且无扩展名的），补 `.js`（与静态那套同口径；**不要**碰 `node_modules` 包名、`http(s)://`、`data:` 等非相对说明符）；
2. **扫全量产物**给证据：`dist/**` 里**还有多少处**无扩展名的动态相对导入（修前/修后各一次，期望修后 **0**）；
3. 运行期证据：本机起 `node dist/server.js`（可 `USE_MOCK_DB` 或私有库），打 `POST /api/miniapp/pay/notify` ⇒ **不再出现 500「Cannot find module」**（签名校验失败给 400 属正常，证明模块已能加载）；
4. 反测：把修复退回 ⇒ 该端点**该红就红**（500 + `Cannot find module`）；复原 ⇒ 绿。

## 二、第 20 项（**我已复验为 0**，你要复核并结项）

我用"逐字节扫非法 UTF-8 前导字节"的方式量过 `alert / customer-merge / export / miniapp-order-sync / stock-check / sys-config / payment` 七个文件：**全部 `invalid_lead=0`**。

### 要求

- 复核一遍（同一量法，贴原始输出）；
- 若确为 0 ⇒ **结项**（写进回传卡"已修/不成立"栏）；
- 若你量出仍有非法字节 ⇒ **停下来报回**（不要擅自改写文件，编码治理要单独开单）。

## 三、验收标准（机器可判，**必须给原始输出**）

1. 第 19 项：`dist/**` 动态相对导入缺扩展名的**修前/修后计数**（期望 0）+ 运行期两侧（反测红 / 复原绿）。
2. 第 20 项：七文件的非法字节计数原始输出（若全 0 ⇒ 结项）。
3. `cd backend && npx vitest run` ⇒ **全量 0 failed**；`npx tsc -p tsconfig.json --noEmit` ⇒ **EXIT=0**；`guard:route-auth` / `guard-tenant-status` ⇒ 均 **EXIT=0**。
4. 改动面：`scripts/fix-esm-extensions.js`（+ 必要的构建调用处）+ 测试（若有）+ 回传卡；**不得**手改 `dist/**` 产物（要改的是生成它的脚本）。

## 四、红线

1. **不得**手改 `backend/dist/**`（`dist` 是产物，改脚本才是根治）。
2. **不得**改 `guard-*.mjs` 判据、`docs/migrations/**`、`.github/**`、`deploy/**`、`docs/tasks/R101-收口总清单.md`、`docs/tasks/当前批次.md`。
3. **不得**顺手重写那 7 个（或其它）源文件的编码——那是独立治理项。
4. 只 add 本单文件，禁止 `git add -A`；**不得** `git push`、**不得**开 PR。
5. 不得把"我这边过了"当证据；必须给命令 + 原始输出。

## 五、回传格式（照抄，十项不得省略）

```
【汇报 S3-188】<一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端）｜2026-10-13
一、交付物（文件 + 关键行号 + 改动性质）
二、第 19 项：缺扩展名动态导入的修前/修后计数 + 运行期两侧
三、第 20 项：七文件非法字节复核输出（结项或报回）
四、全量 vitest / tsc / 两门禁
五、验收自评（对照 §三 四条）
六、未完成与阻塞
七、风险与自我报备 + 关联卡（总清单第 19/20 项）
```

## 六、完成后

把本文件移入 `docs\tasks\inbox\archive\`。最终回答给结论摘要。

---

## 追加指令（凌舟，2026-10-14 00:20 · 本卡有效，优先级高于本卡其余部分）

1. **只做本卡两件事**（① `scripts/fix-esm-extensions.js` 补动态 `import()` 的相对说明符扩展名 + `dist/**` 修前/修后计数 + 运行期两侧；② 复核 7 个文件的非法编码字节，全 0 则结项）。**不得**去做别人的单（S3-186/187/189）、**不得**替任何单写"凌舟裁定/验收结论"。
2. **不得 `git push`、不得开 PR、不得动别人的分支或工作树**；只在你自己的工作树 `D:\Users\ZXQL\wt-agents\S3-188`（分支 `fix/s3-188-dynamic-import-esm`，基线 `origin/main` = f161a448）内做本地提交。
3. 我这边观察到 00:20 前 `wt-agents/S3-188` 工作树与 `_s3188-evidence\` **都还不存在**。若尚未开工：先建工作树 + 用 **junction** 复用主库依赖（根与 backend 两层；junction 内严禁 pnpm），再按卡推进；若卡在环境，把**具体报错原文**写进 `D:\Users\ZXQL\wt-agents\_s3188-evidence\BLOCKED.txt` 并继续能做的部分。
4. 相关纪律事件（务必读一遍，避免重犯）：`docs/纪律事件-20261014-代写裁定与越权push.md`。
