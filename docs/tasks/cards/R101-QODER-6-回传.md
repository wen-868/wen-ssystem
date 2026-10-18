# R101-QODER-6-回传 · S3-242 跨层漂移 16+1 条定性（只定性 + 登记，不修业务）

> 执行人：**Qoder（移动端）**｜回传日期：2026-10-18
> 任务书：`docs/tasks/inbox/QODER-6-跨层漂移定性.md`｜工作树 `D:\Users\ZXQL\wt-agents\QODER-6`｜分支 `chore/qoder-6-crosslayer-drift`
> ⚠️ 本卡是**执行方回传**，不含任何「凌舟裁定 / 验收结论」；「以哪层为准」等裁定项见 §九。

## 〇、基线与提交（含一处主动交代的偏离）

- 任务书要求基线 `origin/main`；实际**栈于卡 5 尖端 `ef0f990f`**（卡1→2→4→5 同线）。理由：本单交付物 `check-contract-drift.mjs` 必须复用 `check:contract` 的门禁体系与 `gates-baseline.json`（该文件在卡 1 创建、卡 5 调平，`origin/main` 上尚不存在裸态可用）。**合并顺序：卡1 → 卡2 → 卡4 → 卡5 → 卡6**；沿 QODER-4/5 同类偏离先例，主动报备待裁。
- `git merge-base origin/main HEAD` = `3fa138e7`（#363，S3-245 根治）；`backend/` 于 `merge-base..HEAD` **0 文件改动**（证据 `backend-zero-diff-mergebase.log`）。
- 提交（本地，未 push、未开 PR、未 `git add -A`）：见 §九 清单（实现/证据一笔、回传一笔）。

## 一、结论总表（17 条 = 任务书 16 + S3-240 追加 1）

| 组 | 条数 | 类 | 一句话 |
|:--|:--|:--|:--|
| `platform/*` 前缀漂移 | 15 | **D1** | 注册表多写 `/platform` 段，后端真实注册无该段；部分功能运行时代码早已用**正确路径**（漂移只存在于注册表行） |
| `deliveries/:deliveryId/status` | 1 | **D1** | 方法漂移：注册表 POST，后端实为 PUT（ops:61） |
| `/admin/system/employees*`（追加） | 1（含 5 个 wrapper） | **D4** | 后端 0 注册属实，但 5 个 wrapper **零外部调用方**（连 import 都没有）⇒「前端在调」前提不成立，属清单口径误报；等价映射（D3 备用）指向 `/api/admin/staff*` |
| 其余注册表 11 行（运营族） | 11 | OK | 与后端逐段对上（脚本现场给后端 file:line） |

**debt（D1+D2）= 16，D2 = 0**，已写入 `gates-baseline.json` 新段 `contractDrift`（只准降）。employees 若将来出现调用方而后端仍 0 注册 ⇒ 脚本自动升格 D2 ⇒ debt 16→21 ⇒ 门转红（回归语义见 §四）。

## 二、16 行判定表全文（任务书点名必交；逐条含证据行号）

前端出处统一为 `app-mobile/src/config/permission-gates.ts`（注册表 `island-instant-retail-admin`，endpoints 632-658 行，全文抓取见 `registry-27-endpoint-lines.log`）；后端 `plat:` = `backend/src/routes/instant-retail-admin-platform.routes.ts`，`ops:` = `backend/src/routes/instant-retail-admin-ops.routes.ts`。

| # | 前端行 | 注册表 方法+路径 | 后端实际 | 类 | 建议（修复卡按此改注册表） |
|:--|:--|:--|:--|:--|:--|
| 1 | :641 | POST `/api/admin/instant-retail/deliveries/:deliveryId/status` | `ops:61` **PUT** 同路径 | D1 方法漂移 | 注册表 POST→PUT |
| 2 | :644 | POST `…/platform/configs` | `plat:16` POST `…/configs` | D1 前缀误写 | 去掉 `/platform` 段 |
| 3 | :645 | POST `…/platform/configs/:platform/test` | `plat:17` 去 platform 同名 | D1 | 同上 |
| 4 | :646 | POST `…/platform/configs/:platform/sync-orders` | `plat:18` | D1 | 同上 |
| 5 | :647 | POST `…/platform/configs/:platform/sync-products` | `plat:19` | D1 | 同上 |
| 6 | :648 | DELETE `…/platform/configs/:platform` | `plat:20` | D1 | 同上 |
| 7 | :649 | POST `…/platform/shop-config` | `plat:24` POST `…/shop-config` | D1 | 同上 |
| 8 | :650 | POST `…/platform/categories` | `plat:28` | D1 | 同上 |
| 9 | :651 | PUT `…/platform/categories/:id` | `plat:29` | D1 | 同上 |
| 10 | :652 | DELETE `…/platform/categories/:id` | `plat:30` | D1 | 同上 |
| 11 | :653 | POST `…/platform/products` | `plat:34` | D1 | 同上 |
| 12 | :654 | PUT `…/platform/products/:id` | `plat:35` | D1 | 同上 |
| 13 | :655 | DELETE `…/platform/products/:id` | `plat:36` | D1 | 同上 |
| 14 | :656 | POST `…/platform/banners` | `plat:47` | D1 | 同上 |
| 15 | :657 | PUT `…/platform/banners/:id` | `plat:48` | D1 | 同上 |
| 16 | :658 | DELETE `…/platform/banners/:id` | `plat:49` | D1 | 同上 |

追加第 17 条（S3-240）：`admin-web/src/api/system.ts:41/46/51/56/61` 五个 wrapper（GET 列表 / GET 详情 / POST / PUT / PATCH status）→ 后端 `rg -n 'system/employees' backend/src` **0 命中**（`rg-backend-employees-0hit.log`，EXIT=1）→ **D4 误报** → 建议：既非"在调"，走"下线 5 个死 wrapper"或"改接 `/api/admin/staff*`（D3 映射：GET `…/staff`@`admin-staff.routes.ts:20`、POST@:21、PUT `:id`@:22、PUT `:id/status`@:23——注意 PATCH vs PUT 方法差、且 GET 单员工详情**无等价端点**）"二选一，另立卡。

**"静默失效"定性的现场修正**：D1 的 16 条当前**不在运行路径上**——`rg -n '/platform/' app-mobile/src` 除注册表 15 行外 0 命中（`rg-appmobile-no-platform-call.log`），且平台配置族运行时 `api/modules/instant-retail.ts:115-152` 早已使用**正确**（无 /platform）路径；shop-config/categories/banners/deliveries 为零调用孤岛功能。漂移的实害是**注册表→权限门/台账的错误口径**，不是当下线上 404。

## 三、机械判据 + 两处匹配器盲区（任务书 §三.3 点名）

- 新判据：`app-mobile/scripts/check-contract-drift.mjs`（只跑本单 16+1 清单；27 行注册表逐行 OK/D1/D2 分类 + employees caller 闭包判定；`--json` 机读）。抽取逻辑与 `check-contract.mjs` 同一套但**逐字复制**——后者 import 即执行 `main()` 并 `process.exit`，不可复用 import（行为差异登记于此）。
- **盲区 ①（为何 check:contract 看不见这 16 条）**：其调用侧正则只取**非注释行以 `/admin/` 开头**的引号字面量；注册表行是数组字面量 `'POST /api/admin/…'`（以 `/api/` 开头、非调用/`url:` 行）⇒ 16 条漂移对门 4 完全隐形（门 4 差集仍 0/豁免 1）。
- **盲区 ②（D4 根因，任务书要求的误报说明）**：清单口径按"wrapper 文件里存在 `/admin/system/employees` 字符串"判定"前端在调"，**未做 caller 闭包**。实测 5 个 wrapper 在 `admin-web/src`（除定义文件）0 引用（`rg-adminweb-employees-callers-0hit.log`，glob 修正后 EXIT=1）⇒ "调用必 404"的 D2 定性不成立，改判 D4。脚本已内置 caller 计数，将来出现调用方自动升 D2。
- 取证工具坑（登记）：Git Bash 对**以 `/` 开头的参数**做 MSYS 路径转换，`rg -n '/platform/' …` 曾被转成假模式产生**假 0 命中**；本卡全部证据已在 `export MSYS2_ARG_CONV_EXCL='*'` 态复跑，对照组见 `rg-appmobile-no-platform-call.log.note.txt`。

## 四、反测（门必须能红）

基线 `contractDrift.debt` 暂调 16→15 ⇒ `node scripts/check-contract-drift.mjs` **EXIT=1** 并点名 `✗ debt=16 超基线（只准降）`（`drift-counter-test-red.log`）；复原后 SHA256 前后一致 `c1fe10e9ea7841d7e7e4ceecada9a642ffac36e40328885827902d0159e56caa`，复跑 EXIT=0；临时副本用后即弃，工作树提交前 `git status` 无脏残留。另一红路为"缺 contractDrift 段 ⇒ 直接红"（§〇 前脚本首跑即此态，留痕于对话）。

## 五、后续修复建议拆单（本单零业务改动）

1. **卡 A（D1×16）**：以**后端为准**改 `permission-gates.ts` 注册表 16 行（15 去 `/platform` + 1 POST→PUT），完成后 `check-contract-drift.mjs` debt 16→0，现场把基线调低留痕。⚠️ 前置待裁：台账 §18.9-3「以哪层为准」未定案（§八.1）。
2. **卡 B（D4/employees）**：admin-web 死 wrapper 下线，或改接 `/api/admin/staff*`（含 GET 详情无等价、PATCH/PUT 方法差两个坑位）——属 admin-web 域，建议转派或授权。
3. **卡 C（门禁接线）**：`check-contract-drift.mjs` 进 CI / 提交门禁（与门 1-4 同列），防注册表再漂。

## 六、判据自评（对照任务书 §三 四条）

1. 16 条**逐条**判定+证据 ⇒ §二 表 + `drift-table-full.log`（脚本逐条打印前端行与后端 file:line）✅
2. 每条可用 rg 指到后端行或明确 0 命中+命令 ⇒ `backend-platform-registrations.log`、`backend-ops-registrations.log`、`backend-staff-d3-equivalence.log`、三份 0-hit 证据（含命令与 exit）✅
3. ≥1 条 D4 且说明匹配器漏判 ⇒ §三 盲区② ✅
4. `npm --workspace app-mobile run test` 5 文件/53 用例全过不劣化；`type-check` vue-tsc 0=0；`check:contract`/`lint` 复跑绿；`backend/` `merge-base..HEAD` **0 文件** ✅（`gates/*.log`、`backend-zero-diff-mergebase.log`）

## 七、红线对照

改动全集：`app-mobile/scripts/check-contract-drift.mjs`（新增）、`app-mobile/scripts/gates-baseline.json`（仅加 `contractDrift` 段）、`docs/evidence/qoder-6/**`、本卡、回执。**零业务代码、零后端改动**；未 push、未开 PR、未 `git add -A`（逐文件 add）；0 字节证据均配同名 `.note.txt`（4 份）；证据无口令。

## 八、待凌舟裁定项

1. 台账 §18.9-3「跨层不一致以哪层为准」——卡 A 的前置（本卡建议：以后端为准，理由：运行时调用侧已实际按后端路径工作）。
2. 基线偏离（栈于卡 5 尖端）是否接受（§〇）。
3. employees（D4）处置走卡 B 的哪一分支（下线 vs 改接 staff）。
4. 卡 C 是否排期（漂移机进 CI）。

## 九、交付物与证据清单

- 提交：`<实现>` `app-mobile/scripts/check-contract-drift.mjs` + `gates-baseline.json`（contractDrift 16/0/1 现场实测入册）；`<回传>` 本卡 + `ACTIVE-回执-QODER-6.md` + `docs/evidence/qoder-6/**`。
- 证据：`drift-table-full.log`（27 行逐条，含 EXIT=0）、`drift-machine.json`（--json 全量）、`drift-counter-test-red.log` + note、`registry-27-endpoint-lines.log`、`backend-platform-registrations.log`、`backend-ops-registrations.log`、`backend-staff-d3-equivalence.log`、`appmobile-runtime-callers-correct-paths.log`、0-hit 三件 + `rg-appmobile-no-platform-call.log`（各配 note，0 字节）、`backend-zero-diff-mergebase.log`、`gates/gate-{type-check,lint,test,check-contract}.log`（均 exit=0）。

## 十、一行摘要

16 条全部定性 D1（15 前缀误写 + 1 方法漂移、后端 file:line 逐条指到）、追加 1 条定性 D4（零调用方实证）、D2=0；漂移机 + 只准降基线（debt=16）落地并反测能红；零业务改动。
