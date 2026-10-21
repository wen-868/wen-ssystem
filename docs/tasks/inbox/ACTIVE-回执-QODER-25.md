# ACTIVE-回执 · QODER-25（AI Chat 三端条件编译与自绘 tabBar MO-17/18）

【汇报 QODER-25】AI Chat 三端条件编译与 tabBar —— 六条交付物落地，四门与三构建 EXIT=0，H5 实开拿到「停止生成 = 服务端真掐流」两侧互证；mp-weixin / App 真机未验。
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
关联卡：docs/tasks/inbox/QODER-25-ai-cross-platform.md
落卡：docs/tasks/cards/R101-QODER-25-回传.md
工作树 / 分支：`D:\Users\ZXQL\wt-agents\QODER-25` / `fix/qoder-25-ai-cross-platform`
基线：`bc1087ee`（实测为 `5b90a744` 的第 1 父）

分工口径：实现笔 `5b90a744` 与其 `raw/10·11·12·20·30·31·32·33·34·35·40·41·50`、`anti/round-01…05` 日志出自**执行方子代理会话**；本回执、回传卡、证据 README 与 `raw/60·61·71·73·74`、`anti/60-owner-*` 读数由**负责人本人**产出（执行方证据齐备后中断，文档段由负责人补做）。

## 一、交付物（逐条，含文件路径 + 提交哈希）

提交：`5b90a744e76702aac4372ba91ac0849390dc4069`（6 文件 +497/−40）

1. 图片读取按端分派 — `app-mobile/src/pages/ai-chat/ai-chat.vue:420-486`（H5 `:425` fetch+FileReader `:429` / MP `:436` `uni.getFileSystemManager` `:438` / APP-PLUS `:446` `plus.io.FileReader` `:452` + `resolveLocalFileSystemURL` `:463`）；播报取文件路径同形分派 `:887 / :892 / :914`
2. 中止模型按端收口 — `app-mobile/src/api/modules/ai.ts:335-337` `AiChatControls`、`:348-358` 按端派发、H5 `:194/:239` `signal`、非 H5 `:262/:306-316` `registerCancel` + `task.abort()`、`:297` 用户中止终态；页面 `ai-chat.vue:261-265/:587-605/:638-641/:666-673/:722-727`，拿不到句柄时 `:612` 明确 toast 而非假停
3. MP 播报确定行为 — `ai-chat.vue:956-957` → `:990-991 notifyMpSpeakUnsupported()`（toast「小程序暂不支持系统语音播报」），TTS 失败出口 `:908/:911` 同落该函数
4. AI 页挂载自绘栏 + 微信端核实 — `ai-chat.vue:208` 模板、`:223` 导入；隐藏口径 `App.vue:11-15` 与 `custom-tab-bar.vue:96-100` 统一 `#ifndef MP-WEIXIN`；核实结论：产物 `app.json` 保留 `"custom": true`、AI 页 wxml 含 `<custom-tab-bar>`，但**微信原生 `custom-tab-bar/` 目录不产出**（`LS_EXIT=2`）⇒ 真机表现未验、是否补目录待裁
5. 静态配对守卫 — `app-mobile/tests/ai-cross-platform.spec.ts`（250 行 / 1 describe / 10 it / 24 expect；G1·G1b·G2·G3·G4·G6·G7·G8·G9·G10；导入期读源码 `:105-109`、`:167`）
6. 反测逐项摘除 — 执行方 round-02/03/04/05 有效（round-01 SHA 段自作废并另立），负责人独立复跑 owner-1/2/3；三轮共同 SHA `a9e87c90…b9725` 两方逐字相同

## 二、证据（可复跑）——命令 + 原始输出摘要 + 行号

```
$ npm --workspace app-mobile run check:gates
  vue-tsc EXIT=0，当前错误 0 条，基线 0 条                      raw/60:15
  当前 error 0（基线 0）、warning 12872（基线 12872）            raw/60:22
  Test Files 12 passed (12) / Tests 196 passed (196)             raw/60:53-54
  —— test 门：当前 12 文件 / 196 用例，基线 12 / 196 ——          raw/60:58
  契约 ①292 ②283 ③204 / 后端注册 1498 / 差集 1（具名豁免 1）      raw/60:65-69
  GATES_EXIT=0                                                  raw/60:72
  （执行方同尖端一致：raw/30:4,14,21,52-53,57,64-68）

$ npm --workspace app-mobile run build:{h5,mp-weixin,app}
  BUILD_EXIT_h5=0 / BUILD_EXIT_mp-weixin=0 / BUILD_EXIT_app=0    raw/60
  执行方同尖端：raw/40:25 / :43 / :63
  mp-weixin 期警告原文：raw/40:40（<custom-tab-bar> 撞 uni 内置名）

$ 产物按端机检（每条带 RG_EXIT 原值，不用管道尾码）              raw/61
  H5: pages-ai-chat-ai-chat.BieDSea6.js + custom-tab-bar.C-imRqs-.js；停止生成=1
  H5: getFileSystemManager RG_EXIT=1；小程序播报文案 RG_EXIT=1
  MP: ai-chat.wxml custom-tab-bar=1；app.json "custom": true；custom-tab-bar/ 目录 LS_EXIT=2
  MP: getFileSystemManager RG_EXIT=0（应保留）
  App: plus.io.resolveLocalFileSystemURL 命中 app-service.js；停止生成=1
  App: uni.getFileSystemManager RG_EXIT=1；小程序文案 RG_EXIT=1

$ 反测（负责人独立三轮）                                        anti/60-owner-anti-{1,2,3}
  PRECHECK_DIFF_BYTES=0 / INJECT_HIT_COUNT=1(448·639·208) / INJECT_EXIT=0
  TEST_EXIT=1 且点名 G1 / G2 / G6；SHA_BEFORE==SHA_AFTER==a9e87c90…b9725
  DIFF_BYTES_AFTER_RESTORE=0 / MARKER_RG_EXIT=1 / GREEN_TEST_EXIT=0（12/196）

$ H5 实开（负责人装置：mock 8299 / dev 5299）                    raw:71·73
  底栏单层：customTabBarNodes=1 (display:block,z999)；uni-tabbar display:none (z998)   raw/73 §②
  真中止：客户端点 .ai-stop-btn ⇒ 服务端「SSE CLIENT CLOSE after 22 events (remaining 178 events NOT sent)」 raw/71:17-20
  完整收流：interval200/events8 ⇒ 「SSE DONE after 8 events」，重挂载后全文 30 片、两行入 !streaming 态      raw/73 §⑤ / raw/71:32-34
  附件：srcLen=118、前缀 data:image/png;base64,iVBORw0KGg 与注入 PNG 同源、attachFailText=false              raw/73 §⑥
  控制台 3 条、无 error 级                                                                                     raw/73 §⑦
  执行方独立同形读数（客户端 19 片 / remaining 181）：raw/34 §④

$ git diff bc1087ee..HEAD -- backend/ | wc -c   → 0        raw/50:29 与 raw/60 末段两度一致
$ git diff --name-only bc1087ee..HEAD          → 6 文件    raw/50:34-41
```

## 三、验收自评（任务书 §三 硬验收逐条；自评 + 依据，非裁定）

| 硬验收 | 自评 | 依据 |
|---|---|---|
| `check:gates` EXIT=0 | 通过 | 负责人亲跑 `raw/60:72`（12/196、error 0），执行方同值 `raw/30:4` |
| 三构建均 EXIT=0 且产物含 AI 页 / 自绘栏 | 通过 | `raw/60` 三 EXIT=0 + `raw/61` 逐端命中（附 `raw/41` 执行方复核） |
| H5 实开：底栏只一层 | 通过（H5） | `raw/73 §②`：自绘 1 层可见、原生 `display:none` |
| H5 实开：发送 / 停止生成 / 附件读取均有运行证据 | 通过 | `raw/73 §③ §⑤ §⑥` + 服务端 `raw/71`（停止为两侧同取） |
| `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean | 通过 | 0 字节两度实测；文档入库后 porcelain 空 |
| 三端真机运行 | **未验（不许当通过）** | 无设备 / 无微信开发者工具；任务书 §四 明令不得以构建折算 |

## 四、未完成与阻塞

1. mp-weixin / App / H5 三端**真机**运行未验（无设备、无开发者工具）；`RequestTask.abort()`、`plus.io` 可读路径、MP 播报提示均只有静态守卫与产物剥离证据。
2. 微信原生 `custom-tab-bar/` 目录不产出（`raw/61` LS_EXIT=2）：现口径为「`custom:true` + 每页挂自绘组件」，是否须补原生目录待裁。
3. mp-weixin 构建对 `<custom-tab-bar>` 的撞名警告在册（`raw/40:40`）：重命名波及 5 个 tab 页 + 组件，超本单收口面，未动。
4. H5 流式增量与终态不触发重渲染（**存量**，`bc1087ee:546/552/611` 同形）：修法要动页面业务流，与本单红线冲突 ⇒ 只登记，建议另立单。
5. 阻塞：无外部依赖阻塞。

## 五、风险与自我报备

1. 执行方 `raw/34 §⑤` 曾作废一条「点停止后仍显示 ■ 停止生成」且无法解释；负责人以重挂载实验判定为**状态正确、渲染未发生**（`raw/73 §④`），根因即上述存量缺陷。故「停止生成」判据以两侧同取的 `raw/73 §③` 为准，不作反例。
2. 体验风险仍在：用户点停止后当场 DOM 可能不变（数据已终态），建议随响应式修复单一并处理。
3. 取证夹具 `docs/evidence/qoder-25/mock-ai-backend.mjs` 为网络装置（非产品代码、不入 src）：只实现登录链 + `/api/chat` SSE + `/api/chat/models` + `/api/voice/tts`，其余 `FALLBACK 200 empty` ⇒ 证明的是前端行为，不代表后端契约。
4. 跨卡复现（不属本卡管辖）：H5 上「新版本 **vundefined**」提示在**不含 QODER-24 改动的基线态**可实测复现，伴随 `GET /api/app/version/app_mobile` 无版本字段（`raw/73 §⑧`）。推断 QODER-24 严格 semver 解析会使症状消失 —— 未在 QODER-25 树验证，不得当实测引用。
5. 执行方 round-01 的 `SHA_MATCH=1` 是空串判等造成的假对称，执行方自检后自作废该轮 SHA 段并另立 round-02；本回执保留该行不删。
6. 端口隔离：执行方 8388·5199 / 续办 8199·5199，负责人 8299·5299，全程与 QODER-26 并发卡错开，无串台（每条读数带 `url` 字段）。

## 六、红线对照

无 push、无 PR、无 `git add -A`（逐文件 add）、后端 0 字节、无 `typeof !== 'undefined'` 吞错（G9 固化）、未以构建折算运行、未改 AI 协议/模型参数/页面业务流。

## 七、复现与落点

复现命令与待裁/建议派单清单见 `docs/tasks/cards/R101-QODER-25-回传.md` §十；证据树入口 `docs/evidence/qoder-25/README.md`。

## 八、负责人复验补笔（2026-10-22，追加不改写）

本回执即为负责人补做件（执行方未产出任何文档）。负责人亲跑内容：四门 12/196 与三构建 EXIT=0（`raw/60`）、逐端产物剥离机检（`raw/61`）、三轮反测含 SHA 与残留机检（`anti/60-owner-*`）、H5 独立实开与两侧互证（`raw:71/73`）、装置收尾复核（`raw/74` + 追加更正段）。收口实测（`raw/75-owner-docs-commit-close.log`）：文档笔 `350b3132`（33 files / +2534 / −0）→ 实现笔 `5b90a744` → 基线 `bc1087ee`；`git status --porcelain` 空；`git diff bc1087ee..HEAD -- backend/` = 0 字节；代码面文件数自实现笔起保持 6 个不变（文档笔不含 `src`/`tests`/`scripts`）。
