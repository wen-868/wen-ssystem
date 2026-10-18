# QODER-7 · 收口：漂移修复（16 条）+ employees 下线 + 零消费件整链删除 + 漂移机进 CI

> 派单人：凌舟｜端：**移动端 → Qoder**｜依据：QODER-6 定性（16 D1 / 0 D2 / 1 D4）+ QODER-5 待裁③
> ⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-7`｜分支 `fix/qoder-7-drift-and-orphans`｜基线：`origin/main`（栈于 QODER-6 尖端）

## 一、四件事（凌舟已裁定，照做）

### ① 16 条漂移按**注册表层**修（注册表是唯一真相源）
- 15 条：`app-mobile/src/config/permission-gates.ts:644-658` 的 endpoint **多写了 `/platform` 段** ⇒ 删段（后端 `instant-retail-admin-platform.routes.ts:16-49` 无该段）；
- 1 条：`:641` 方法 `POST` ⇒ **`PUT`**（后端 `instant-retail-admin-ops.routes.ts:61`）；
- 修完 `check-contract-drift.mjs` 的 `D1` 必须 = **0**，且 `contractDrift.debt` 基线同步降到 **0**。

### ② `employees` 5 个零引用 wrapper ⇒ **下线**
- 删 `admin-web/src/api/system.ts:41-61` 那 5 个 wrapper（零调用方，已实证）；
- 保留一条注释："如需员工能力请用 `GET/POST /api/admin/staff`、`PUT /api/admin/staff/:id`（D3 映射）"。

### ③ 零消费能力件**整链删除**（QODER-5 待裁③）
- 删 `app-mobile/src/utils/local-db.ts`、`app-mobile/src/api/sync.ts` 与 `sqlite` 相关依赖（`package.json` 同步移除）；
- 判据：`rg "local-db|api/sync|sqlite" app-mobile` **0 命中**；`npm install` 后 `build:h5` EXIT=0。

### ④ 漂移机**进 CI**（阻断）
- `ci.yml` 增步骤 `node app-mobile/scripts/check-contract-drift.mjs`；
- 判据：`debt` 与基线一致才放行；**故意把某条改回 `/platform` 段 ⇒ 必红并点名**；复原 ⇒ 绿（SHA256 一致）。

## 二、判据（逐条给原始输出）

1. `check-contract-drift.mjs`：**D1=0 / D2=0 / D4=1**（employees 已下线，D4 可转为"已删除"说明），`debt=0`；
2. 反测：把 1 条 endpoint 改回 `/platform` ⇒ 脚本 **EXIT=1 并点名**；复原 ⇒ EXIT=0、SHA256 一致；
3. `npm --workspace app-mobile run test` 全过且不劣化；`type-check` **0=0**；`build:h5` EXIT=0；
4. `rg` 三组零命中（`/platform` 误写、employees wrapper、local-db/sqlite）；
5. `backend/` 零改动（`merge-base..HEAD`）。

## 三、红线

只改 `app-mobile/**`、`admin-web/src/api/system.ts`、`ci.yml` + 证据/回传卡；**不得改后端**；不得新造码；零字节证据配 `<同名>.note.txt`。

## 四、回传

`docs/tasks/cards/R101-QODER-7-回传.md`（十项）+ 回执；必须含"16 条 × 修法 × 复跑读数"总表与三组 `rg` 零命中原样。
