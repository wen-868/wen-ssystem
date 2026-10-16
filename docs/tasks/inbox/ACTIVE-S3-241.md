# ACTIVE-S3-241 · 调拨码族校正（`store:transfer` → `transfer:*`）

> 派单人：凌舟｜端：**总台（后端与数据）**｜执行/回传：**阿坚**（角色卡 `docs/团队角色卡/阿坚-角色卡.md`）
> ⚠️ 你不是凌舟；不得写「凌舟裁定/验收结论」；只动自己的分支；**不得 push、不得开 PR、不得 `git add -A`**。
> 依据：`docs/tasks/cards/R101-S3-233-凌舟验收与裁定.md` §二.2（裁定 2）

## 一、问题

S3-233 把 8 条**调拨**写端点接在 `store:transfer` 上；而生产**仓管员**角色 `WAREHOUSE_STAFF` 持的是 **`transfer:*`** 族（见 `docs/evidence/_shared/prod-roles-20261016.txt`）
⇒ 语义错位：`store:transfer` 的语义是"门店数据导入/转移"（S3-198 已用于 `data-transfer/import/products`），
**调拨业务应归 `transfer:*` 族**。当前生产 `WAREHOUSE_STAFF` **0 账号** ⇒ 现役零回归，但**启用仓管员前必须校正**。

## 二、交付

1. 8 条调拨端点由 `store:transfer` 改挂 **`transfer:*`** 族中语义匹配的既有码（逐条给"码 ↔ 端点语义"对照；**如某条无现成码** ⇒ 只登记 + 请凌舟裁，不准自造码）；
2. 同步：`rbac-wiring-baseline.json`（码回填）、`docs/tasks/R101-RBAC接线缺口清单.md`（顺延新章节）、相关用例；
3. **零回归论证**：给出"改前持有者集合 vs 改后持有者集合"（用共用底稿），并说明**在用角色**（0 账号角色不算）是否受影响。

## 三、判据（逐条给原始输出）

1. 对照表 8 条逐条（端点 / 旧码 / 新码 / 依据）；
2. **反测**：把某一条改回 `store:transfer` ⇒ 你的用例**必红并点名**；复原 ⇒ 绿（SHA256 一致）；
3. `guard-rbac-wiring --strict` ⇒ **EXIT=0**；全量 `npx vitest run src/__tests__/routes/rbac` ⇒ 0 failed；
4. `npx tsc -p tsconfig.json --noEmit` ⇒ 0。

## 四、红线

不得新增权限码、不得改角色种子与迁移、不得改 `.github/**`/`deploy/**`；**不得动 `docs/migrations/**`**（本批零迁移，避免与在办 S3-236 的 207 撞号）；
证据不得含口令明文；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-S3-241-阿坚回传.md`（十项）+ 回执；分支 `fix/s3-241-transfer-code-family`。
