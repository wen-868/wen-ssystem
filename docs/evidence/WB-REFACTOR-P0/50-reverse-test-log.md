# 反测记录 50 · WB-REFACTOR-P0 四张矩阵「造错必红 / 复原必绿」

> 执行人：墨（工作台负责人）｜2026-10-22
> 依据：`docs/tasks/inbox/WB-REFACTOR-P0.md` §三 硬验收末条「反测：从路由或 AI 能力源中抽掉一条，盘点脚本必须报差异；复原后通过」
> 与 `docs/tasks/cards/R101-工作台双模式重构-冻结与实施规划-凌舟-20261022.md` §九「质量门 · 反测」
> 工作树：`D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0`（分支 `docs/wb-refactor-p0-inventory`，基线 `7dda80b8`）

## 〇、结论先行

| 维度 | 造错方式 | 是否变红 | 报警读数 | 复原后 |
|:--|:--|:--|:--|:--|
| 路由（矩阵10） | 沙盒删 1 条路由声明 | **是**，`--strict` **EXIT=1** | `ROUTE_DECLARATIONS 164→163`、`唯一页面组件 155→154`，另有 8 项计数联动 | 与基线逐字节一致 |
| AI 能力（矩阵20） | 抽掉第 8 行（唯一 LIVE）/ 翻转状态 / 合计行号漏写 | **是**，3 例各报警 1/4/2 项 | `M20.detailTable`、`M20.LIVE 条数`、`M20.PARTIAL 行号集合` 等 | 42/42 全绿 |
| 动作·权限（矩阵30） | 沙盒摘 1 处 `requirePermission` | **是** | `WRITE_ACTIONS_NO_PERM 57→58`、`有码 182→181`、`REQUIRE_PERMISSION_TOKENS 390→389` | 与基线逐字节一致 |
| 动作·权限（矩阵30） | 沙盒改 1 个前端封装函数名 | **是** | `VIEW_WRAPPER_CALL_SITES 716→715`、`WRITE_ACTIONS_VIEW_CALLED 254→253` | 与基线逐字节一致 |
| 页面质量（台账40） | 把唯一 P0 页改判 P3（冒充「洗绿」） | **是**，4 项报警 | `L40.P0 冒充 LIVE 条数`、`L40.明细P0=COUNTS.P0` 等 | 全绿 |

⇒ **四张矩阵的读数器都不是假门禁**：任何一条源数据被抽掉或被人为改判，都会被抓出来，且报警的是对应那一项，不会静默通过。

## 一、口径与前提（先读，否则复跑不通）

1. **红线遵守方式**：本卡禁改业务代码。全部破坏性造错都在**工作树外的沙盒副本**
   `C:\Users\XIONG\AppData\Local\Temp\wbsbx`（`admin-web/src` + `backend/src` + `docs/migrations` 三源，994 文件）里做；
   工作树内 `admin-web/**`、`backend/**` **一字未动**（`git status` 只有 `?? docs/evidence/WB-REFACTOR-P0/`）。
2. **备份一律放沙盒外**（`C:\Users\XIONG\AppData\Local\Temp\wb-*.bak`）。
   原因：备份留在 `admin-web/src/router/` 里会被脚本的目录扫描看见，污染复算 —— 这是本轮踩过的坑。
3. **矩阵20/40 的反测对象是 markdown 产物本身**（合计 ↔ 明细的守恒），
   矩阵10/30 的反测对象是**源数据**（路由文件 / 后端路由 / 前端封装）—— 两侧都覆盖，才算「路由或 AI 能力源」。
4. Node 在 Windows 下把 `/tmp/...` 解析成 `D:\tmp\...`（ENOENT）。复跑请用绝对路径
   `C:/Users/XIONG/AppData/Local/Temp/...`，或改用仓库内目录。

## 二、反测① 路由维度（矩阵10 / `parse-routes.cjs`）

沙盒基线读数（与工作树权威读数在**路由维度完全一致**）：

```
ROUTE_DECLARATIONS=164
UNIQUE_COMPONENT_FILES_PAGE_ONLY=155
MENU_ITEM_COUNT=71
PROTO_PAGE_MISSING_IN_ADMIN=24
PROTO_MISSING_WITH_COMP_FILE=0
```

造错：删 `admin-web/src/router/index.ts` 第 102 行整条路由声明
（`{ path: "quick-entries", name: "quick-entry-config", component: …/views/dashboard/QuickEntryConfig.vue, … }`）。

```bash
node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --root "<沙盒>" --strict
```

原始输出摘要（节选）：

```
ROUTE_DECLARATIONS: 卡=164 实=163 差异=-1
UNIQUE_COMPONENT_FILES_PAGE_ONLY: 卡=155 实=154 差异=-1
PROTO_LV2_BASE: 卡=103 实=103 差异=0
PROTO_FUSE_PAGES: 卡=24 实=24 差异=0
STRICT_FAILED=2
DRIFT ROUTE_DECLARATIONS 卡=164 实=163 差异=-1
DRIFT UNIQUE_COMPONENT_FILES_PAGE_ONLY 卡=155 实=154 差异=-1
EXIT=1
```

联动读数（证明不是只改了一个孤立数字，而是整张图跟着动）：

| 读数 | 基线 | 造错后 |
|:--|--:|--:|
| `ROUTE_CHILDREN` | 160 | 159 |
| `ROUTE_WITH_NAME` | 163 | 162 |
| `ROUTE_WITH_ROLES_META` | 160 | 159 |
| `UNIQUE_COMPONENT_FILES`（含非页面） | 158 | 157 |
| `ROUTE_HIDDEN_TOTAL_NON_MENU` | 85 | 84 |
| `PROTO_PAGE_MATCHED` | 103 | 102 |
| `PROTO_PAGE_MATCHED_BY_NAME` | 49 | 48 |
| `PROTO_PAGE_MISSING_IN_ADMIN` | 24 | **25** |
| `PROTO_MISSING_WITH_COMP_FILE` | 0 | **1** |

后两行是本轮最有价值的一条：删掉这条路由后，原型侧立刻多出一页「原型有、现网无」，
且盘上真实存在的组件文件被识别为**未被路由挂载**（`QuickEntryConfig.vue` 成为孤儿文件）——
矩阵10 的双向差集是真的在起作用，不是写死的表。

复原：`cp` 回原文件 → 与基线 `diff` 除 `ELAPSED_MS` 外**逐字节一致**，`--strict` **EXIT=0**。

## 三、反测② AI 能力维度（矩阵20 / `verify-inventory.cjs --selftest`）

`verify-inventory.cjs` 是本轮新增的「合计 ↔ 明细」机读校验器（只读四份 markdown，不写盘）。
`--selftest` 把四份产物复制到 `os.tmpdir()` 独立目录后逐例造错 → 跑校验 → 复原 → 再跑校验：

```bash
node docs/evidence/WB-REFACTOR-P0/scripts/verify-inventory.cjs --selftest
```

原始输出：

```
# 反测（selftest）临时目录=C:\Users\XIONG\AppData\Local\Temp\wb-inv-selftest-MAfTpr
PASS 反测①抽掉矩阵20 第 8 行（AI 能力源少一条 LIVE）
      造错变红 1 项：M20.detailTable｜复原变绿 0 项
PASS 反测②翻转唯一 LIVE→PARTIAL（合计与明细错位）
      造错变红 4 项：M20.LIVE 条数, M20.LIVE 行号集合, M20.PARTIAL 条数, M20.PARTIAL 行号集合｜复原变绿 0 项
PASS 反测③合计表 PARTIAL 行号漏写 #8（留空口径）
      造错变红 2 项：M20.PARTIAL 条数, M20.PARTIAL 行号集合｜复原变绿 0 项
PASS 反测④台账40 把 P0 页改判 P3（冒充「洗绿」）
      造错变红 4 项：L40.P0 冒充 LIVE 条数, L40.P3 干净 条数, L40.明细P0=COUNTS.P0, L40.明细P3=COUNTS.P3｜复原变绿 0 项

SELFTEST_PASS（造错必红且复原必绿 4/4）
```

如实登记两点：

- 反测① 变红的那一项是 `M20.detailTable`（删行把两行粘成一行，表结构塌了，校验器直接拒绝认这张表），
  **不是**「条数少 1」。效果达成（造错必被拦），但报警点位不如条数直观；若要更精确的红，应删整行含换行符。
- 反测② 一次触发 4 项报警，是因为 LIVE/PARTIAL 两侧的「条数」和「行号集合」互相独立核对，符合预期。

矩阵20 的守恒复算（`verify-inventory.cjs` 正常模式）：

```
M20.LIVE 条数       合计=1  明细重算=1
M20.PARTIAL 条数    合计=12 明细重算=12
M20.PLANNED 条数    合计=6  明细重算=6
M20.BLOCKED 条数    合计=0  明细重算=0
M20.总数=明细行数   合计总数=19 状态条数之和=19 明细行数=19
M20.行号无重无漏    状态行号并集=1,2,…,19（应为 1…19）
```

## 四、反测③④ 动作·权限维度（矩阵30 / `parse-actions.cjs`）

沙盒基线**完整复现**矩阵30 头条读数（比矩阵10 更干净，此脚本无跨仓依赖）：

```
BACKEND_WRITE_ROUTES_NO_PERM=336
WRITE_ACTIONS_AUDIT_KINDS=无=217 | 有=22 | UNKNOWN=15
VIEW_WRAPPER_CALL_SITES=716
WRITE_ACTIONS_VIEW_CALLED=254
WRITE_ACTIONS_NO_PERM=57
```

**反测③（摘权限码）**：删 `backend/src/routes/admin-customer.routes.ts:16` 的 `requirePermission("customer:create")`。

```
BACKEND_WRITE_ROUTES_WITH_PERM=397 → 396
BACKEND_WRITE_ROUTES_NO_PERM=336   → 337
REQUIRE_PERMISSION_TOKENS=390      → 389
WRITE_ACTIONS_NO_PERM=57           → 58
WRITE_ACTIONS_WITH_PERM=182        → 181
```

⇒ 矩阵30 §5 自检里「删任一路由行的 `requirePermission(...)` ⇒ `WRITE_ACTIONS_NO_PERM` +1」**实测成立**。
这正是 R101 §九「权限四方同身份」那条门的可验证形态：少挂一个码，台账必须涨一条缺口。

**反测④（改封装函数名）**：把 `admin-web/src/api/customer.ts:276` 的 `createCustomerTag` 改名（`CustomerTags.vue:201` 调用点不动）。

```
VIEW_WRAPPER_CALL_SITES=716        → 715
WRITE_ACTIONS_VIEW_CALLED=254      → 253
WRITE_ACTIONS_WITH_CONTROLLER=228  → 227
WRITE_ACTIONS_DTO_FOUND=170        → 169
WRITE_ACTIONS_AUDIT_KINDS 无=217   → 216
schema-ref=59                      → 58
```

⇒ 「改封装函数名 ⇒ `VIEW_WRAPPER_CALL_SITES` 下降」**实测成立**，且 DTO / 审计列一并联动。

矩阵30 §5 自检验例②（给 controller 加一句 `INSERT INTO t_operation_log` ⇒ 审计由「无」变「有」）**本轮未单独跑**；
它与③同走「审计列由 controller→service 2 跳内文本命中驱动」这一条路径，属同一读数器分支，如实登记为未执行项（见 §七）。

复原：两个文件 `cp` 回原内容 → 重跑 → 与基线 `diff` **逐字节一致**（`M30_RESTORED_IDENTICAL`）。

## 五、反测⑤ 页面质量维度（台账40）

见 §三 selftest 反测④：把 `PlatformPanel.vue` 的 `P0 冒充 LIVE` 改成 `P3 干净`，
`L40.P0 冒充 LIVE 条数`、`L40.P3 干净 条数`、`L40.明细P0=COUNTS.P0`、`L40.明细P3=COUNTS.P3` **四项同时报警**
—— 摘要表、明细表、脚本 COUNTS 三处互锁，改任一处都会被另两处抓出来。
这条直接对应 R101 §五 红线「不得把页面现状洗成『完成』」：**洗绿在机器层就过不去**。

台账40 三方对账（正常模式，全绿）：

```
L40.逐页行数=摘要总页数        表 157 行 vs 摘要 157
L40.五档求和=总页数            1+48+3+97+8=157
L40.TSV行数=逐页行数           TSV 157 行 vs 表 157 行
L40.明细P0..UNKNOWN=COUNTS     1/48/3/97/8 五项逐一相等
L40.COUNTS.ROUTES_CSV_ROWS=矩阵10口径  164（与 ROUTE_DECLARATIONS 对齐）
```

## 六、顺带修掉的两个可复现性缺陷（均只改 `docs/evidence/WB-REFACTOR-P0/**`）

1. **`parse-page-quality.cjs` 把本机临时目录绝对路径烤进了提交产物**
   （`"ROUTES_CSV": "C:/Users/XIONG/AppData/Local/Temp/wb40/table-a-routes.csv"`）。
   换一台机器复跑产物就不一致，等于给「机器复算」埋了假差异。改为：工作树内→相对路径，工作树外→`<工作树外临时目录>/table-a-routes.csv`。
   `ROUTES_CSV_ROWS=164` 保留，作为与矩阵10 对齐的真实不变式。
2. **产物内含 `ELAPSED_MS` 时间戳** ⇒ 逐字节哈希每次不同，与 R101 §九「复原 SHA 一致后复绿」相冲。
   计时移出 markdown 产物、只打 stdout。

修完复跑两次，产物 SHA1 相同：

```
RUN1==RUN2 BYTE_IDENTICAL
f6d67dbc0e50dd95e9de042314886866a7129651  a.md
f6d67dbc0e50dd95e9de042314886866a7129651  b.md
```

`parse-routes.cjs` 新增 `--strict`：任一「卡口径 vs 实算」差异非 0 时打印 `STRICT_FAILED`/`DRIFT` 并 **EXIT=1**，
使本反测可挂门禁而非只能肉眼看打印。

## 七、复算总账（`verify-inventory.cjs --strict`，EXIT=0）

```bash
node docs/evidence/WB-REFACTOR-P0/scripts/verify-inventory.cjs --strict
```

```
总计 42 项，FAIL 0 项。
```

覆盖：M20 12 项（条数/行号集合/总数/无重无漏/状态可枚举）、M30 6 项（写 254、读域 89、66 域小计求和、
无码求和 57、审计三态求和 217+22+15=254、每域小计行数）、L40 13 项（157 行、五档 × 摘要/明细/COUNTS 三方、
TSV 行数、CSV 行数 164）、M10 7 项（路由表 164 行 + 6 项文档↔脚本对账）、全表「无空格子 / 列数对齐」1 项。

## 八、未完成项（如实）

- 矩阵30 自检验例②（加 `INSERT INTO t_operation_log` ⇒ 审计「无」变「有」）未单独执行，理由见 §四。
- 台账40 的「未验运行态」仍未解除：工作树内无 `node_modules`，本轮**未构建、未起 dev server、未在浏览器逐页打开**，
  所以 157 页的运行态是**静态判定**，不等于验收。P0/P1/P2 的 52 页需真实环境逐页眼验。
- `docs/evidence/WB-REFACTOR-P0/**` 之外零改动；未 push、未开 PR。
