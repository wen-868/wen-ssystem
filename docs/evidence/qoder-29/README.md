# QODER-29 · 移动端请求出口 / 业务码 / 凭据日志 —— 证据树

> 工作树：`D:\Users\ZXQL\wt-agents\QODER-29`｜分支：`fix/qoder-29-request-contract-security`｜基线：`6702ec08`（QODER-27 收敛态）
> 执行方：Qoder（移动端，受阿潵派发）｜2026-10-22
> 本树只登记**执行方亲跑读数**与反测台账，不含验收方判词。
> 所有门读数取自本工作树 HEAD 内容（`6702ec08` 之上的工作树），采集时刻见各文件内 vitest `Start at` 行。

## 文件索引

| 类别 | 文件 | 内容 |
| --- | --- | --- |
| 原始读数 | `raw/00-baseline-check-gates.log` | 改动**前**基线四门读数（tests 15/303，GATES_EXIT=0） |
| 原始读数 | `raw/10-gates-after.log` | 改动**后** `check:gates`（含新守卫）五门串跑，GATES_EXIT=0 |
| 原始读数 | `raw/20-build-h5.log` | `build:h5` EXIT=0 |
| 原始读数 | `raw/21-build-mp-weixin.log` | `build:mp-weixin` EXIT=0 |
| 原始读数 | `raw/22-build-app.log` | `build:app` EXIT=0 |
| 原始读数 | `raw/30-guard-inventory.json` | 静态守卫 `--json` 输出的全量直接调用盘点 + 登记册 |
| 台账 | `anti-test-ledger.md` | 四轮反测（注入→红→cp 复原→绿→SHA 恒等）逐轮明细 |
| 台账 | `inventory.md` | `uni.request/uploadFile/downloadFile` 全量清单与允许理由 |
| 台账 | `credential-audit.md` | MO-26 凭据日志审计（明文口令/令牌/csrf/密钥） |
| 反测证据 | `anti/01..04-*.txt` | 每轮的注入红点原始输出 + 注入前/注入后/复原后 SHA |

## 关键读数摘录（对应 `raw/10-gates-after.log` 行号）

| 门 | 读数 | 行号 |
| --- | --- | --- |
| type-check | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条` | `raw/10:10-11` |
| lint | `当前 error 0（基线 0）、warning 12872（基线 12872）` | `raw/10:17-18` |
| test | `Test Files 16 passed (16)` / `—— test 门：当前 16 文件 / 322 用例，基线 16 / 322 ——` | `raw/10:62,67-68` |
| check:contract | 口径① 291 ② 282 ③ 204／后端 1498／差集 1 条具名豁免 1 条 ⇒ EXIT=0 | `raw/10:76-80` |
| guard:request | `直接网络调用…共 8 处`／`✓ A 全部登记且未超额 · B 复用统一安全头 · C 无明文凭据日志 ⇒ EXIT=0` | `raw/10:86,96` |
| 合计 | `GATES_EXIT=0`（命令 `npm run check:gates`，见 `raw/10:3`） | `raw/10` 末 |

> `npm run check:gates` = `type-check && lint && test && check:contract && guard:request`（本卡把守卫接进常驻门禁链，见 `app-mobile/package.json`）。

## 反测四轮结论（明细见 `anti-test-ledger.md`）

| 轮 | 注入 | 红点 | 复原 SHA 恒等 | 复原后 |
| --- | --- | --- | --- | --- |
| ① | 摘掉 MO-11 业务码 reject | vitest 点名 ③④⑧ 红（②⑤⑥⑦ 仍绿=正对照） | `0a680815…` == | EXIT=0 19/19 |
| ② | 注入未登记 `uni.request` | 守卫 EXIT=1，点名 `login.vue:277`（A+B） | `bbed53e1…` == | EXIT=0 |
| ③ | 注入明文口令日志 | 守卫 EXIT=1，点名 `login.vue:277`（C） | `bbed53e1…` == | EXIT=0 |
| ④ | 摘掉一处 `buildRequestHeaders` 复用 | 守卫 EXIT=1，点名 `profile.ts`（B） | `1aed0a8a…` == | EXIT=0 |

## 未验 / 缺口（如实）

- **H5 运行态实开**：本卡未开浏览器/未连后端做端到端运行态取证；MO-11/MO-29/MO-26 的判据均以「真实驱动 request.ts 的单元用例 + 静态守卫机检」为据，运行态未验。
- **生产构建去 console**：属构建配置，本卡按派发口径**未动构建配置**，登记为待裁定项（见回传卡「风险与自我报备」），归属 QODER-31 处置。
- **成功码集合**：仅认定唯一真相源 `"0"`（`backend/src/shared/response.ts` 的 `ok()`）；若存在历史接口族回数字/其它码，已用 `String()` 归一兜底，但完整集合置信度待后端复核（回传卡已登记）。
