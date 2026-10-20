# ACTIVE-回执-QODER-7 · S3-242 收口（漂移修复 + employees 下线 + 离线链整删 + 漂移机进 CI）

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-19
> 任务书：`docs/tasks/inbox/QODER-7-漂移修复与零消费件下线.md`｜回传卡：`docs/tasks/cards/R101-QODER-7-回传.md`（十项齐）
> 分支 `fix/qoder-7-drift-and-orphans`｜基线：**栈于卡 6 尖端 `033a74a6`**（按任务书写明口径，合并顺序卡1→2→4→5→6→7）
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 四件事（全部按已裁口径执行）

- ① **16 条漂移按注册表层修**：15 条去 `/platform` 段、:641 POST→PUT（以后端为准）⇒ 漂移机复跑 **OK 27 / D1 0 / D2 0 / debt 0**，`contractDrift.debt` 基线 16→0（只准降留痕）。
- ② **employees 5 wrapper 下线**（admin-web/src/api/system.ts），墓碑注释按任务书保留 staff 指引且不含任何 employees token；`resetEmployeePassword`（真调用）未动。
- ③ **离线链整删**：`api/local-db.ts` + `api/sync.ts` + `native/sqlite.ts` −2384 行；链外零 import；package.json **本无 sqlite 依赖**（口径偏差⑤.2）。
- ④ **漂移机进 CI**：ci.yml 新增阻断步 `node app-mobile/scripts/check-contract-drift.mjs`（YAML parse 通过，零 `continue-on-error`）。

## 验收三查（凌舟口头径）

- **D1=0 且 debt=0** ✅（`drift-after-fix.log/.json`）
- **三组 rg 零命中（MSYS 排除态）** ✅（`rg1/rg2/rg3*.log` + note；判据③原式命中仅剩审计文档 2 行历史叙述，未改写档案，口径已报备回传卡 §五③）
- **backend 0 行** ✅（merge-base `3fa138e7`..HEAD，0 文件）

## 反测与其余判据

注入 `/platform` ⇒ CI 同款命令 EXIT=1 点名 ⇒ 复原 sha256 `8740f174…` **字节一致**（首轮 SHA 差为一次性 CRLF→LF 正常化，非语义差，两轮原始输出与根因报备在回传卡 §四）；test 5/53 全过、type-check 0=0、contract/lint 绿、guard:logout GREEN、build:h5 读数见回传卡 §二.3。
