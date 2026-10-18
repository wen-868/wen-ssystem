# 【汇报 QODER-1】卡《QODER-1 · 移动端批次 0：门禁基线》 · 结论：四道门本地全绿、四条反测逐条红过并逐字节复原、后端三守卫零回归 —— 已交付 · 待凌舟验收

> ⚠️ 本卡为**执行方回传**，不构成验收结论；验收读数与合并决定权在凌舟。

```
【汇报 QODER-1】QODER-1（批次 0 · app-mobile 门禁基线）四道门 + 冻结基线已交付
汇报对象：凌舟（总负责人）
汇报人：QODER（移动端执行方）｜2026-10-18
交付物：见 §二
证据（可复跑）：见 §三
验收自评：见 §四
未完成与阻塞：见 §六
风险与自我报备：见 §七
回传要求：本汇报已落卡：docs/tasks/cards/R101-QODER-1-回传.md
关联卡：docs/tasks/inbox/QODER-1-门禁基线.md（派单卡，原件未动）
```

## 〇、ref（R8.2：验证目标必须可核对）

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-1`｜分支 `chore/qoder-1-appmobile-gates`｜基线 `origin/main` = `1ba1efd0`
- 实现提交 **`b25a6f8c8316230037bbe9893c6b31cfe7d698da`**（**未 push、未开 PR**，按红线只落本地分支）
- 本卡与回执为第二笔提交（哈希见 git log 尖端）
- 后端零改动：`git diff 1ba1efd0 HEAD -- backend/` **为空**（`--stat` 实测零行）

## 一、一句话

`app-mobile` 此前在 5 个 workflow 中出现 **0 次**、package.json 无 lint/test/type-check；本卡建起
**type-check / lint / test / check:contract** 四道能红的门，存量按任务书 §二.5 冻结在
`app-mobile/scripts/gates-baseline.json`（只准降不准升），并把四道门以阻断步骤接进 `ci.yml`。

## 二、交付物（逐条，均在上述提交内）

| # | 交付 | 路径 |
|:--|:--|:--|
| 1 | 门 1 type-check（S3-245 同形态 `vue-tsc --noEmit` + 0 新增基线包装） | `app-mobile/scripts/type-check-gate.mjs`（脚本 `type-check`；另有 `type-check:raw` 供观察裸读数） |
| 2 | 门 2 lint（`eslint src --ext .ts,.vue` + error/warning 双冻结 + **假绿兜底**：覆盖文件数≠src 文件数即红） | `app-mobile/.eslintrc.cjs`、`app-mobile/scripts/lint-gate.mjs`（脚本 `lint`） |
| 3 | 门 3 test（vitest 3 文件 15 用例 + **用例数冻结**防"删测试仍绿"） | `app-mobile/vitest.config.ts`（内含 uni 条件编译 shim，按 H5 分支加载真实代码）、`app-mobile/scripts/test-gate.mjs`（脚本 `test`）、`app-mobile/tests/{permission-codes,storage-crypto,api-base-env}.spec.ts` |
| 4 | 门 4 契约对账（移动端 `/admin` 调用路径 ↔ 后端注册差集，差集非空 EXIT=1 逐条点名；具名豁免每条带理由，豁免失效即红） | `app-mobile/scripts/check-contract.mjs`（脚本 `check:contract`）、`app-mobile/scripts/contract-exemptions.json` |
| 5 | 存量冻结基线（type-check 12 条、lint 20 error + 6 规则 warning、用例 3/15、契约三口径读数） | `app-mobile/scripts/gates-baseline.json` |
| 6 | CI 阻断接线（4 个新步骤，零新增依赖、lockfile 零改动） | `.github/workflows/ci.yml`（`Saas admin type gate` 之后） |
| 7 | 证据（全部命令原始输出 + SHA256） | `docs/evidence/qoder-1/**` |

§二.1 复用 S3-245 的说明：命令**本体**一致（`vue-tsc --noEmit`，cwd=app-mobile）；#363 未合并期间 main 的
`crypto.ts` 还带 12 条 TS2323/TS2393（双份 `#ifdef` 导出），裸跑恒红=假门禁，故基线比对从"空清单 comm"
改为读 `gates-baseline.json`。**这不是第二套类型门**：#363 合并后把基线 `typeCheck.errors` 清空即收敛为 0 新增裸语义。

## 三、证据（可复跑；原始输出已入库 `docs/evidence/qoder-1/`）

复跑命令（仓库根）：
```bash
npm --workspace app-mobile run type-check   # gate1-type-check.log：EXIT=0（vue-tsc 裸 EXIT=2，12=基线12，无新增）
npm --workspace app-mobile run lint         # gate2-lint.log：EXIT=0（error 20=基线20 / warning 12880=基线12880）
npm --workspace app-mobile run test         # gate3-test.log：EXIT=0（3 文件 15 用例，=基线）
npm --workspace app-mobile run check:contract  # gate4-contract.log：EXIT=0（差集 1 条=具名豁免 1 条）
node backend/scripts/guard-route-auth.mjs
node backend/scripts/guard-evidence-secrets.mjs
node backend/scripts/guard-rbac-wiring.mjs --strict
```
反测四条（`counters/`，每条含注入 ⇒ 红 ⇒ 点名 ⇒ 复原 ⇒ SHA256 一致 ⇒ 再绿；见 `sha256-counter-tests.txt`）：
- **C1 lint**：`src/api/storage.ts` 追加 `;;` ⇒ EXIT=1，点名 `src/api/storage.ts:453:1/2 no-extra-semi`（基线外 2 条）。
- **C2 类型**：`src/config/env.ts` 注入 `const: number = "str"` ⇒ EXIT=1，点名 `env.ts(17,14): error TS2322`。
- **C3 契约**：注入不存在的 `/admin/__qoder1_no_such_endpoint__/probe` ⇒ EXIT=1，点名该路径 + 出处 `auth.ts:157`。
- **C4 测试**：删 1 条用例（`④ 精确码命中`）⇒ vitest 本体照样绿，**test-gate EXIT=1** 点名 `14 < 基线 15（少了 1 用例）`。
  —— 这条正是要防的"恒绿假门禁"形态：包装前的裸 `vitest run` 删测试不会红。

YAML 校验（`ci-yaml-validate.log`）：js-yaml load OK；`build-and-test` 36 步；4 个 App mobile 步骤就位；
`app-mobile` 在 ci.yml 出现 9 次（此前 0）。

## 四、验收自评（逐条对照任务书 §三）

| §三 | 判据 | 自评 | 依据 |
|:--|:--|:--|:--|
| 1 | 四条命令各自 EXIT=0 | **通过**（口径说明见 §七.1） | `gates/gate1..4-*.log` |
| 2 | 反测四条各一次必红并点名；复原逐字节一致（SHA256） | **通过** | `counters/C1..C4.log`、`sha256-counter-tests.txt`（四条均 `RESTORE=BYTE-IDENTICAL`）、`post-restore-*.log` 全 EXIT=0 |
| 3 | check:contract 差集 0 或全部具名豁免 | **通过**（差集 1 条=豁免 1 条：`/admin/quote-push/*/resend` 孤岛页死路径，豁免条目含理由+归属批次；后端补注册或页面删除后该条目自动 stale 判红） | `gate4-contract.log`、`contract-exemptions.json` |
| 4 | ci.yml 新增步骤（阻断）+ 本机 YAML 校验 | **通过**（4 步零 `continue-on-error`） | diff + `ci-yaml-validate.log` |
| 5 | 后端三守卫仍 EXIT=0 | **通过**（route-auth G3 绿；evidence-secrets PASS；rbac --strict 无未登记） | `guards/*.log`（rbac 当前登记欠账 **297**+consumerEnd 45，比 ACTIVE.md 摘引的 371 少——main 上后续批次已接线，非本卡改动所致） |

## 五、A.2 三口径重算（回答"281 条 /admin 直调"口径质疑）

**唯一真相口径 = `node app-mobile/scripts/check-contract.mjs` 现场打印**（本次读数）：
- 非注释行、引号（单/双/反引号）内以 `/admin/` 开头的字符串字面量出现次数：**292**
- 其中位于调用/`url:` 行内：**283**
- `${...}` 参数归一 + 去查询串后**去重路径数**：**204**

与凌舟附 A.2 三口径（684/164/110）的差异全部可解释：① 684 是**子串**口径（含注释与一行多次），② 164/110 只数
**单引号**字面量（漏掉双引号/反引号模板，而移动端 API 模块大量用反引号拼参数）。
**审查报告里"281"的出处无法复现，本卡起废止**，以 204（去重路径）为后续端点隔离讨论的分母。

## 六、未完成与阻塞

无。四项交付 + 冻结基线 + CI 接线均完成；本卡未 push、未开 PR（按红线），等待凌舟按
「门禁全绿 + 反测逐条红过 + 后端零改动」三条亲验。

## 七、风险与自我报备（主动交代）

1. **任务书内部有两处取值冲突，我按 §二.5「存量冻结」口径落地，请裁定是否认可**：
   - §三.1 要求 type-check `EXIT=0`，但基线 `origin/main` 带 crypto.ts 12 条（S3-245/PR #363 未合）——"当日清零"要么违反红线（改页面）要么造假门禁（`|| true`）。
   - §二.2 要求 lint `0 error`，但存量 20 条 error 全部位于**页面文件**（no-extra-semi×9 / no-unreachable×6 / no-empty×3 / vue/no-unused-vars×1 / no-irregular-whitespace×1），红线"不得改页面" ⇒ 不可当日清零。
   - 落地：两道门都实现为 **0 新增（基线外即红并点名）**，基线只准降不准升、无 `--update` 逃生口。反测证明它们真的会红（§三）。若凌舟要求本单内直接清掉 lint 的 20 条存量（全部是零行为差异的语法级修正，其中 no-unreachable×6 疑似条件编译双分支的**静态假象**，删除会伤 App 端），请回话，我可在本分支追加。
2. **测试③语义解释**："API 基址/环境变量缺失即失败"——现状 `env.ts` 的行为是"缺失 ⇒ 静默兜底 `/api` 与占位域名"，不是抛错；本卡红线不可改业务代码，故把"即失败"落成**测试判据**（基址为空/非法 ⇒ 用例即抛即红；同时把"H5 兜底必须是相对 `/api`"钉死，防止静默漂到绝对域名）。若你要的是**构建期缺失即失败**（fail-fast），那是 env.ts 的行为改动，已登记待"批次 1（请求层根治）"，本卡未做。
3. **零新增依赖**：eslint/vitest/vue-tsc 复用仓库根提升依赖（C6-5 saas-admin 先例），`package-lock.json` 零改动；副作用是 `app-mobile/package.json` 的 devDeps **不声明**这三者——单仓拆分或裸装环境跑 workspace 脚本会缺依赖（现在不会：CI 用 `npm ci --legacy-peer-deps` 根装）。
4. **check:contract 已知边界**（脚本头注释已写明）：只认字符串字面量（变量拼接路径、`router.use(sub, otherRouter)` 二级挂载不在扫描内——与后端 guard 脚本同款限制）；注册侧已把 `backend/src/server.ts` 的 8 条**直挂端点**纳入（否则 `demo-login`/`mfa/verify` 会被误报成缺口——这正是首轮跑出 3 条"假缺口"后发现并修正的盲区）。
5. **门 4 的差集口径是"路径级"（不含 method）**：移动端 helper 与后端动词不一致的调用（如 GET 写成 POST）当前不会红；如需 method 级判据请回话，我加严。
6. **`vue-tsc` 在包装脚本里经 `node <根>/node_modules/vue-tsc/bin/vue-tsc.js` 直调**（Windows 下 `spawnSync('npx.cmd')` 拿不到 stdout，曾产生过一次"0 错误"假绿——已被我抓住并加了两层兜底：非常规退出码保守判红 + lint 的文件覆盖数核验）。CI 步骤本体命令未变。

## 八、给卡 2（QODER-2）的接口提示

卡 2 要在 `ENTRY_GATES` 加 5 条登记 + 一致性用例 ⇒ 会**新增用例数**：test-gate 会提示"高于基线请调高"，属预期动作（把 `gates-baseline.json` 的 `tests` 同步上调即可，规则=实测即基线）。
另：**卡 2 的基线是 `origin/main`，不含本卡 harness**——若凌舟希望卡 2 复用本卡的 vitest 装置（一致性用例、test-gate），建议卡 2 改从本分支尖端 `b25a6f8c` 起基，或先合本卡再派卡 2；两者取舍在凌舟，我未擅动 QODER-2 工作树。

## 九、哈希登记

- 实现提交：`b25a6f8c8316230037bbe9893c6b31cfe7d698da`
- 反测四文件 SHA256（前=后）：见 `docs/evidence/qoder-1/sha256-counter-tests.txt`
  - `src/api/storage.ts` `524890d9…`、`src/config/env.ts` `55684a62…`、`src/api/modules/auth.ts` `1192b8d7…`、`tests/permission-codes.spec.ts` `6c355396…`
- 本卡无 dist 产物（门禁不产出构建物；`build:h5` 归卡 2 判据）。

## 十、变更记录

- 2026-10-18：首次回传（无更早版本，无口径覆盖）。
- 2026-10-18（裁定落地 v2）：凌舟验收通过两卡并下四条裁定，本分支按 ①② 收口径（追加提交，见 git log 尖端）：
  - **裁定①（lint error 不许长期冻结）**：`gates-baseline.json.lint` 新增 `errorBaseline: 20`、`mustReachZero: true`、`dueBatch`（下一批清零卡，凌舟出卡；该批起门判据改 `error===0`，warning 仍冻结）；20 条 error 的**文件::规则清单**即基线内 `errorsByFileRule` 13 对（storage/member-detail/batch-price/settings/ai-chat×3 规则/product-detail×2/create-sale×4 规则）；`lint-gate.mjs` 绿时打印到期提醒（行为判据不变）。证据：`docs/evidence/qoder-1/口径收敛/lint-gate-after-ruling1.log`。
  - **裁定②（type 基线 12 条是过渡读数、不入台账）**：基线 `typeCheck.note` 已改写为"过渡态读数 + 合并顺序 = PR #363 先合 → 本分支 rebase → errors 清空、判据改 error===0"。本分支**暂未** rebase（#363 尚未进 `origin/main`：实测 main 尖端仍 `1ba1efd0`、crypto.ts 条件编译 3 处仍在）。
  - 裁定③④（卡 2 侧）落地见 `R101-QODER-2-回传.md` §十。

—— QODER（移动端执行方）｜2026-10-18
