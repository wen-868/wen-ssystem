# R101-QODER-29 回传卡 · 移动端请求出口、业务码与凭据日志收口

> 任务书：`docs/tasks/inbox/QODER-29-request-contract-security.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-29`｜分支：`fix/qoder-29-request-contract-security`｜基线：`6702ec08`（QODER-27 收敛态）
> 本卡是**执行方自评 + 待裁项清单**，不含任何验收方判词（不写「裁定 / 验收通过 / 准予合并」）。

## 回传格式（照抄填满）

```
【汇报 QODER-29】移动端请求出口、业务码与凭据日志收口
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-22
执行通道：Qoder
交付物：实现笔 ec8c7066e419cc8d514c5b54eb07fa787e7af636（`git rev-parse HEAD`，父提交 = 6702ec08）
  ① app-mobile/src/api/request.ts —— 后端 {code,msg,data} 信封识别 + 2xx 业务码错误分支 + 抽出 buildRequestHeaders（MO-11 / MO-29）
  ② app-mobile/src/api/modules/ai.ts / products.ts / profile.ts、app-mobile/src/utils/update.ts —— 四处直接调用复用 buildRequestHeaders；checkAppUpdate 收进统一入口（MO-29）
  ③ app-mobile/src/pages/login/login.vue:276 —— 明文口令日志改长度脱敏（MO-26）
  ④ app-mobile/scripts/guard-request-contract.mjs —— 静态守卫 A/B/C，接进 check:gates
  ⑤ app-mobile/package.json —— check:gates 末段追加 guard:request
  ⑥ app-mobile/tests/request-contract.spec.ts —— 19 用例
  ⑦ app-mobile/scripts/gates-baseline.json —— tests 段 15/303 → 16/322（append-only note，保留 CRLF）
  （本卡 + 回执 + 证据树 = 文档笔，哈希请用提交后 `git rev-parse HEAD` 现场实测，不预写）
证据（可复跑）：npm run check:gates ⇒ GATES_EXIT=0（docs/evidence/qoder-29/raw/10-gates-after.log:3,10-11,17-18,62,67-68,78,86,96）
  type-check EXIT=0 错误 0/0（raw/10:10）；lint error 0/0、warning 12872/12872 未劣化（raw/10:17）；
  test 16 文件 / 322 用例 = 基线 16/322（raw/10:62,67）；check:contract 差集 1 具名豁免 1 ⇒ EXIT=0（raw/10:78-80）；
  guard:request 共 8 处全登记 ⇒ EXIT=0（raw/10:86,96；盘点 raw/30-guard-inventory.json）；
  build:h5 / mp-weixin / app 各 EXIT=0（raw/20,21,22-build-*.log）；反测四轮台账见 docs/evidence/qoder-29/anti-test-ledger.md
验收自评：① MO-11 业务码走错误分支 = 通过（单元 ③④⑧ reject，反测①摘判定即红）
  ② 401/403/CSRF/清态保持、不重放写请求 = 通过（沿用 QODER-14 语义，本卡未改；单测⑬ GET 重试一次、⑭ 403；request-retry-safety.spec.ts 15 用例仍绿）
  ③ MO-29 统一出口 + 直接调用复用安全头 + 静态守卫进门禁链 = 通过（盘点 8 处全登记、B 全复用；反测②④注入即红）
  ④ MO-26 凭据日志 = 通过（全 src 仅 2 条凭据相关 console 且皆长度脱敏；未新增 console；未动构建配置）
  ⑤ 专项测试 19 用例 + 四组反测红/复原 SHA 恒等 = 通过（见 anti 台账）
  ⑥ 三构建 EXIT=0 = 通过；⑦ tests 只升不降 16/322 = 通过
  ⚠ 运行态（真机 / H5 实开连后端）= 未验：本卡判据均为「真实驱动 request.ts 的单元用例 + 静态机检」，无端到端读数
未完成与阻塞：无（代码与门禁全绿；唯「生产构建剥离 console」不在本卡动作面，见下风险项）
风险与自我报备：
  1. 成功码集合置信度：仅认定唯一真相源 "0"（backend/src/shared/response.ts 的 ok() + 项目统一标准 §3.1）；
     若历史接口族回数字/其它码，已用 String() 归一兜底，但完整集合请后端复核。
  2. 待裁定项（不在本卡面）：「生产构建剥离高噪声 console」属构建配置（vite drop/pure 或 terser），
     本卡按派单口径未动构建配置，登记并交阿潵转 QODER-31 处置。
  3. update.checkAppUpdate 改走统一入口：resolveBase() 与 request.ts BASE_URL 等价、URL 主机不变；
     silent GET 出错被 catch 静默吞掉，与旧「取不到 data 就不提示」等价。若需版本检查失败也上报，请裁。
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-29-阿潵回传.md
关联卡：docs/tasks/inbox/QODER-29-request-contract-security.md
```

---

## 一、逐条交付说明（行号 = 实现笔 `ec8c7066`）

- **MO-11（业务码）**：`request.ts:49` 定义 `BUSINESS_SUCCESS_CODE = '0'`（唯一真相源，注释指向 `backend/src/shared/response.ts` 与 `docs/项目统一标准.md` 第三章 3.1，不臆造成功码集合）；`request.ts:183-206` 的 2xx 分支：带 `code` 信封时 `String(resData.code) !== '0'` ⇒ reject + toast（silent 不弹），等于 '0' 才解包 `data`；裸数组/裸对象（无 `code`）维持原透传。
- **MO-29（安全头复用）**：`request.ts:81-93` 抽出 `export function buildRequestHeaders(extra?)`，产出 Content-Type + Authorization + X-Tenant-Id + x-csrf-token；缺登录态时对应头省略；安全头写入在 extra 之后，优先级最高。四处直接调用（`ai.ts:46`、`products.ts:602`、`profile.ts:46`、`update.ts:181`）全部复用之。
- **MO-29（收口 + 守卫）**：`update.ts:298-327` `checkAppUpdate` 由裸 `uni.request` 改 `request({ …, timeout:8000, silent:true })`。`scripts/guard-request-contract.mjs` 检查 A（直接调用登记额度）、B（含直接调用且非 request.ts 者必须引用 `buildRequestHeaders(`）、C（console 明文凭据）；`package.json:20` `check:gates` 末段追加 `&& npm run guard:request`。
- **MO-26（凭据日志）**：`login.vue:276` 明文口令日志改长度脱敏；未新增任何 `console.*`（lint warning 12872 未劣化即证）；构建配置未动。
- **测试**：`tests/request-contract.spec.ts` 19 用例（MO-11 业务码 7 + MO-29 安全头 4 + 401/403/网络/超时 4 + AI SSE 增量 3 + MO-26 静态兜底 1）。`gates-baseline.json` tests 段 `15/303 → 16/322`，note 末尾 append-only 追加，CRLF 保留（47 行全 CRLF、裸 LF=0）。

## 二、红线自查

- 未 push、未开 PR、未 `git add -A`/`git add .`（实现笔逐文件显式 `git add`，文档笔另笔）。
- 未改后端/迁移/工作台/总台（本卡文件面仅 `app-mobile/`）。
- 未放宽现有测试：request-retry-safety.spec.ts（401/403/清态/upload 死导出）15 用例逐字保留且全绿。
- 未破坏 AI SSE 增量：AI 走独立 `AI_BASE_URL`、不经 `request.ts`；`dispatchSseText` 逐事件分发未动，单测⑰⑱⑲实测增量未被吞。
- 未重放原写请求：401 仍 GET-only 静默重试（本卡未触碰该逻辑）。
