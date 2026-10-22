# ACTIVE-回执 · QODER-29（移动端请求出口、业务码与凭据日志收口）

> 对应派单：**QODER-29**（卡：`docs/tasks/inbox/QODER-29-request-contract-security.md`）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-29`｜分支：`fix/qoder-29-request-contract-security`｜基线：`6702ec08`（QODER-27 收敛态）
> 完整回传：`docs/tasks/cards/R101-QODER-29-阿潵回传.md`｜证据树：`docs/evidence/qoder-29/README.md`
> **执行方自评，不含验收方判词。**

```
【汇报 QODER-29】移动端请求出口、业务码与凭据日志收口
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-22
一句话：request.ts 识别后端 {code,msg,data} 信封，HTTP 2xx 但业务码非成功码("0") 走错误分支 reject+toast（不再当成功数据返回，MO-11）；
  抽出 buildRequestHeaders 作鉴权/租户/CSRF 唯一出处，ai/products/profile/update 四处直接调用全部复用（MO-29），
  update.checkAppUpdate 由裸 uni.request 收进统一入口 silent GET；login.vue 明文口令日志改长度脱敏、未新增 console（MO-26）；
  新增 scripts/guard-request-contract.mjs 静态守卫（A 登记/B 复用/C 凭据）接进 check:gates 常驻门禁链。
  check:gates EXIT=0（type 0／error 0·warning 12872 未劣化／tests 16·322 只升／contract 差集1豁免1／guard 8 处全登记 EXIT=0）；
  build:h5|mp-weixin|app 各 EXIT=0；新增 19 用例；反测四轮全部红点名 + cp 复原 SHA 逐字节恒等后复绿。
  ⚠ 运行态（真机/H5 实开连后端）未验；「生产构建剥离 console」属构建配置未动，登记待裁（转 QODER-31）；成功码仅认唯一真相 "0"。
```

## 待裁三件（都在回传卡有出处）

| # | 事项 | 执行方口径 | 出处 |
|---|---|---|---|
| 1 | 成功码集合是否只有 `"0"` | 按唯一真相源 `backend/src/shared/response.ts` `ok()` 与 `项目统一标准 §3.1` 认定 `"0"`，数字 0 用 `String()` 归一；不臆造集合，完整集合置信度请后端复核 | 卡 §一；回传卡 §回传格式-风险1 |
| 2 | 「生产构建剥离高噪声 console」 | 属构建配置（vite drop/pure 或 terser），本卡按派单口径**未动构建配置**，登记交阿潵转 QODER-31 处置 | 回传卡 §回传格式-风险2 |
| 3 | update 版本检查改走统一入口 | `resolveBase()` 与 `request.ts` 的 `BASE_URL` 等价、URL 主机不变；silent 出错被 catch 静默吞，与旧「取不到 data 就不提示」等价；若需失败也上报请裁 | 回传卡 §回传格式-风险3 |

## 收尾自检（文档笔之后实测）

- 提交序：实现笔 `ec8c7066`（逐文件显式 `git add` 10 个文件，未用 `-A`）；本回执 + 回传卡 + 证据树为文档笔（sha 见 `git log --oneline -1`，Git 自指约束）。
- 门与构建读数采于实现笔内容之上：`npm run check:gates` ⇒ `GATES_EXIT=0`（`docs/evidence/qoder-29/raw/10-gates-after.log`）；三构建 `raw/20/21/22-build-*.log` 各 `DONE Build complete.` + EXIT=0。
- `git status --porcelain` ⇒ **0 行**（文档笔提交后本会话收尾亲跑）。
- 红线：未 push、未开 PR、`git add` 全走显式路径未用 `-A`；文件面仅 `app-mobile/`，未碰后端/迁移/工作台/总台；未放宽现有测试（request-retry-safety.spec.ts 15 用例逐字保留且全绿）；未破坏 AI SSE 增量（单测⑰⑱⑲实测逐事件分发未吞）；未重放写请求（401 GET-only 逻辑未触碰）。

## DSH-RECEIPT

> 本区块所在文档笔无法引用自身 sha ⇒ `commits` 末项写「本区块所在文档笔（sha 见 `git log --oneline -1`）」。

```
===DSH-RECEIPT-BEGIN===
id: QODER-29
status: DONE
summary: 移动端请求出口/业务码/凭据日志三合一收口完成 —— request.ts 识别后端信封并对 2xx+非成功码走错误分支（MO-11），抽出 buildRequestHeaders 统一鉴权/租户/CSRF，四处直接调用(ai×4/products/profile/update)全部复用（MO-29），update.checkAppUpdate 收进统一入口 silent GET，login.vue 明文口令日志改长度脱敏且未新增 console（MO-26）；新增静态守卫 guard-request-contract.mjs（A/B/C）接进 check:gates；新增 19 用例，gates-baseline tests 段 15/303→16/322（append-only、CRLF 保留）。check:gates EXIT=0，三构建各 EXIT=0，反测 4 轮全红点名 + cp 复原 SHA 恒等复绿。⚠ 运行态未验；构建剥离 console 与成功码集合置信度待裁。
worktree: D:\Users\ZXQL\wt-agents\QODER-29
branch: fix/qoder-29-request-contract-security
commits: ec8c7066（实现笔）＋ 本区块所在文档笔（sha 见 git log --oneline -1）
evidence: docs/evidence/qoder-29/README.md,docs/evidence/qoder-29/inventory.md,docs/evidence/qoder-29/credential-audit.md,docs/evidence/qoder-29/anti-test-ledger.md,docs/evidence/qoder-29/raw/10-gates-after.log,docs/evidence/qoder-29/raw/00-baseline-check-gates.log,docs/evidence/qoder-29/raw/20-build-h5.log,docs/evidence/qoder-29/raw/21-build-mp-weixin.log,docs/evidence/qoder-29/raw/22-build-app.log,docs/evidence/qoder-29/raw/30-guard-inventory.json,docs/evidence/qoder-29/anti/
return_card: docs/tasks/cards/R101-QODER-29-阿潵回传.md
gates: cd app-mobile && npm run check:gates => GATES_EXIT=0, vue-tsc EXIT=0(0/0), lint error 0=0 / warning 12872=12872, Test Files 16 passed / Tests 322 passed = 基线16/322, check:contract 差集1·豁免1 EXIT=0, guard:request 8处全登记 EXIT=0; npm run build:h5|build:mp-weixin|build:app => 各 EXIT=0; 反测①摘业务码reject=>MO-11③④⑧红(②⑤⑥⑦绿=正对照) ②注入未登记uni.request=>guard EXIT=1 点名 login.vue:277 ③注入明文口令日志=>guard EXIT=1 点名 login.vue:277 ④摘 buildRequestHeaders=>guard EXIT=1 点名 profile.ts；四轮 cp 复原 SHA256==注入前(request 0a680815 / login bbed53e1 / profile 1aed0a8a)且复跑 EXIT=0; git status --porcelain=>0 行
redlines: 遵守（未 push／未开 PR／逐文件显式 git add 未用 -A；只动 app-mobile/，后端/迁移/工作台/总台 0 改动；未放宽现有测试；未破坏 AI SSE 增量；未重放写请求；gates-baseline 仅 tests 段上调+note 追加，其余四段零 hunk）
===DSH-RECEIPT-END===
```
