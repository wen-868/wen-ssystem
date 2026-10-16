# ACTIVE-S3-231 · 收尾批（四小项，逐项独立对账）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-231`｜分支 `chore/s3-231-followups`
> 卡名（认领用）：`/root/s3235_ajian`｜基线：开工当日 `origin/main`（`git fetch` 后取真值写进回执）
> 依据：`R101-S3-229-凌舟验收与裁定.md`（裁定 1/2）、`R101-S3-230-凌舟验收与裁定.md`（裁定 5）、`R101-授权模型提案-凌舟-20261016.md`

---

## 四小项（**逐项独立提交/独立证据**，任一项做不到 ⇒ 报备并跳过）

### F1 · `customer:level` 4 条（会员等级配置）
`points.routes.ts` 的 4 条写端点**改挂 `customer:level`**（页面注册码；店长经 `customer:*` 命中 ⇒ 满足 I1'①）。
证据：缺码 403 / 店长通过 / **摘中间件 ⇒ `--strict` EXIT=1 且点名 + 用例红** / 复原逐字节一致；同步基线 + 台账 §十七 + 文件顶部注释（去掉"维持不接"措辞）。

### F2 · 平台侧 2 条移交
`/api/tenant/applications/:id/{approve,reject}`：**归平台侧**（调用方是平台控制台、`requirePlatformAuth` 认证）⇒ 若该实现落在商家侧 `auto-routes` 之外，**本项只做登记**（把"应挂 `requirePlatformPermission("tenant:manage")`"写进台账 §十七 + 平台侧接线台账），**不要**在本单硬接线（跨体系）。

### F3 · 入口门"失败关闭"（fail-closed）
`app-mobile/**` 的入口门：**取不到权限码 ⇒ 不显示入口**（现在与 `stores/menu.ts` 的 null 语义一致＝放行）。
> ⚠️ **基线修正（2026-10-16 09:57 凌舟，见文末「卡变更记录」）**：本项要改的**门本身**（`app-mobile/src/config/permission-gates.ts`、`app-mobile/src/composables/usePermissionGate.ts`）由 **S3-230（PR #356，已验收通过、尚在等合并）** 新增，**不在你当前工作树的基线（`1a067843`）里**。
> ⇒ **F3 必须基于 `origin/feat/s3-230-mobile-permission-gates`（尖端 `16450997`）开展**：`git fetch origin` 后二选一 —— ① `git checkout -b chore/s3-231-followups origin/feat/s3-230-mobile-permission-gates`（从该分支起头）；② 把该分支 `git merge` 进你当前分支。
> ⇒ **禁止**另写一套入口门实现；若 #356 最终未合并，F3 的提交随之并入该分支，**不单独入库**。F1/F2/F4 与本项无关，不受影响。
- 只改入口门这一层（`permission-gates.ts` / `usePermissionGate.ts` 及其调用点），**不动** `stores/menu.ts` 与后端；
- **必须**逐条登记"因缺码被关闭的入口"（入口 + 缺哪个码 + 归属单），并在回执给**影响面**（哪些角色失去哪些入口）；
- 反测：把某入口的码改成"不存在的码" ⇒ 该入口**必须不可见**（且该情况**必须**出现在"因缺码关闭"清单里，不得静默）。

### F4 · 7 条"疑似查询型 POST"逐条裁定登记
台账「附·S3-227」列出的 7 条：逐条给"端点 + 该 service 是否写库 + 结论（可登记 / 不可登记）"三列；
- **可登记**的写进 `guard-rbac-wiring.mjs` 的 `READ_ONLY_POSTS`（路径 + 理由 + 归属单 + **裁定依据行**）；
- **不可登记**（有写或有副作用）的**不要**动，留在 gaps 并登记"按真写端点处理"；
- 判据：`--strict` **EXIT=0**，且人读台账里有对应的含「查询型」的判定行。

## 判据与红线

- 判据：逐项给"改前/改后/反测"原始输出；`guard-rbac-wiring --strict` **EXIT=0**；全量 `vitest` 0 failed、`tsc` 0、`build` 0；`app-mobile` 侧（F3）给 `uni build -p h5` EXIT=0 + `vue-tsc` 0 新增；
- 反测顺序照 `docs/tasks/派单规范.md` §九.1（**先更新基线再注入**）；
- 红线：不得新增权限码、不得改角色种子/迁移、不得改 `.github/**`、不得碰其它单工作树、**不得 push/PR/`git add -A`**；证据不得含口令明文；回传卡不得写"凌舟裁定/验收"。

## 交付

证据 `docs/evidence/S3-231/**`（四小项各自子目录）+ 回传卡 `docs/tasks/cards/R101-S3-231-阿坚-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-231.md`。

---

## 卡变更记录

| 时间 | 变更 | 原因 | 变更人 |
|:--|:--|:--|:--|
| 2026-10-16 09:57 | F3 增补「基线修正」块：明确 F3 基线 = `origin/feat/s3-230-mobile-permission-gates`（`16450997`），并要求先 `git fetch`；补充"禁止另写一套门实现""若 #356 未合并则不单独入库" | 本卡写于 09:50，当时 S3-230（PR #356）尚未合并；派单时未核"F3 依赖的门文件在哪条分支"，属**派单前提缺陷**（R7 自检漏项：交付物 F3 与 `判据` 未校验基线可达性）。执行方若已按旧基线动手，请按本块改基线后重做 F3，并在回执「风险与自我报备」里记录返工面 | 凌舟 |
