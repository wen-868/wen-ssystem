# QODER-29 · 反测台账（派单规范 §9.1 顺序：先更新基线 ⇒ 再注入违规 ⇒ 逐字节复原 ⇒ 复绿）

> 全部注入用**编辑器单行改动**，复原一律 `cp`（从**工作树外** `/tmp/q29bak/*.bak` 逐字节恢复，未用 `sed -i`/正则回写）。
> 每轮记录三个 SHA256（`sha256sum`，形态 = worktree-crlf）：注入前完好态、注入后、复原后；证明**复原后 == 注入前**。
> 注入的三份工作树完好态基线 SHA（= 本卡交付态）：
> - `src/api/request.ts` = `0a6808154d829790fe54eacf58d1cd5342c762dfc6d0755ca1174cc33c1249f1`
> - `src/pages/login/login.vue` = `bbed53e1f4bf5c33ff77fb7ecd57c1579f615d6120c7fb51b857bf316a63cbfa`
> - `src/api/modules/profile.ts` = `1aed0a8ab89fb2b4e4b72e319873e4bbe79c7696f67f063b70efed118d8afcc3`

---

## 轮 ① 关闭业务码判定 ⇒ 目标用例红

- **注入**：`request.ts` 把 MO-11 reject 条件改为 `if (false && String(resData.code) !== BUSINESS_SUCCESS_CODE)`（仅摘 reject 分支短路，成功码 '0' 的解包路径不动）。
- **命令**：`node ../node_modules/vitest/vitest.mjs run tests/request-contract.spec.ts` ⇒ `INJECT_TEST_EXIT=1`（`anti/01-disable-business-code-check.txt`）。
- **红点（点名 3 条）**：
  - `③ 200 + code "1001"（业务失败）⇒ reject 且弹 msg` （spec.ts:119）
  - `④ 200 + code "400" 且 msg 为空 ⇒ reject 兜底文案带业务码` （spec.ts:127）
  - `⑧ 200 + 业务失败 + silent ⇒ reject 但不弹 toast` （spec.ts:150）
- **正对照（证伪「整片红」）**：同次运行 `②/⑤/⑥/⑦`（成功码解包 / 数字 0 / 无 data 透传 / 裸数组）**仍绿**，`Tests 3 failed | 16 passed (19)` ⇒ 红点精确落在业务码 reject，非全局崩溃。
- **SHA**：注入后 `524a0ecf…`（`anti/01-injected-sha.txt`）≠ 复原后 `0a680815…`（`anti/01-restored-sha.txt`）== 完好态基线。
- **复原**：`cp /tmp/q29bak/request.ts.bak` ⇒ 复跑 `19 passed` `EXIT=0`。

## 轮 ② 注入未登记的 `uni.request` ⇒ 静态守卫红

- **注入**：`login.vue:277` 追加 `uni.request({ url: '/anti-test-unregistered-probe', method: 'GET' })`（非注释代码行）。
- **命令**：`node scripts/guard-request-contract.mjs` ⇒ `EXIT=1`（`anti/02-inject-unregistered-uni-request.txt`）。
- **红点（点名）**：
  - `✗ [A] … login.vue: 实际 1 > 登记 0 — src/pages/login/login.vue:277 uni.request`
  - `✗ [B] 直接调用未复用统一安全头 buildRequestHeaders：src/pages/login/login.vue`
- **SHA**：注入后 `c92bed3c…`（`anti/02-injected-sha.txt`）≠ 复原后 `bbed53e1…`（`anti/02-restored-sha.txt`）== 完好态基线。
- **复原**：`cp /tmp/q29bak/login.vue.bak` ⇒ 守卫 `EXIT=0`（`anti/02-green-after-restore.txt`）。

## 轮 ③ 注入明文口令日志 ⇒ 静态守卫红

- **注入**：`login.vue` 追加非注释行 `console.log('anti-test-plaintext', loginForm.password)`。
- **命令**：`node scripts/guard-request-contract.mjs` ⇒ `EXIT=1`（`anti/03-inject-plaintext-password-log.txt`）。
- **红点（点名）**：`✗ [C] console 日志出现明文凭据取值（MO-26）：src/pages/login/login.vue:277  console.log('anti-test-plaintext', loginForm.password)`。
- **SHA**：注入后 `b9105d71…`（`anti/03-injected-sha.txt`）≠ 复原后 `bbed53e1…`（`anti/03-restored-sha.txt`）== 完好态基线。
- **复原**：`cp /tmp/q29bak/login.vue.bak` ⇒ 守卫 `EXIT=0`（`anti/03-green-after-restore.txt`）。

## 轮 ④ 摘掉一处安全头复用 ⇒ 静态守卫红

- **注入**：`profile.ts` 把 `uploadAvatar` 的 `const header = buildRequestHeaders()` 改回内联自拼 `const header = { Authorization: 'Bearer ' + uni.getStorageSync('merchant_token') }`（文件仍有 `uni.uploadFile` 直接调用，但不再引用 `buildRequestHeaders(`）。
- **命令**：`node scripts/guard-request-contract.mjs` ⇒ `EXIT=1`（`anti/04-remove-header-reuse.txt`）。
- **红点（点名）**：`✗ [B] 直接调用未复用统一安全头 buildRequestHeaders：src/api/modules/profile.ts`（同时该调用点仍标 `✔ 已登记` ⇒ 证明是「复用」被摘，不是调用消失）。
- **SHA**：注入后 `0711e0f4…`（`anti/04-injected-sha.txt`）≠ 复原后 `1aed0a8a…`（`anti/04-restored-sha.txt`）== 完好态基线。
- **复原**：`cp /tmp/q29bak/profile.ts.bak` ⇒ 守卫 `EXIT=0`（`anti/04-green-after-restore.txt`）。

---

## 复原后全局完好性确认

四轮复原后，三份被注入文件 SHA 均逐字回到完好态基线（见各轮「SHA == 完好态基线」），且：
- `src/api/request.ts` = `0a680815…`、`src/pages/login/login.vue` = `bbed53e1…`、`src/api/modules/profile.ts` = `1aed0a8a…`（收尾复核 `sha256sum` 一致）。
- `raw/10-gates-after.log` 的 `GATES_EXIT=0` 采于该完好态之上，反测未改动任何交付态字节。
