# S3-50「CI run 级红测」补做证据（凌舟亲跑，2026-10-16）

> 目的：把 S3-50 未闭环清单里"**有本地等效反测（B 级）、但没有一次 CI run 证明该步骤会红**"的条目补齐为 **A 级（步骤级红）**。
> 口径（门禁铁律第 2 条）：**job 级红 ≠ 步骤级红**；断言的成立条件是"**失败落在该步骤自身、且同级其它步骤全 success**"。
> 做法：每个目标一条 **draft PR**（`pull_request` 才会触发 `ci.yml`/`e2e.yml`），注入一处最小破坏，采集 `run id + job + 步骤名 + 结论`，**取证后关 PR、删分支**。
> ⚠️ **一次只坏一个目标**；反测 PR **一律 draft、从不合并**；不碰生产（见 §3 的代理项说明）。

---

## 1. 逐条结果（A 级）

| 清单# | 目标步骤（当前 workflow 的步骤名与步号） | 分支 / PR | run id | **该步骤结论** | 同级其它步骤 |
|:--:|:--|:--|:--:|:--|:--|
| **#1** | `CI / build-and-test` 步 6 `Contrast / a11y token gate (WCAG AA)` | `rt/s3-50-contrast` / #334 | **38785179376** | **failure** | 1–5 全 success |
| **#10** | `E2E / e2e` 步 12 `saas-admin a11y gate (contrast matrix)` | 同上（同一脚本，一次取证两处） | **38785175267** | **failure** | 步 9/11 success |
| **#2** | `CI / build-and-test` 步 8 `Backend lint gate (zero error)` | `rt/s3-50-lint` / #335 | **38785257489** | **failure** | 步 5/6/7 success（无前置掩蔽） |
| **#3** | `CI / build-and-test` 步 16 `Build backend` | `rt/s3-50-tsc` / #336 | **38785310828** | **failure** | 步 1–15 全 success |
| **#5** | `CI / build-and-test` 步 27 `Wait for backend` | `rt/s3-50-wait` / #337 | **38785374250** | **failure** | 步 26 `Start mock backend` success（掩蔽风险样本，已排除） |
| **#6** | `CI / build-and-test` 步 28 `Flow self test` | `rt/s3-50-flow` / #338 | **38785468811** | **failure** | 步 26/27 success（不再是"后端没起来"的解释） |
| **#7** | `CI / build-and-test` 步 29 `QA regression test` | `rt/s3-50-qa` / #339 | **38785518850** | **failure** | 步 28 `Flow self test` success（两步互不掩蔽） |
| **#9** | `E2E / e2e` 步 9 `密闭性取证（S3-59.1）：/api 必须打到 mock，不得回落生产` | `rt/s3-50-seal-proxy` / #340 | **38788366711** | **failure** | 步 5/6/7/8 success ⇒ 红来自**代理路径**而非"后端起不来" |
| **#8** | `E2E / e2e` 步 7 `Start admin-web dev server` | `rt/s3-50-e2e-boot` / #341 | **38788284085** | **failure** | 步 5/6 success |
| **#4** | `CI / build-and-test` 步 15 `Build saas admin` | **只读核对，无需补做** | **35537365431** | **failure**（历史 run 已证） | 步 1–14 全 success ⇒ 原"G-2 vs D3 记录冲突"**以本 run 判为：确为步骤级红，真门禁** |
| **#11** | `build-exe.yml / build-windows` 步 5 `Build Vite` | **只读核对，无需补做** | **32651399224** | **failure**（历史 run 已证） | 步 1–4 success ⇒ G-2 的"从未运行"说法**不成立**（该 workflow `total_count=275`，`status=failure` 计数 **244**） |

**#4 / #11 的核对命令（可复跑）**：
```powershell
gh api "repos/wen-868/wen-ssystem/actions/runs/35537365431/jobs?per_page=100" --jq '.jobs[] | select(.name=="build-and-test") | .steps[] | "\(.number)\t\(.name)\t\(.conclusion)"'
gh api "repos/wen-868/wen-ssystem/actions/workflows/build-exe.yml/runs?per_page=20" --jq '.total_count'
gh api "repos/wen-868/wen-ssystem/actions/runs/32651399224/jobs?per_page=100" --jq '.jobs[] | .steps[] | "\(.number)\t\(.name)\t\(.conclusion)"'
```

## 2. 造错方式与失败日志原文（节选）

| # | 造错（1 处，最小） | 失败日志原文（节选） |
|:--:|:--|:--|
| #1 | `saas-admin/src/styles/tokens.css`：`--text-primary: #000000 → #cccccc` | `saas-admin token \| --text-primary #CCCCCC \| 白底 #FFFFFF \| 1.61:1 \| 4.5 \| FAIL`／`白底 #f7f7f7 \| 1.50:1 FAIL`／`#f0f0f0 \| 1.41:1 FAIL` ⇒ `❌ 对比度矩阵存在 3 个不达标项` |
| #10 | 同上 | `##[error]--text-primary #CCCCCC × 白底 #FFFFFF = 1.61:1 < 4.5 (WCAG AA 文本)`；`- [saas-admin/src/styles/tokens.css] …`（**点名到源文件**） |
| #2 | `backend/src/server.ts` 末尾注入 `var s350LintProbe = 1;` | `304:1  error  Unexpected var, use let or const instead  no-var` |
| #3 | 同文件注入 `export const s350TscProbe: number = "s3-50 RT";`（**类型错误**：tsc 读、eslint 不读 ⇒ 不会误伤步 8） | `src/server.ts(304,14): error TS2322: Type 'string' is not assignable to type 'number'.` |
| #5 | `ci.yml` 步 27 的 `wait-on` 目标端口 8080 → **8099**（无人监听） | `Error: Timed out waiting for: http://127.0.0.1:8099/health` |
| #6 | `scripts/self-test.mjs` 末尾 `throw new Error("s3-50 RT: flow self test deliberate failure")` | `Error: s3-50 RT: flow self test deliberate failure` |
| #7 | `scripts/qa-regression-test.mjs` 末尾 `throw new Error("s3-50 RT: qa regression deliberate failure")` | `Error: s3-50 RT: qa regression deliberate failure` |
| #8 | `e2e.yml` 步 7 内：dev server 仍起 5173，`wait-on` 目标改 **5175** | `Error: Timed out waiting for: http://127.0.0.1:5175` |
| #9 | `admin-web/vite.config.ts` 的 `/api` 代理 **强制写死** `http://127.0.0.1:8099` | 步骤 exit 1（该步只有两个断言分支，直连 8080 为 mock 且步 6 绿 ⇒ 红落在"经代理未带 mock 标记"分支） |

## 3. 如实报备的两次"打偏"（都留痕，不粉饰）

1. **#9 第一次打偏（v1 无效）**：只把 `vite.config.ts` 的**默认值**改成死端口 ⇒ **run 38785920401 该步骤仍 success**。
   根因：`e2e.yml` 用 env `VITE_API_PROXY_TARGET=http://127.0.0.1:8080` **覆盖了默认值** ⇒ 改默认值不生效。
   ⇒ v2 改为**强制写死**（并保留该注释），run 38788366711 红。**教训：要改"真正生效的输入"，不是改"看起来该改的那一层"。**
2. **#9 未按清单建议"把代理指回生产"**：那样会让 CI 真的打到生产。改为指**本地死端口**，同样证成"代理目标不是 mock ⇒ 该步必红"，且**不制造任何生产流量**（反测纪律：不得对生产做写操作）。

## 4. S3-61 取样侧（同一批取证）

| 项 | 做法 | 结果 |
|:--|:--|:--|
| **连续 10 次取样** | 只读：取 main 上**最近 10 次 E2E run**，逐次读 `a11y` job 的两个 `sampling verdict` 步骤 | **10/10 次全 success**（每次内部 10 个 admin-web 样本 + 3 个 saas-admin 样本）⇒ 稳定化后**无漂移复现** |
| **反测（改坏 token ⇒ 必须红）** | 分支 `rt/s3-61-token-break` / PR #342：`admin-web/src/styles/tokens.css` 的 `--text-muted: #6d6d6d → #cccccc`（与批D §6.3 执行单同口径；该 token 在 admin-web 有 **62 处**引用） | 🔴 **未红**：run **38788778207** 的 `a11y` job 步 11/12/14 **全 success**，10 个 sample `playwright exit=0` |

**反测未通过的根因（已定位，非猜测）**：
- 取样扫描**只覆盖 4 个路由**（`/login`、`/dashboard`、`/customers`、`/instant-retail/config`；日志原文：`声明路由=164，本次扫描=4，未扫描=160`）⇒ 大量使用 `--text-muted` 的页面/组件不在覆盖面内；
- 对比度**矩阵**门禁的覆盖清单只读 **`saas-admin/src/styles/tokens.css`** + admin-web 的 `CHART_COLORS`（`scripts/contrast-check.cjs:33` 单一路径 + `:186` 图表色）⇒ **admin-web 自身文本 token 不在任何对比度门禁的覆盖清单里**（62 处引用的全局 token 无门禁）。

⇒ 结论：**S3-61 的"稳定化不得把真问题一起洗掉"这一条尚未证成**，该 job **不得回 required**；并据"发现即编号"登记为新条目（总清单第 71 项）。
