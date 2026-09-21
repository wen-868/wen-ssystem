# R101-G2 · G-1 门禁体检收口 —— 红测取证附件

> 取证日期：2026-09-22 ｜ 取证方：林夕（UI/UX）｜ 性质：**只读取证**，未合并任何分支、未改任何 workflow
> 主仓：`D:/Users/ZXQL/ZXQL-MS/wen-ssystem`（`main` @ `eb33bfe9`）
> 复跑脚本：`D:/Users/ZXQL/ZXQL-MS/_g2_wf_jobs.cjs`、`_g2_runs.cjs`、`_g2_main_clean.cjs`、`_g2_a11y_drift.cjs`

---

## §0 全仓 workflow / job 全景（G-1 验收硬③：给 job 总数与逐 job 行号）

**5 个 workflow 文件 / 7 个 job**（扫描脚本 `_g2_wf_jobs.cjs`，按 `^jobs:` 顶格 + `^  <name>:` 二级缩进识别）

| # | workflow | 行号 | `on:` | job | job 行号 | 触发条件 |
|---|---|---|---|---|---|---|
| 1 | `build-exe.yml` | 52 | L3 | `build-windows` | **L11** | push main（paths `admin-web/**`）+ workflow_dispatch |
| 2 | `ci.yml` | 190 | L3 | `build-and-test` | **L9** | push main + pull_request |
| 3 | `ci.yml` | 190 | L3 | `migration-check` | **L136** | 同上 |
| 4 | `codeql.yml` | 40 | L3 | `analyze` | **L13** | push main + PR(main) + 每周一 02:00 cron |
| 5 | `deploy.yml` | 56 | L3 | `deploy` | **L42** | push main（paths-ignore `docs/**`、`**.md`、`.github/**`、`e2e/**`） |
| 6 | `e2e.yml` | 231 | L3 | `e2e` | **L9** | push main + pull_request |
| 7 | `e2e.yml` | 231 | L3 | `a11y` | **L136** | 同上 |

**job 总数 = 7**（`build-windows` 1 + `ci.yml` 2 + `analyze` 1 + `deploy` 1 + `e2e.yml` 2）。

分支保护实测（`gh api .../branches/main/protection`）：
`required_status_checks.contexts = ["build-and-test", "e2e"]`，`strict = false`。
⇒ **7 个 job 中只有 2 个是 required**，其余 5 个不阻断合并。

---

## §1 三分支 × run / job / step 取证表（步骤级）

### 1.1 `g1-red-adminweb`（RT-6，头部 `5275cc2a`）

破坏内容（`git diff --stat main...g1-red-adminweb`）：
```
 admin-web/src/main.ts | 2 ++
 1 file changed, 2 insertions(+)
```
提交标题：`G-1 RT-6 红测：admin-web/src/main.ts 注入语法错误（证明 Build admin web 门禁会红）`

| run id | workflow | 结论 | 步骤级结论（只列非 success） |
|---|---|---|---|
| **35537448178** | CI | failure | job `build-and-test`：**step 14 `Build admin web` = failure**（step 15 起全部 skipped） |
| 35537448178 | CI | failure | job `migration-check`：step 7 `Run migrations via server boot and verify tables` = failure |
| **35537448116** | E2E | failure | job `e2e`：**step 11 `Run E2E tests (admin-web, Playwright + axe) —— 排除 @a11y 漂移用例` = failure**（step 12 起 skipped） |
| 35537448116 | E2E | failure | job `a11y`：**step 10 `a11y sampling verdict (如实判定，红就是红)` = failure** |
| 35537448128 | CodeQL SAST | success | 全步骤 success（`Perform CodeQL Analysis` = success） |

### 1.2 `g1-red-build-saas`（RT-1，头部 `90161671`）

破坏内容：
```
 saas-admin/src/main.ts | 4 ++++
 1 file changed, 4 insertions(+)
```
提交标题：`🔴 G-1 RT-1 红测取证：Build saas admin 故意注入语法错误（禁止合并）`

| run id | workflow | 结论 | 步骤级结论 |
|---|---|---|---|
| **35537365431** | CI | failure | job `build-and-test`：**step 15 `Build saas admin` = failure**（step 14 `Build admin web` = success，证明两步骤互不掩蔽）|
| 35537365431 | CI | failure | job `migration-check`：step 7 = failure |
| **35537365467** | E2E | failure | job `e2e`：**全步骤 success**（含 step 11 / step 12 `saas-admin a11y gate`）——⚠️ 见 §4 盲区 |
| 35537365467 | E2E | failure | job `a11y`：**step 10 `a11y sampling verdict` = failure** |
| 35537365463 | CodeQL SAST | success | 全步骤 success |

### 1.3 `g1-red-lint`（头部 `f1f183f7`）—— 🔴 **零 run**

- 远端不存在：`git ls-remote origin 'refs/heads/*g1*'` 只返回 `g1-red-adminweb`（`5275cc2a`）与 `g1-red-build-saas`（`90161671`），**无 `g1-red-lint`**
- Actions 侧：`run` 查询（`per_page=100` 逐页，共拉到 800 条）中 `head_branch == "g1-red-lint"` 命中 **0 条**
- 分支内容：`git log --oneline -1 g1-red-lint` → `f1f183f7 docs(派单 G-1): S3-50 门禁体检收口…（执行方 林夕）`
  —— **是派单文档提交，不是破坏性改动**；`git diff --stat main...g1-red-lint` 无代码改动

⇒ 该分支**名为 lint 红测，实际从未做任何 lint 红测**（未推送 + 无破坏性改动）。

---

## §2 PR #35 状态

```
title           : G-1 RT-6 红测：证明 Build admin web 门禁会红（draft）
state           : open | draft=true | merged=false
mergeable_state : unknown
base            : main
head            : g1-red-adminweb @ 5275cc2a5e1878d9bc9c8d1e7af01df1d66c5b99
url             : https://github.com/wen-868/wen-ssystem/pull/35
```
⇒ **未合并**，仍 draft。

---

## §3 main 未受污染核实

| 项 | 实测 |
|---|---|
| main 最近 5 个 CI run | `35629655537`/`35627335860`/`35625225897`/`35622803503`/`35622726622`：`build-and-test` 全 **success** |
| main 最近 6 个 E2E run | `35629655527`/`35627335874`/`35625225854`/`35622803548`/`35622726452`/`35622656245`：`e2e` + `a11y` 全 **success** |
| 三分支是否合入 | `merged=false`；`git diff --stat main...<b>` 显示改动**只存在于分支上** |

⇒ 反测改动**全部留在分支内**，main 未受影响。

---

## §4 `a11y` 是否漂移 —— 对照组成立（关键判据）

红测时段（2026-09-20 15:00Z ~ 2026-09-21 06:00Z）内 **33 个 E2E run**：

| 分支 | a11y 结论 |
|---|---|
| `main` × 20 个 run（20:41 / 21:20 / 21:29 / 21:36 / 21:55 …）| 全 **success** |
| `fix/s3-70-affectedrows`、`test/d1-concurrency-proof`、`fix/s3-65-change-password-fail`、`fix/c2-deploy-concurrency` × 3 | 全 **success** |
| **`g1-red-adminweb`** `35537448116` | **failure** |
| **`g1-red-build-saas`** `35537365467` | **failure** |

最近 40 个 E2E run 的 a11y 历史：`success=38 / failure=2`（2 次失败恰为这两个红测分支）。

⇒ **a11y 的红归因于注入的破坏，不是漂移**。

⚠️ **一处机制未解释（如实报备，不写死结论）**：`g1-red-build-saas` 的破坏点在 `saas-admin/src/main.ts`，而 `a11y` job 只 `Start admin-web dev server`（step 7），其 `e2e` job 的 step 12 `saas-admin a11y gate (contrast matrix)` 却是 **success**。为什么 saas-admin 的构建破坏会让 admin-web 的 a11y verdict 红，**机制未查明**，需要再查一步，本轮不归因。

---

## §5 `migration-check` 恒红 —— 无分辨力

main 上最近 **5 个** CI run 的 `migration-check` **全部 failure**，同时 `build-and-test` **全部 success**。
失败步骤：`Run migrations via server boot and verify tables`（step 7）。

判据（门禁真假看历史成功率，不看当前颜色）：**恒红的检查无法区分"好提交"与"坏提交" ⇒ 无分辨力**。

---

## §6 复跑命令汇总

```bash
# 1) 全仓 workflow / job 全景
node D:/Users/ZXQL/ZXQL-MS/_g2_wf_jobs.cjs

# 2) 三分支 run + 步骤级结论 + PR #35
node D:/Users/ZXQL/ZXQL-MS/_g2_runs.cjs

# 3) main 洁净核实 + 分支保护 required checks
node D:/Users/ZXQL/ZXQL-MS/_g2_main_clean.cjs

# 4) a11y 漂移对照组
node D:/Users/ZXQL/ZXQL-MS/_g2_a11y_drift.cjs

# 原始接口（.cjs 内已封装，此处给等价直查）
gh api repos/wen-868/wen-ssystem/actions/runs?per_page=100
gh api repos/wen-868/wen-ssystem/actions/runs/<run_id>/jobs?per_page=100
gh api repos/wen-868/wen-ssystem/pulls/35
gh api repos/wen-868/wen-ssystem/branches/main/protection
git ls-remote origin 'refs/heads/*g1*'
git diff --stat main...g1-red-adminweb
```

> ⚠️ Windows Git Bash 下 `gh api` 参数含 `?`/`|`/`{}` 会被吞，脚本内统一用 `execFileSync('gh', ['api', ...])` 传数组。
