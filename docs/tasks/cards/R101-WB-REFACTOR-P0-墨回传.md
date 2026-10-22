# R101 · WB-REFACTOR-P0 回传卡

```
【汇报 WB-REFACTOR-P0】工作台双模式重构四张矩阵盘点
汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-22
执行通道：WorkBuddy
交付物：9 个文件，全部落在提交 3b8dd8a0（见 §二）
证据（可复跑）：见 §三
验收自评：见 §四（硬验收 5 条：4 通过 / 1 部分通过）
未完成与阻塞：见 §五
风险与自我报备：见 §六
回传要求：本汇报已落卡 docs/tasks/cards/R101-WB-REFACTOR-P0-墨回传.md
关联卡：docs/tasks/inbox/WB-REFACTOR-P0.md
```

> 基线 `7dda80b8`｜分支 `docs/wb-refactor-p0-inventory`｜工作树 `D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0`
> **未 push、未开 PR、未 `git add -A`（逐文件 add 9 次）、工作树 clean。**

## 一、结论先行

1. **双模式的前提条件目前不成立**：人工侧菜单是**前端硬编码**（`MainLayout.vue` 12 组 / 71 项 + 收银台 9 项），
   后端 `GET /api/admin/menus/user` 真实存在，但 **admin-web 调用点 0 处**；
   后端 163 个唯一 `menuCode` 中**仅 10 个**能与前端路由对齐（菜单类 89 条中也只有 10 条）⇒ P3 的「动态菜单」现在是硬缺口。
2. **AI 侧不是"缺接口"，是"接口有、前端不接"**：19 项 AI 能力 **LIVE 1 / PARTIAL 12 / PLANNED 6 / BLOCKED 0**。
   底座端点大多真实存在，但 `AiChatWindow.vue` 引用 0 处、三个 AI 封装函数写了没人调、收银模式直接隐藏 AI 面板。
3. **权限与审计是最大风险面**：被页面真实调用的 254 条写动作里，**无权限码 57 条（22.4%）、无审计 217 条（85.4%）**；
   全量写路由无码比例 **45.8%（336/733）**；`hasPermission` 定义存在但**全仓调用点 0 处**。
   ⇒ 在这个底子上给 AI 开写动作，等于把「同租户任意登录用户可写 + 无留痕」扩大到代理面。
4. **AI 工具与现网动作面几乎不重叠**：底座注册 84 个工具、自报 method/path 59 条，只覆盖 254 条写动作中的 **26 条（10.2%）**。
5. **页面现状不能洗**：157 页中 P0 冒充 LIVE 1 / P1 部分假 48 / P2 纯占位 3 / P3 干净 97 / UNKNOWN 8；
   **运行态全部未验**（无 `node_modules`，未 build、未起服务、未在浏览器打开）。

## 二、交付物（9 文件 · 提交 `3b8dd8a0`）

| 文件 | 规模 | 内容 |
|:--|:--|:--|
| `docs/evidence/WB-REFACTOR-P0/10-route-menu-matrix.md` | 1181 行 | 164 路由声明 / 155 唯一页面组件（去重全集 158，剔 3 个非页面）/ 5 `meta.hidden` / 85 非菜单路由 / 79 菜单可见；SECTORS 13 版块 103 基础二级页 + 24 fuse = 127；双向差集：**原型有现网无 24（且这 24 页对应组件文件盘上存在 0 个）**、**现网有原型未列 61**；`menuCode` 冲突与缺失全表；表 A/B1/B2/C 的 CSV 与 JSON:SUMMARY |
| `docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md` | 89 行 | 19 行明细 = LIVE 1(#8) / PARTIAL 12 / PLANNED 6 / BLOCKED 0；含盘点级事实：工作树内 `backend/ai-base` **不存在**，而 `docker-compose.yml:71-74` 的 build context 正是它 |
| `docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md` | 530 行 | 前端封装 687（25 文件）/ 后端路由 1454（189 文件，GET 721 + 写 733）/ views 157 / 封装调用点 716；写动作 254 条逐条（66 域）+ 读操作按 89 域合并 + 每域小计；机制实测 `requirePermission` 390 + `requirePlatformPermission` 38 + 常量挂码 24 |
| `docs/evidence/WB-REFACTOR-P0/40-page-quality-ledger.md` | 485 行 | 157 页逐页台账 + TSV 机读 + 脚本 COUNTS；唯一 P0 = `views/components/PlatformPanel.vue:239/266/282`（`Math.random()>0.3` 把连接测试伪造成成功）；占位 3 处；恒空候选 38 页 / 静默失败 12 页；21 条 `[DEV_NOTE]` 注释线索（8 条 `// === Mock 数据 ===` 段头、3 条自证「未实现 / 无数据源 / 暂未」） |
| `docs/evidence/WB-REFACTOR-P0/50-reverse-test-log.md` | 225 行 | 反测原始输出（本轮新增） |
| `scripts/parse-routes.cjs` | 35631 B | 矩阵10 复算器；本轮**新增 `--strict`**（差异非 0 ⇒ `STRICT_FAILED` + EXIT=1） |
| `scripts/parse-actions.cjs` | 50507 B | 矩阵30 复算器 |
| `scripts/parse-page-quality.cjs` | 38850 B | 台账40 生成器；本轮**移除产物内绝对临时路径与 `ELAPSED_MS`**、并把收口补记纳入生成器 |
| `scripts/verify-inventory.cjs` | 19871 B | 合计↔明细机读校验器（42 项）+ `--selftest` 反测 + `--strict` 门禁 |

## 三、证据（可复跑）

### 3.1 四张矩阵自证（合计 ↔ 明细 ↔ 脚本三方对账）

```bash
node docs/evidence/WB-REFACTOR-P0/scripts/verify-inventory.cjs --strict
```

```
总计 42 项，FAIL 0 项。          EXIT=0
M20：条数 1/12/6/0、行号集合互斥且完整覆盖 #1…#19、总数=明细行数=19
M30：写 254 = stdout、读域 89、66 域小计求和=254、无码求和=57、审计 217+22+15=254
L40：157 行 = 摘要 = TSV = COUNTS（五档逐项相等）、ROUTES_CSV_ROWS=164 对齐矩阵10
M10：路由表 164 行；文档 ↔ 脚本 6 项读数逐项一致
ALL：四表列数对齐且无空格子
```

### 3.2 反测（造错必红 / 复原必绿）· 7 例

```bash
# 路由维度（工作树外沙盒造错）
node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --root <沙盒> --strict
```

| 维度 | 造错 | 结果 |
|:--|:--|:--|
| 路由（矩阵10） | 删 `router/index.ts:102` 一条声明 | `164→163`、`155→154`、**`PROTO_PAGE_MISSING_IN_ADMIN 24→25`**、`PROTO_MISSING_WITH_COMP_FILE 0→1`，`STRICT_FAILED=2` **EXIT=1**；复原后与基线逐字节一致、EXIT=0 |
| AI 能力（矩阵20） | 抽掉第 8 行（唯一 LIVE） | 变红 1 项（`M20.detailTable`）；复原 0 项 |
| AI 能力（矩阵20） | `LIVE`→`PARTIAL` 翻转 | 变红 4 项（LIVE/PARTIAL 的条数 + 行号集合）；复原 0 项 |
| AI 能力（矩阵20） | 合计表行号漏写 | 变红 2 项；复原 0 项 |
| 动作·权限（矩阵30） | 摘 `admin-customer.routes.ts:16` 的 `requirePermission("customer:create")` | **`WRITE_ACTIONS_NO_PERM 57→58`**、有码 182→181、`REQUIRE_PERMISSION_TOKENS 390→389`；复原后逐字节一致 |
| 动作·权限（矩阵30） | 改 `api/customer.ts:276` 封装函数名 | **`VIEW_WRAPPER_CALL_SITES 716→715`**、`WRITE_ACTIONS_VIEW_CALLED 254→253`，DTO/审计列联动；复原一致 |
| 页面质量（台账40） | 唯一 P0 改判 `P3 干净`（洗绿） | **4 项同时报警**（摘要/明细/COUNTS 三处互锁）；复原 0 项 |

矩阵10 的 T1/T2/T3（子代理跑：删 `/dashboard`、改坏 `navTo` 路径、原型文件不可读）与本轮 T4/T5 一并记在
`10-route-menu-matrix.md` §8 与 `50-reverse-test-log.md`。

### 3.3 确定性

```
台账40 同输入连跑两次：cmp 通过，SHA1 相同（f6d67dbc0e50dd95e9de042314886866a7129651）
```

### 3.4 关键行号（已逐条 grep 复核）

| 声称 | ref |
|:--|:--|
| admin-web 调用 `/menus/user` **0 处** | `parse-routes.cjs` 全仓扫描 `ADMIN_WEB_CALLS_MENUS_USER=0` |
| `hasPermission` 定义有、调用 **0 处** | `admin-web/src/stores/app.ts:18`（唯一另一处 `:28` 是 store return 裸标识符） |
| 唯一 P0 假成功 | `admin-web/src/views/components/PlatformPanel.vue:239`（另 `:232/:256/:266/:282`） |
| 收银模式隐藏 AI 面板 | `admin-web/src/layouts/MainLayout.vue:344` |
| `AiChatWindow.vue` 引用 0 处 | 仅 `components/AiChat/index.ts:4` barrel 再导出，无消费方 |
| `backend/ai-base` 不存在但 compose 指向它 | `docker-compose.yml:71-74` |
| 底座 `daily_briefing` 定时任务真实存在 | `ZXQL-AI/src/brain/proactive/daily-briefing.service.ts:38-41` |

## 四、验收自评（逐条）

| 硬验收 | 自评 | 依据 |
|:--|:--|:--|
| 只改 `docs/evidence/WB-REFACTOR-P0/**`，业务代码与现有页面零改动 | **通过** | `git status` 提交前只有 `?? docs/evidence/WB-REFACTOR-P0/`；提交 9 个文件全在该目录；`admin-web/**`、`backend/**`、路由、布局一字未动 |
| ↑ 口径说明（不隐瞒改动面） | **有意越界 2 个文件** | 除 9 个证据文件外，本轮另改 `docs/tasks/cards/R101-WB-REFACTOR-P0-墨回传.md`（本卡，由 §回传格式「本汇报已落卡…」直接要求）与 `docs/tasks/current-tasks.md`（追加一段交付记录，未删他人行）。硬验收那句保护的是**业务代码与现有页面**，任务账文档本身是回传通道要求的落点；两者均为纯新增，请凌舟如认为越界可要求回退。 |
| 每条矩阵行有文件/路由/接口/组件或 `UNKNOWN` 明示，不得留空 | **通过** | `verify-inventory.cjs` 的 `ALL.明细无空格子/列数对齐`（四表全部行列对齐、无空格）；矩阵30 另用 `UNKNOWN` 显式标注 15 条接线不明 |
| 机器复算：路由清单数量与解析脚本一致；AI 能力状态合计与明细一致 | **通过** | M10 6 项文档↔脚本逐项 0 差异；M20 条数/行号集合/总数/无重无漏 12 项全绿 |
| 给出下一轮 P1 建议范围，但不得自行开工 | **通过** | 建议范围见 §五.1；本单**未写任何壳层代码、未建 `WorkbenchShell`** |
| 反测：抽掉一条，脚本必须报差异；复原后通过 | **部分通过** | 路由侧已做成 **EXIT=1 硬门禁**（本轮补 `--strict`）；AI 能力/权限/洗绿侧为「造错必红 + 复原必绿」7 例全过。**未做的部分**：矩阵30 自检验例②（加 `INSERT INTO t_operation_log` ⇒ 审计「无」变「有」）未单独跑；台账40 的运行态反测（真起页面验 P0）未做 |

## 五、未完成与阻塞

### 5.1 下一轮 P1 建议范围（**本单不动手，等凌舟派发**）

建议 P1 = **壳层骨架 + 路由白名单**，把「动态菜单」和「AI 写动作」往后压：

1. `WorkbenchShell.vue` + feature flag 新旧壳切换；人工模式直接挂现有 `<router-view>`，**页面零改动**（对齐 R101 §七）。
2. `route-manifest.ts`：先做 **menuCode → routeName → component 白名单**，范围就是实测的 12 组 / 71 项 + 收银 9 项；
   **暂不接** `/api/admin/menus/user` 动态菜单——因为 163 码仅 10 可对齐，现在接上就是 fail-closed 空菜单（R101 §6.2 要求失败关闭，则首屏直接没菜单）。
3. AI 模式只做骨架（导航 rail / 会话面板 / 信息流容器），能力面按矩阵20 的 **1 LIVE + 12 PARTIAL** 接，6 条 PLANNED 保留入口并显示「待接入」。
4. **写动作确认链留到 P2 之后**，且前置条件 = 矩阵30 缺口①（写接口无码 45.8%）与缺口②（前端无按码显隐）先收敛；否则 AI 与人工同享「无码 + 无审计」的写口。
5. P1 期间把 `git status` 干净 + `verify-inventory --strict` 作为回归基线，壳层改动不得让四张矩阵的守恒变红。

### 5.2 阻塞 / 需凌舟裁定（6 项）

1. **`menuCode` 口径归一**：153/163 条不可对齐。改菜单种子迁移、还是改前端 route manifest？谁负责？
2. **`backend/ai-base` 源码归属**：工作树内目录不存在，`docker-compose.yml:71-74` 却指向它，回退路径已失效。是确认「只从独立仓 `ZXQL-AI` 构建」并删掉 compose 里的假回退，还是把内嵌源码重新纳回本仓？
3. **收银台 AI 面板被隐藏**（`MainLayout.vue:344`）：冻结规划要求「收银台 AI 预警弹窗」保留，现网实现是整块隐藏。属 P2 需求还是现状即口径？
4. **唯一 P0 页 `PlatformPanel.vue`**：属页面自身质量缺陷（R101 §五 明示不由壳重构洗绿）。是否单独开修单？
5. **S3-240 D4 前端补门**：凌舟口径「已做完，不重复」。但矩阵30 实测 `hasPermission` 全仓 0 调用点，与该单的交付分支（未合入 main）互证 ⇒ 请确认「已做完」是否等于「已进 main 并生效」。
6. **矩阵30 例②反测**：要不要补跑（沙盒加一句 `INSERT INTO t_operation_log` ⇒ 审计列由无变有）。

### 5.3 无阻塞项

无。

## 六、风险与自我报备

1. **P0 未解除的最大风险 = 写动作无权限码 + 无审计**（45.8% / 85.4%）。若 P2 先做 AI 写动作，会把这条缺口从「人工可越权」放大成「AI 代理可越权且无留痕」。我在 §五.1.4 明确把它压到权限收敛之后。
2. **台账40 不能当验收用**：157 页全部**未运行态验证**。P0/P1/P2 共 52 页需真实环境逐页眼验；任何人引用本台账得出"页面已可用"都是误读。
3. **自我报备 · 数字口径更正**：我在收口前的中间汇报里写过「12 条自证后端未实现」，**实测为 3 条**（21 条 `[DEV_NOTE]` 中 3 条命中「未实现 / 无数据源 / 暂未」，另 8 条是 `// === Mock 数据 ===` 段头）。本卡用的是实测值。教训同既往纪律：引用子代理数字前必须自己 grep 复核。
4. **自我报备 · 署名误述已纠**：矩阵20 落款原写「阿潵通道」，阿潵是移动端负责人、与本工作台交付无关，已按「不同窗口、不同职责」更正为本单署名口径（墨 / 工作台执行子代理）。
5. **反测沙盒等价性局限（如实）**：造错是在工作树外副本 `wbsbx`（994 文件）做的。它**完整复现**了 5 个头条读数（254 / 57 / 336 / 716 / 217-22-15），但 `WRITE_ACTIONS_DTO_FOUND` 沙盒 170 vs 工作树 173、矩阵10 的 `BACKEND_MENU_CODES_PARSED` 沙盒 110 vs 工作树 201 —— 因沙盒未复制全部后端与 CJK 名迁移文件（`docs/migrations/079_权限矩阵.sql`）。⇒ **红/绿结论成立，但沙箱读数不是权威值，权威值以工作树运行为准。**
6. **行尾差异会伪装成内容差异**：本仓 `core.autocrlf=true` 且 `.gitattributes` 只钉了 `*.sh text eol=lf`。9 个交付物 `git ls-files --eol` 现为 `i/lf w/lf`（提交内容与工作副本一致），但**换机 checkout 会得到 `w/crlf`** ⇒ 跨机比较请用 `git show` 取 index blob，不要拿工作副本哈希当「逐字节一致」的证据。我在 §3.3 的 SHA1 是**脚本直接产出**的一致性，不是 git round-trip 的一致性。
7. **未 push、未开 PR**：分支 `docs/wb-refactor-p0-inventory` 目前只有本地提交 `3b8dd8a0`，需要凌舟审阅后决定是否入主线。
8. **时间盒**：卡上写 P1·90 分钟。实际跨多轮，主要耗在（a）两个子代理撞 max-turn 需重派并改为脚本批抽、（b）markdown 表格因内联代码里的 `|` 破列、（c）反测从「只打印」补成「EXIT=1 门禁」。**超时如实报备**，未擅自压缩验收项来凑时间。
