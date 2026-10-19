# ACTIVE-回执-QODER-10 · 移动端收尾三件（dismissBanner 接 × / note 过期 / 4 条陈旧清理）

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-10-移动端收尾三件.md`｜回传卡：`docs/tasks/cards/R101-QODER-10-回传.md`（十项齐）
> 分支 `chore/qoder-10-mobile-closeout2`｜基线：**#368 尖端 `844515d5`**
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 三件（全部按任务书口径执行）

- ① **dismissBanner 接到 ×**：functions.vue / more-functions.vue 横幅各挂 `<text class="*-banner-close" @tap="menuStore.dismissBanner()">×</text>`；「仅本次会话」store 侧本就成立（内存 ref + catch 复位、无持久写），本件补齐的是 × UI，并以用例把「③态⇒出现⇒×⇒消失⇒再③态⇒重现」四步 + 存储键零新增常驻进门禁（test 门 53→56）。
- ② **note 过期刷新**：`island-aftersale` note 改「4 条已接 `sale:return`（`aftersale.routes.ts`:49/51/69/74）⇒ 本门 gated」；`entry-gate-consistency.spec.ts` 三处联动（文件头判据 2、PENDING_WIRING 理由串行号修正、note 断言转 `已接/gated`）；`rg "S3-250|未接"` 于 permission-gates.ts **0 命中**（全 app-mobile `S3-250` 亦 0）。
- ③ **4 条陈旧具名清理**：逐条判定全部「已接线可删」（S3-238 `requirePlatformPermission("tenant:manage")` inline，行级断言在测试侧独立锁定）；platform-applications 整键删、tenant-register 删 approve/reject **保留** register/sms-code（authForm=none 真公开）；`_counts` 293→289 / files 88→87 / wired 419→423，和式 **763 守恒**，`wiredPermOccurrences` 390 不动。

## 判据自评

- ①四步装置原始输出 ✅ `raw/05`；反测（摘 × ⇒ EXIT=1 点名 ⇒ cp 复原 sha 逐字节一致 ⇒ 复跑绿）✅ `anti/` 五件套。
- ②禁词 0 命中（MSYS 排除态）✅ `raw/04`。
- ③**清理前 293 / 清理后 289 / 未登记 0 / 陈旧 0**，`guard --strict` EXIT=0 ✅ `raw/01/03/09`。
- ④app-mobile test **5/56 全过**、`type-check` **0=0**、backend 全量 **192 文件 3916 passed** ✅ `raw/06/07/08/10`；backend/ 面=**单一台账 JSON**（与「零改动」字面矛盾系判据③机械必然，披露卡 §五①，`raw/12` 自证 backend/src 零改动）。

## 越面未动项（提请后续单）

`permission-gates.ts:596` basis 的 confirm-receipt 行号仍写旧值 :64（现 :67）；陈旧>0 无常驻 CI 红线（本单靠一次性差集机读）。详见卡 §七。
