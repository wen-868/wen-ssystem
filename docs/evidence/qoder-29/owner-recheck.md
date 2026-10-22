# QODER-29 · 负责人（阿潵）亲测复验记录

> 复验人：**阿潵（移动端负责人）**｜日期：2026-10-22｜执行通道：Qoder
> 对象：`fix/qoder-29-request-contract-security`，实现笔 `ec8c7066` ＋ 文档笔 `88dfe963`（HEAD），基线 QODER-27 `6702ec08`
> ⚠️ 本文件是**执行端 owner 的自复验**，不是凌舟的验收结论；判定权在凌舟。
> 口径：子代理的汇报一律当**待验主张**，以下每条都是我在 `D:\Users\ZXQL\wt-agents\QODER-29` 亲手跑/亲手读的。

## 一、结构与红线（亲跑）

| 主张 | 我的复验读数 | 方法 |
|:--|:--|:--|
| 两笔提交、只动本端 | `git log --graph 6702ec08..HEAD` ⇒ 恰 2 笔（`ec8c7066` fix / `88dfe963` docs）；改动 **37 文件**：`app-mobile/package.json` 1 ＋ `app-mobile/scripts` 2 ＋ `app-mobile/src` 6 ＋ `app-mobile/tests` 1 ＋ `docs/evidence/qoder-29` 25 ＋ 其他 docs 2 | `git diff --name-only -z` ＋ **NUL 切分**复算（防中文路径 C-quoting 假报） |
| 不碰后端/工作台/总台 | `FORBIDDEN backend/=0`、`admin-web/=0`、`saas-admin/=0`、`platform-miniapp/=0`、`miniapp/=0` | 同上 |
| 工作树 clean / 未 push | `PORCELAIN_LINES=0`、`UPSTREAM=NONE`（**测量时点：本复验笔提交前**，本文件与卡片补记尚未入库） | `git status --porcelain` 行数、`rev-parse --symbolic-full-name @{u}` |
| 未 `git add -A` | 提交链由执行方逐文件 add；我复算的是**已入库内容面**，无越界文件 | 同上 |

## 二、门禁与基线（我亲跑，非引用执行方日志）

`cd app-mobile && npm run check:gates` 在我这边重跑 ⇒ **EXIT=0**，逐门：

- type：`vue-tsc EXIT=0，当前错误 0 条，基线 0 条`
- lint：`当前 error 0（基线 0）、warning 12872（基线 12872）` ⇒ **未新增 console**（`no-console` 基线 225 未动，与卡片口径一致）
- test：`Test Files 16 passed (16)`／`Tests 322 passed (322)`，门读数 `当前 16 文件 / 322 用例，基线 16 / 322`
- contract：`差集（调用有、注册无）: 1 条，其中具名豁免 1 条` ⇒ 与基线同值，**未引入新契约漂移**
- 新守卫：`—— QODER-29 请求出口 & 凭据日志静态守卫 ——` 8 处直调全标 `✔ 已登记`，`✓ A 全部登记且未超额 · B 复用统一安全头 · C 无明文凭据日志 ⇒ EXIT=0`
  在册 8 处（守卫自报行号，我按名核对）：`ai.ts:259/383/416/457`、`products.ts:603(uploadFile)`、`profile.ts:47(uploadFile)`、`request.ts:102`、`update.ts:177(downloadFile)`

基线文件纪律（我实算）：`tests` 15/303 → **16/322**；`note` UTF-8 长度 9460 → **10635**，`PREFIX_KEPT_UTF8=true`（旧文逐字保全，只追加 1175 字符）；`typeCheck/lint/checkContract/contractDrift` 四段 `OTHER_SEG_UNCHANGED=true`；CRLF 47 处、裸 LF **0**。另跑凌舟既有量具 `node docs/evidence/qoder-27/tools/verify-note-segments.cjs` ⇒ `VERIFY_NOTE_SEGMENTS=PASS`（四段来源仍逐字在册）。

## 三、反测复原（我用哈希独立复核）

台账 `docs/evidence/qoder-29/anti-test-ledger.md:55` 声明完好态三文件 SHA；我在当前工作树独立实算 `sha256[:16]`：

| 文件 | 台账声明 | 我实算 | 一致 |
|:--|:--|:--|:--:|
| `src/api/request.ts` | `0a680815…` | `0a6808154d829790` | ✅ |
| `src/pages/login/login.vue` | `bbed53e1…` | `bbed53e1f4bf5c33` | ✅ |
| `src/api/modules/profile.ts` | `1aed0a8a…` | `1aed0a8ab89fb2b4` | ✅ |

⇒ 四轮注入均已**逐字节复原**，工作树不是"红态残留"。轮 ① 还带正对照（`②/⑤/⑥/⑦` 同次仍绿 ⇒ 红点精确落在业务码 reject，不是整片崩），符合"每个 0 要配可证伪正对照"。

## 四、我另外查证的两个回归风险（执行方没提，我自己去读的）

1. **`checkAppUpdate` 收进统一入口后，URL 主机没变。**
   `request.ts` 的 `BASE_URL` 与 `update.ts` 原 `resolveBase()` 取的是**同一对常量、同一条件编译**（H5→`API_BASE_H5`，非 H5→`API_BASE_NATIVE`，`src/config/env.ts:15-20`）⇒ 版本检查请求主机与改动前等价，QODER-24 的"同源/白名单"判据未被绕过。
   响应形态也核了：后端 `platform-app-version.routes.ts:7,24` 的 `GET /api/app/version/:platform` 走 `app-version.controller.ts:23 res.json(ok(data))`，而 `backend/src/shared/response.ts:3-5` 的 `ok()` 固定 `{code:"0",…data}` ⇒ 旧代码 `res.data.data` 与新代码"业务码通过后解包 data"**取值等价**。
2. **AI 域名多收到两个头，会不会预检失败？**
   `ai.ts` 改用 `buildRequestHeaders()` 后，H5 对 `https://m.onepan.cn/ai-api` 的跨域请求多出 `X-Tenant-Id` 与 `x-csrf-token`。我读了跨仓 `ZXQL-AI/src/main.ts:81-94`：`app.enableCors({ origin: 白名单函数, credentials: true })`，**未指定 `allowedHeaders`** ⇒ cors 中间件按 `Access-Control-Request-Headers` 回写，预检放行。origin 白名单是否含 H5 部署域名属**改动前就存在的前置**（原先也带 `Authorization` 跨域），本单未新增该风险。
3. 成功码集合我复核到唯一真相源：`backend/src/shared/response.ts:3-5` `ok()`⇒`code:"0"`，`fail()`⇒默认 `"400"`；与 `docs/项目统一标准.md` §3.1 一致 ⇒ 卡片"只认 `"0"`、`String()` 归一"**不是臆测**。消费者端（`miniapp`）若有独立信封不在本单范围。

## 五、遗留与移交（我要向凌舟报的三件）

| # | 事项 | 处置建议 |
|:--|:--|:--|
| R1 | **运行态端到端未验**：H5↔后端、H5↔AI 跨域、真机侧均未实开；本单判据＝单元 19 例＋静态机检 | 2026-10-22 凌舟侧人工登录已完成（`cli.bat islogin` ⇒ `{"login":true}`，IDE server `127.0.0.1:13298`）⇒ QODER-28 **小程序侧已可实开**，本项随该单 MP 取证一并收；App 真机侧仍无设备，继续挂账 |
| R2 | **生产构建剥离高噪声 console** 属构建配置面，本单按"不动 `vite.config`"红线未做 | **移交 QODER-31**（同批在办，构建配置归它）；我会在其交付后决定是否另开 F1 |
| R3 | 守卫 C 的扫描**跳过注释行**（用例 ⑳ 亦如此）⇒ 注释里残留的明文样例不会被抓 | 不执行即无泄漏，风险低；登记备查，若凌舟要求"注释也拦"我再派一笔收紧 |

## 六、我对 QODER-29 的自评（owner 侧，非凌舟验收）

卡 §三 六条硬验收：**6/6 通过**（四门 EXIT=0、三构建我自己复跑、直调清单 8 条逐条分类＋同安全头、2xx+业务码/401/403/网络/超时各有真实用例、反测红并点名＋复原 SHA 我独立哈希复核、工作树 clean）。

三构建**我复跑读数**（不复用执行方 `raw/`，2026-10-22 在本工作树尖 `88dfe963` 上实测）：`build:h5` **EXIT=0**、`build:mp-weixin` **EXIT=0**、`build:app` **EXIT=0**。
卡 §四 红线：**全守**。
未验项如实挂账：R1/R2/R3 三条，未计入"完成"。
