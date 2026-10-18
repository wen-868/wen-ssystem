# R101-QODER-5-回传 · S3-247 三兄弟落地（pin-ssl 口径 / 离线链二选一 / BanksCard 撤销定性）

> 回传人：**Qoder（移动端执行方）**｜回传日期：2026-10-18
> ⚠️ 本卡不含任何「凌舟裁定 / 验收结论」字样；裁定与合并由凌舟执行。
> 派单卡：`docs/tasks/inbox/QODER-5-三兄弟落地.md`（依据 `R101-手机端收口-五条裁定与派单-凌舟-20261017.md` §一.1 第 81 项）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-5`｜分支 `fix/qoder-5-orphans`

## 〇、基线与提交（含一处主动交代的偏离）

- 任务书基线写 `origin/main`（现 `d1dafe4d`）。**实际栈于 QODER-4 分支尖端 `5e546899`**（即卡 1→卡 2→卡 4 链上）。
- 理由：判据「`npm --workspace app-mobile run test` 全过」「vue-tsc 0 新增」依赖四道门装置（`test`/`type-check` 脚本与 gates-baseline），它们只存在于卡 1/2/4 链；裸 origin/main 形态下这两条判据**无法执行**，也就无法诚实交付。偏离先例已由凌舟对 QODER-4 裁定⑤接受（栈式基线可合，冲突面为零即成立）。
- 冲突面：本单改动文件（api/sync.ts、api/local-db.ts、config/env.ts、native/scan.ts、utils/pin-ssl.ts、utils/sync-manager.ts 删除、scripts/gates-baseline.json）与卡 1/2/4 改动集除 gates-baseline.json（**本单就是在其上按门规则调平，语义衔接**）外不相交；按「卡1→卡2→卡4→本卡」顺序合入即线性无冲突。
- 提交：实现 `7c56fe3a`；本卡+证据+回执为第二枚提交。**未 push、未开 PR、未 `git add -A`。**
- 后端口径用 `git merge-base origin/main HEAD` = **`3fa138e7`**（不是 origin/main..，避免把 main 新提交算成本单）。

## 一、三对象 × 决定 × 理由 × 判据（总表，任务书点名必交）

| 对象 | 决定 | 理由 | 判据（原始输出） |
|:--|:--|:--|:--|
| ① `BanksCard.vue` | **不动**，撤销「孤儿」定性，仅登记 | 复核属实：`pages-sub/product/suppliers/detail.vue:255` 真 import（含 `type BankAccount`）、`:137` 有用法、`:372` 只读展示注释；`DocPage.vue:97` 另有样式对齐引用 | `docs/evidence/qoder-5/bankscard-in-use.log`（4 处命中）；本单 diff 不含该文件 |
| ② `pin-ssl.ts` | **暂不接线**（定性 + 注释纠偏 + 指纹维护口径见 §二） | a) `PINNED_CERTS` 叶子指纹已于 2026-09-15 过期——`validateCertificate` 不匹配即拒连，**此刻接线＝APP-PLUS 全量请求失败＝事故**，不是反测；b) `installSslPinning()` 的 APP-PLUS 分支自己写明「实际安装逻辑在原生层（NetworkClient）」，JS 侧 `plus.networkEvent.addEventListener('certificateValidate')` 是接口预留、当前运行时不可用——接了也只剩「校验不存在⇒静默放行」，正是任务书禁止的形态，且反测（指纹不匹配⇒请求失败）无法构造；c) H5/小程序本就无法应用层 Pinning（浏览器/宿主自带 HTTPS 校验） | `config/env.ts:7-9` 已改为「**当前未接线**（零调用点，指纹已过期）」；`utils/pin-ssl.ts:4-12` 文件头标注状态与接线前置；改后 `rg installSslPinning app-mobile/src` 命中全部为 pin-ssl.ts 自身（定义/状态块），零外部调用点 |
| ③ 离线链（`sync-manager.ts` + `local-db`） | **下线**（禁选保持半接线；接线不可行理由见右） | a) **行为等价**：sync-manager 零调用点⇒其 `applyDelta` 永不执行⇒本地 5 表从未写入⇒`scan.ts` 本地查找恒 miss、恒走网络兜底——离线链实际早已不工作，摘除＝零行为变化；b) 判据不可交付：接线的「端到端证据（真实发起一次同步）」需要原生 SQLite 运行时 + 真机链路，本环境（H5/Node）无法诚实取得；c) 保留半接线＝任务书点名的「最难查形态」 | 删除 `utils/sync-manager.ts`（−653 行）；`native/scan.ts` 摘除本地分支/`mapDeltaToProductInfo`/`getCurrentTenantId`（纯网络）；`api/sync.ts` 对 local-db 的类型依赖内联自持有；`rg -n "sync-manager|local-db" app-mobile/src` 改前 10 处⇒**改后 0 命中**（`rg-after-offline-chain.log`，0 字节+note.txt） |

**③ 的边界忠实执行说明**：任务书下线字面为「删除 sync-manager，并清掉 scan.ts/api/sync.ts 对 local-db 的引用」。据此**保留** `api/local-db.ts`、`api/sync.ts`、`native/sqlite.ts`（清引用≠删文件）；三者现为零生产消费方的「存储层能力 + 后端契约客户端」，未来若重开接线可直接复用。`local-db.ts` 的 delta/draft 类型改为**从 api/sync.ts 导入并 re-export**，消除双定义漂移。若凌舟要「整链连数据层一起删」，一句话另开卡即可（§九-①）。

## 二、pin-ssl 证书指纹维护口径（任务书点名必交）

- **谁更新**：移动端专职人（Qoder 执行方）负责取指纹与改码；证书轮换执行人（运维/后端）在轮换**生效前**知会并把新证书链送达，更新 PR 在轮换窗口内合入。
- **从哪取**：新证书部署到生产后在线采集 **SPKI-SHA256**（与现 `PINNED_CERTS` 同格式 `sha256/<Base64>`）：
  `openssl s_client -servername api.onepan.cn -connect api.onepan.cn:443 </dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`
  每域保留**叶子 + 中间证书**两条（轮换兜底，现行结构不变）。
- **何时更新**：证书轮换同 PR 更新 `PINNED_CERTS` 并注释到期日；须在下一个 App 构建发版前合入（H5 不受影响，无校验在跑）。
- **过期如何告警**：未接线状态下，指纹过期≠线上故障（没有校验在跑），风险仅是注释腐化——已由 `pin-ssl.ts` 文件头状态块兜住。**接线时**必须同步上「release 前置检查」：脚本比对在线证书 `validTo`，距到期 ≤30 天即红并点名（归接线卡交付物）。
- **接线前置清单**（两条缺一不接）：① 新指纹采齐并在线校验通过；② 原生层（NetworkClient/plus）证书校验事件确认存在且回调可控——满足后接线卡须自带反测（伪造指纹⇒APP-PLUS 请求失败点名，不许静默放行）。

## 三、判据逐项自评（全部原始输出落盘 `docs/evidence/qoder-5/`）

| # | 判据 | 结果 | 证据 |
|:--|:--|:--|:--|
| 1 | `rg -n "installSslPinning\|sync-manager\|local-db" app-mobile/src` 改前/改后对照 | 改前 **13 处**→改后 **5 处**（5 处全为保留文件 pin-ssl.ts 自身定义/状态块，对应 ②「暂不接线」决定） | `rg-before.log` / `rg-after-fullpattern.log` |
| 2 | 选下线⇒`rg` 残留 **0 命中** | `rg -n "sync-manager\|local-db" app-mobile/src` EXIT=1、0 命中（改前同口径 10 处） | `rg-after-offline-chain.log`（0 字节）+ `rg-after-offline-chain.note.txt` |
| 3 | `vue-tsc --noEmit` 0 新增 | type-check 门 EXIT=0：当前 0 = 基线 0 | `gates/gate-type-check.log` |
| 4 | `npm --workspace app-mobile run test` 全过 | EXIT=0：**5 文件 / 53 用例全过**（gates-baseline tests 同步调至 5/53，凌舟裁定②代执行留痕） | `gates/gate-test.log` |
| 5 | `build:h5` EXIT=0 | `DONE Build complete.`，EXIT=0 | `build-h5.log` |
| 6 | `backend/` 零改动（merge-base..HEAD 口径） | `git diff --stat 3fa138e7..HEAD -- backend/` = **0 行**；工作树 `git status -- backend/` 空 | `backend-zero-diff.log` |
| 7 | 回归（自加） | lint 门 EXIT=0（error 20=20；warning 12872，删码致 −8，按「只准降不准升」调低基线留痕）；contract 门 EXIT=0（三口径 292/283/204/1498 与基线同读数）；`guard:logout` GREEN | `gates/gate-lint.log`、`gates/gate-check-contract.log`、`guard-logout.log` |

## 四、验收自评（对照任务书 §三 四条）

1. 改前/改后对照：✅（§三-1，两口径都给）。2. 下线残留：✅ 0 命中（§三-2）；tsc/test/build：✅（§三-3/4/5）。3. 接线端到端+反测：**不适用**——两对象均未选接线；「暂不接线」的替代证据＝引用面清零 + 状态定性 + §二口径（任务书 §二.1 允许分支）。4. backend 零改动：✅（§三-6）。

## 五、未完成与阻塞

- 无阻塞。三对象均已定性落地；②的接线实现、③的重连接均**明确留给后续卡**，本单不做。
- `api/sync.ts`/`api/local-db.ts`/`native/sqlite.ts` 现为零生产消费方保留件（任务书字面边界内），是否彻底删除待裁（§九-①）。

## 六、风险与自我报备

- 离线链下线后，若历史 App 包曾在 SQLite 建过 5 表，表残留但不再读写——无害数据，无行为变化（从未有数据写入）。
- **弱网/离线扫码开单能力随下线正式关闭**：现状本就不工作（表恒空），不是新回归，但产品侧若真需要离线开单，须重开接线卡（端到端判据在原生环境取证）。§九-②。
- 基线栈依赖：gates-baseline tests=53 预设卡 1/2/4 先合；若合并顺序变动需凌舟重新落基线。
- 本单动了 `gates-baseline.json`（卡 1 的文件）：仅按门自身规则调平（warning 调低 + tests 上调留痕），未改任何门逻辑；在「先合卡1、再合本卡」的既定顺序下无冲突。

## 七、环境复原

- 本单无注入反测（两决定均为「不接线/下线」，不产生被注入文件）；工作树除 `docs/evidence/`、本卡与回执外干净，node_modules 为 junction。

## 八、一行摘要

三兄弟分别定性落地：BanksCard 撤销孤儿（不动）；pin-ssl 定标**当前未接线**（注释纠偏 + 文件头状态 + 指纹维护口径与接线前置）；离线链**下线**（删 sync-manager 653 行、scan 纯网络、api/sync 类型自持有，`sync-manager|local-db` src 残留 0 命中），四道门+build:h5+后端零改动全绿。

## 九、待凌舟裁定项

1. ③ 的下线边界：本单按任务书字面保留 local-db/api-sync/sqlite 为零消费能力件；若判「整链删除更彻底」，开一卡即可执行。
2. 离线开单是否仍是产品需求：是⇒开「离线链接线卡」（须含原生环境端到端 + 反测）；否⇒上述三个保留文件转入删除批次。
3. pin-ssl 接线卡是否排在「下一次证书轮换 + 原生层证书回调确认可用」之后立项（§二前置清单）。
4. 基线偏离（栈于卡 4 尖端）认可与否——沿用裁定⑤先例。

## 十、依据卡与证据清单

- 派单：`docs/tasks/inbox/QODER-5-三兄弟落地.md`；回执：`docs/tasks/inbox/ACTIVE-回执-QODER-5.md`
- 证据：`docs/evidence/qoder-5/{rg-before.log, rg-after-fullpattern.log, rg-after-offline-chain.log(+note.txt), bankscard-in-use.log, backend-zero-diff.log, build-h5.log, guard-logout.log, gates/gate-{type-check,lint,test,check-contract}.log}`
