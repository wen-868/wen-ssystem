# ACTIVE-S3-234 · 迁移流水线收口（第 73 + 74 项）

> 派单人：**凌舟（总负责人）**｜派发：**2026-10-16**｜执行方：**阿坚（后端 / 部署）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-234`｜分支 `chore/s3-234-migration-pipeline`
> 卡名（认领用）：`/root/s3239_ajian`｜基线：开工当日 `origin/main`
> 背景证据：`docs/tasks/cards/R101-S3-232-凌舟验收与裁定.md` §二（第 72/73 项）+ 收口总清单第 74 项

---

## 一、问题（两条都是"改了不生效"级）

### 第 74 项：**部署流水线的迁移步骤是硬编码 3 条** ⇒ 新迁移永不随部署执行

`deploy/auto-deploy.sh:29-35` 只跑三行（`126_bills.sql` / `127_order_routing_exception.sql` / `196_平台管理员MFA.sql`）。

**实证（2026-10-16，我亲验）**：main 合入 `204_系统设置域权限点立码.sql` 后部署，日志里**只跑了这 3 个文件**；生产只读复核：店长权限串仍 **9 项**、14 个新菜单码 **0 行** ⇒ **204 没随部署落地**（随后我走官方通道手工补跑，复核为 **11 项 + 42 行**）。同批抽查 197/201/202/203 痕迹**均在库** ⇒ 历史迁移是**人工补跑**的。

### 第 73 项：`069_商品SPU增加品牌ID.sql` **非空库重跑必红**（`Duplicate foreign key constraint name`）⇒ 若改成"全量跑"它会立刻炸。

## 二、三件事（**逐项独立提交 + 独立证据**）

### R1 · 修 `069` 幂等（第 73 项）
- 按既有惯例（S3-199 修 `169`、S3-186 改 `CALL`）：**先 `information_schema`/`REFERENTIAL_CONSTRAINTS` 判定再建**；
- 判据：本机真库（可用既有夹具）**连跑两遍** ⇒ 零错误码、第二遍"已存在，跳过"；给原始输出；**不得**改业务语义（只加守卫）。

### R2 · 部署迁移段改"**清单驱动 + 自动应用待跑项**"（第 74 项）
- 新建 **`deploy/migrations-manifest.txt`**（唯一真相源）：逐行 `编号_文件名.sql`，豁免项用 `# 理由` 注释；
- `deploy/auto-deploy.sh` 迁移段改为**循环遍历 manifest**，逐个 `node ../scripts/run-migration.mjs <file>`；
- 行为：① 已应用的重复跑必须零副作用（给证据）；② 任一文件失败 ⇒ **日志必须清晰点名**（是否升为阻断部署由凌舟裁定，本单先做到可定位）；
- **把 202/203/204 等已人工补跑的迁移补进 manifest**。

### R3 · **CI 守卫**：新增迁移必须"在 manifest 里 或 具名豁免"
- 新增零依赖守卫 `backend/scripts/guard-migration-manifest.mjs`（形态参考既有 `guard-*.mjs`）：扫 `docs/migrations/[0-9]+_*.sql`，断言每个文件**在 manifest 或豁免段（含理由）**；反向：manifest 列出但文件不存在 ⇒ 红；支持 `--json` / `--root`；
- **反测**：① 新迁移不入 manifest ⇒ **EXIT=1 并点名**；② 从 manifest 删一行 ⇒ **EXIT=1**；③ 复原 ⇒ **EXIT=0**；
- **本单只写脚本 + 本地红绿证据**，**CI 接线由凌舟做**（`.github/**` 红线）。

## 三、判据
1. R1 真库两遍 + 错误码清零；R2 manifest 遍历两遍 + 日志原文；R3 守卫红绿两侧 + `--json`；
2. 全量 `npx vitest run` 0 failed、`npx tsc --noEmit` 0；
3. `git diff --name-only origin/main HEAD` 逐条说明都在本单范围（允许 `deploy/**`、新增守卫、manifest + `069` 一个迁移文件；**不得**改业务路由/中间件/服务）。

## 四、红线
1. 不得改 `.github/**`（凌舟接线）、不得改**除 `069` 外**的任何迁移文件；
2. **不得对生产做任何写操作**（只在本地/夹具库验证）；
3. 不得碰其它单工作树（`wt-agents/S3-231`、`S3-233`）；
4. **不得 push、不得开 PR、不得 `git add -A`**；
5. 证据不得含口令/密钥明文；回传卡不得出现「凌舟裁定 / 凌舟验收」字样。

## 五、交付与回传
- 代码/配置：`069` 守卫化、`deploy/migrations-manifest.txt`、`deploy/auto-deploy.sh` 迁移段、守卫脚本；
- 证据：`docs/evidence/S3-234/**`；回传：`docs/tasks/cards/R101-S3-234-阿坚-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-234.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据 ｜ 验收自评 ｜ 未完成与阻塞 ｜ 风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡
