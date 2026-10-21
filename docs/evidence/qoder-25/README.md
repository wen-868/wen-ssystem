# QODER-25 证据树 · AI Chat 三端条件编译与自绘 tabBar（MO-17/18）

> 任务书：`docs/tasks/inbox/QODER-25-ai-cross-platform.md`｜回传卡：`docs/tasks/cards/R101-QODER-25-回传.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-25.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-25`｜分支：`fix/qoder-25-ai-cross-platform`｜基线：`bc1087ee`｜实现笔：`5b90a744`
> 维护方：Qoder（移动端）。**本树只登记读数，不含验收方判词；判定权在凌舟。**

## 0. 清单（31 份读数件：执行方 22 + 负责人 9；另加 3 份文档笔）

| 归属 | 件数 | 说明 |
|---|---|---|
| 执行方子代理会话 | 22 | `raw/10·11·12·20·30·31·31.stdout·32·33·34·35·40·41·50`（14）+ `anti/round-01…05`（5）+ 根级 `mock-ai-backend.mjs` / `.log` / `.stdout.log`（3） |
| 负责人（本代理）本人 | 9 | `raw/60·61·71·73·74·75`（6）+ `anti/60-owner-anti-{1,2,3}`（3） |
| 文档笔新增 | 3 | 本 `README.md`、`docs/tasks/cards/R101-QODER-25-回传.md`、`docs/tasks/inbox/ACTIVE-回执-QODER-25.md` |

**分工与署名口径**：实现笔 `5b90a744`（作者字段 `墨 <mo@zhixiang-system.com>`，仓库内两方共用同一 git 身份 ⇒ 只能按会话如实标注）与其全部 `raw/1x·2x·3x·4x·5x`、`anti/round-0x` 日志由**执行方**产出；执行方会话在证据齐备后中断，**未产出任何文档**，三份文档与 `raw/6x·7x`、`anti/60-owner-*` 由**负责人**补做/实测。原始日志一律未改写字节；需要更正的（`raw/74`、`raw/41`）以**追加更正段**形式落在同文件末尾，原文保留。

```
docs/evidence/qoder-25/
├── README.md                        ← 本文件
├── mock-ai-backend.mjs              取证用网络装置（非产品代码，不入 src）
├── mock-ai-backend.log              执行方第一轮（端口 8388）
├── mock-ai-backend.stdout.log       同上 stdout
├── anti/
│   ├── round-01-fs-in-app.log       执行方：SHA 段自作废（假对称），保留不删
│   ├── round-02-fs-in-app.log       执行方：有效（G1 红）
│   ├── round-03-ac-in-nonh5.log     执行方：有效（G2 红）
│   ├── round-04-drop-tabbar.log     执行方：有效（G6 红）
│   ├── round-05-drop-register-cancel.log  执行方：有效（G8 红，目标文件为 ai.ts）
│   ├── 60-owner-anti-1-fs-in-app.log   负责人：G1 红 + 残留机检
│   ├── 60-owner-anti-2-ac-in-nonh5.log 负责人：G2 红
│   └── 60-owner-anti-3-drop-tabbar.log 负责人：G6 红
└── raw/
    ├── 10-build-h5.log              执行方 单端构建（首次）
    ├── 11-build-mp-weixin.log       执行方 单端构建（首次）
    ├── 12-build-app.log             执行方 单端构建（首次）
    ├── 20-dev-h5.log                执行方 dev:h5 首轮装置日志
    ├── 30-gates-tip.log             执行方 尖端四门串跑（GATES_EXIT=0，12/196）
    ├── 31-mock-backend-cont.log     执行方 续办轮 mock（端口 8199）
    ├── 31-mock-backend-cont.stdout.log 同上 stdout
    ├── 32-dev-h5-cont.log           执行方 续办轮 dev:h5（端口 5199）
    ├── 33-h5-setup-cont.log         执行方 续办轮装置就绪读数
    ├── 34-h5-browser-readings.log   执行方 H5 实开读数（§④ 停止两侧同取；§⑤ 作废一条）
    ├── 35-h5-teardown.log           执行方 装置收尾
    ├── 40-builds-tip.log            执行方 三构建串跑（BUILD_*_EXIT=0）
    ├── 41-build-artifacts-verify.log 执行方 产物内容核验（含追加更正段）
    ├── 50-scope-redlines.log        执行方 谱系 / 范围 / 红线机检
    ├── 60-owner-gates-and-builds.log   负责人 四门 + 三构建亲跑
    ├── 61-owner-artifacts.log         负责人 逐端产物机检（每条带 RG_EXIT/LS_EXIT 原值）
    ├── 71-owner-mock-backend.log      负责人 mock 服务端读数（CLIENT CLOSE / DONE 实证）
    ├── 73-owner-h5-readings.log       负责人 H5 独立实开读数（§0·①–⑨）
    ├── 74-owner-teardown.log          负责人 收尾（含追加更正段）
    └── 75-owner-docs-commit-close.log 负责人 文档笔入库后的终态实测（§6.1）
```

## 1. `raw/` —— 任务书 §三 硬验收（门 · 构建 · 产物）

| 判据 | 执行方读数出处 | 负责人亲跑出处 | 值 |
|---|---|---|---|
| 四门 EXIT=0 | `raw/30:4` | `raw/60:72` | `GATES_EXIT=0` |
| type-check | `raw/30:14` | `raw/60:15` | vue-tsc EXIT=0，错误 0 / 基线 0 |
| lint | `raw/30:21` | `raw/60:22` | error 0（基线 0）、warning 12872（基线 12872） |
| test | `raw/30:52-53,57` | `raw/60:53-54,58` | 12 文件 / 196 用例，基线 12 / 196 |
| check:contract | `raw/30:64-68` | `raw/60:65-69` | ①292 ②283 ③204 / 后端 1498 / 差集 1（具名豁免 1） |
| build:h5 | `raw/40:25`（单端 `raw/10`） | `raw/60` | EXIT=0 |
| build:mp-weixin | `raw/40:43`（单端 `raw/11`） | `raw/60` | EXIT=0（撞名警告原文 `raw/40:40`） |
| build:app | `raw/40:63`（单端 `raw/12`） | `raw/60` | EXIT=0 |
| 产物含 AI 页 / 自绘栏 | `raw/41` | `raw/61` | H5 `pages-ai-chat-ai-chat.BieDSea6.js` + `custom-tab-bar.C-imRqs-.js`；MP `ai-chat.wxml` 含 `custom-tab-bar`、`app.json` `"custom": true`；App `app-service.js` 含 `plus.io.resolveLocalFileSystemURL` |
| 按端剥离（负向） | `raw/41` | `raw/61` | H5 与 App 包内 `getFileSystemManager` `RG_EXIT=1`；App 包内 MP 播报文案 `RG_EXIT=1` |
| 后端只读 | `raw/50:29` | `raw/60:136` | `git diff bc1087ee..HEAD -- backend/` = 0 字节 |
| 范围 | `raw/50:34-41` | `git show --stat` | 6 文件 +497/−40 |

`raw/20·32·33` 为 dev:h5 与装置就绪读数（不是判据本身，仅证明实开确有其事）。

## 2. `anti/` —— 任务书 §二.6 反测（三件必红 + 一件加测）

**装置**：注入器与备份均在树外 `/d/Users/ZXQL/wt-agents/_qoder25_ownverify/`（`inject.cjs` sha256 `182cbb48cb10fb4594b5a7e2a87d7f2b5ea31ae40f110bd38122d095d19f5f01`、`bak/` 原始态、`owner-round.sh` 驱动）。负责人注入器为执行方注入器的**逐字节同源副本**，故两侧命中行号与红点名可直接对账。

**每轮固定七步**（负责人轮次额外含首末两项机检）：

```
PRECHECK_DIFF_BYTES=0  ⇒ 注入（hits≠1 即 exit 2 拒写）⇒ INJECT_HIT_COUNT=1 / INJECT_EXIT=0
⇒ TEST_EXIT=1 且红输出点名守卫（EXPECT_HIT=3 校「真点名」而非整体退出码）
⇒ cp 树外备份复原 ⇒ SHA_BEFORE == SHA_AFTER（worktree-crlf 形态）⇒ DIFF_BYTES_AFTER_RESTORE=0
⇒ MARKER_RG_EXIT=1（注入标记零残留）⇒ 复跑 GREEN_TEST_EXIT=0（12/196）
```

| 轮 | 注入点位 | 点名 | SHA（`worktree-crlf`） |
|---|---|---|---|
| round-02 / owner-1 | `ai-chat.vue:448` App 分支注回 `getFileSystemManager` | G1 | `a9e87c90d3892a98346f25b5757daf2b64fe39efc01f953274d52816170b9725` 前后相等（**两方逐字同值 ⇒ 互证**） |
| round-03 / owner-2 | `ai-chat.vue:639` 非 H5 注回 `new AbortController()` | G2 | 同上 |
| round-04 / owner-3 | `ai-chat.vue:208` 摘 `<custom-tab-bar>` | G6 | 同上 |
| round-05 | `ai.ts:358` 摘 `registerCancel` 注册 | G8 | `28ae2973a8001b960ffec54cc9bf497648b53cadd925e628a568d7c15e17f0c3` 前后相等 |
| round-01 | 同 round-02 | G1 | **SHA 段自作废**：驱动 `REL` 漏 `src/` ⇒ 备份/哈希作用在不存在的文件上 ⇒ 空串判等造出 `SHA_MATCH=1` 假对称；执行方自检并登记（`anti/round-01:50-60`），另立 round-02 |

> 目标文件不同 ⇒ SHA 值不同属正常（round-05 打的是 `ai.ts`）。台账每轮都标注入目标，避免被误读成「复原没成功」。

## 3. H5 实开 —— 任务书 §三「底栏只一层，发送 / 停止生成 / 附件读取均有运行证据」

**装置**：`mock-ai-backend.mjs`（SSE 分片可配 `intervalMs/events`，客户端掐流时服务端打 `CLIENT CLOSE after N events (remaining M events NOT sent)`）。端口隔离：执行方首轮 8388、续办轮 8199 + dev:h5 5199（`raw/31·32·33`）；负责人 8299 + 5299（`raw/71·73`）。`app-mobile/.env` 为 gitignored 取证配置，构建与入库前一律移树外。

负责人 `raw/73` 分段：`§0` 夹具就绪 / `§①` 登录 / `§②` 底栏单层 / `§③` 停止生成两侧同取 / `§④` 对执行方作废读数的重挂载判定 / `§⑤` 完整收流 / `§⑥` 附件读取 / `§⑦` 控制台 / `§⑧` 越面发现（跨卡 `vundefined`）/ `§⑨` 与 `raw/34` 的两方对照表。

**最关键的一行（判据「停止生成不是只改 UI」）**：

```
客户端  raw/73 §③  点 .ai-stop-btn（15:53:12 前后）⇒ taDisabled true→false
服务端  raw/71:17-20  POST /api/chat interval=300ms events=200
                       SSE sent 10/200 → sent 20/200
                       SSE CLIENT CLOSE after 22 events (remaining 178 events NOT sent)
重挂载  raw/73 §③  location.reload() 后 DOM 实得 22 片 == 服务端已发 22 片
执行方独立同形（互不引用）：raw/34 §④  客户端 19 片 / 服务端 remaining 181
```

## 4. 偏差与未收口登记（如实，不替它补话）

1. **三端真机运行未验**：无设备、无微信开发者工具。mp-weixin / App 只有静态守卫（G1/G1b/G2/G10）+ 产物剥离机检 + H5 实开；`RequestTask.abort()` 与 `plus.io` 真机行为均无运行证据。
2. **微信原生 `custom-tab-bar/` 目录不产出**：`ls -d mp-weixin/custom-tab-bar` → `LS_EXIT=2`（`raw/61`、`raw/41` 同点）。现口径 = `custom:true` + 每页挂 `components/custom-tab-bar.vue`（本仓 5 个 tab 页统一），本卡未新增原生目录 ⇒ 是否必须补，**待裁**。
3. **mp-weixin 撞名警告在册**：`raw/40:40`（负责人复跑 `raw/60` 同条）「组件 `<custom-tab-bar>` 是 H5 平台专用组件，在 mp-weixin 平台使用可能导致错误」。重命名波及 5 页 + 组件，超本单收口面 ⇒ 未动。
4. **存量渲染滞后（非本卡引入）**：`ai-chat.vue` push 对象字面量后回调改原始对象（`:716/:719`）未经 proxy ⇒ DOM 停旧值。`git show bc1087ee:…` 同形写法在 `:546/:552/:611` ⇒ 基线态即存在。修法要动页面业务流，与本单红线冲突 ⇒ 只登记（回传卡 §八.1）。**它解释了执行方 `raw/34 §⑤` 那条一度无法判定的作废读数**（负责人 `raw/73 §④` 重挂载实验判明状态正确、渲染未发生）。
5. **执行方 round-01 假对称 SHA**：该行保留在台账中不删（§2），因其是自检出、自作废、另立重跑的正例。
6. **负责人 `raw/74` 首次收尾读数互斥**：「已无监听」与 `H5_HTTP=200` 同段并存，且 `curl -w '%*'` 非法占位符 ⇒ 按协议「互斥读数一律作废」重取，原文不改写、追加更正段。根因：`TaskStop` 只杀 npm 父进程，vite/uni 子进程存活。
7. **负责人 §⑤ 一次选择器猜错**：`.voice-btn/.speak-btn` 两类名树内不存在 ⇒ `speakBtns:0` 记为读数失误，不折算成「播报按钮未渲染」（`raw/73 §⑤` 内已就地标注）。
8. **跨卡复现证据（不属本卡管辖）**：`raw/73 §⑧` 在不含 QODER-24 改动的 `bc1087ee` 基线态实测到「新版本 **vundefined**」提示 + mock `GET /api/app/version/app_mobile` FALLBACK。推断 QODER-24 严格 semver 解析会使症状消失（未在本树验证 ⇒ 不得当实测引用）。

## 5. 本笔（文档笔）纳入的文件

逐文件 `git add`（33 条路径逐一列出，无 `git add -A`）：

- **文档笔 `350b3132`**：`docs/evidence/qoder-25/` 31 份读数件中的 30 份 + 本 README + `docs/tasks/cards/R101-QODER-25-回传.md` + `docs/tasks/inbox/ACTIVE-回执-QODER-25.md` = 33 files changed, 2534 insertions(+)、0 deletions
- **收口笔（本件）**：`raw/75-owner-docs-commit-close.log` + 本 README 的 §0/§6.1 追加

不入库件：`app-mobile/.env`（gitignored，取证配置，构建前已移树外）、`app-mobile/dist/`（构建产物）、树外夹具 `/d/Users/ZXQL/wt-agents/_qoder25_ownverify/`。

## 6. 负责人复验补笔（2026-10-22T00:08+08:00）

本 README 与两份文档由负责人撰写；负责人亲测的读数已在 §1（四门/三构建/产物/后端差值）、§2（三轮反测含 SHA 与残留机检）、§3（H5 两侧互证）逐条与执行方同名读数并列，两方一致项才写入。

### 6.1 文档笔入库后的终态实测（原始输出 `raw/75-owner-docs-commit-close.log`，2026-10-22T00:11:28+08:00）

| 项 | 值 |
|---|---|
| 文档笔提交 | `350b31328879100ac2c517a2e10a56fd9b5ba547`（33 files changed, 2534 insertions, 0 deletions ⇒ 全为新增） |
| 谱系 | `350b3132` → `5b90a744`（实现笔）→ `bc1087ee`（任务书基线） |
| `git status --porcelain` | 空（该次取数时唯一未跟踪项正是本次正在写入的 `raw/75` 自身，故 `STATUS_LINES=1`；写它之前为 0 行） |
| `git diff bc1087ee..HEAD -- backend/ \| wc -c` | `0` |
| `git diff --name-only bc1087ee..HEAD` | 6 个代码面文件（`gates-baseline.json`、`App.vue`、`ai.ts`、`custom-tab-bar.vue`、`ai-chat.vue`、`ai-cross-platform.spec.ts`）+ 33 个 docs 件 ⇒ 代码面自实现笔起零变化 |
| `app-mobile/.env` | 不在树内（`ls` → `No such file or directory`，`ENV_LS_EXIT=2`）⇒ 取证配置未入库、未影响产物 |

文档笔不含任何 `src/`、`tests/`、`scripts/` 改动 ⇒ §1 的四门与三构建读数（在实现尖端 `5b90a744` 上取得）对本次收口仍然有效，无需重跑；此判断的依据是上表「代码面零变化」这一机检，而非默认。

