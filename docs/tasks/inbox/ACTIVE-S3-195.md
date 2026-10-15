# 【派单 S3-195】`/api/store` 根前缀统一治理 ＋ 跨租户真库夹具 ＋ 根前缀共享告警

- 派单人：**凌舟｜2026-10-14**｜执行方：**阿坚（后端）**
- 工作区：从 origin/main 起**新工作树** `wt-agents/S3-195`，分支 fix/s3-195-store-prefix-governance
- 依据：收口总清单第 **51** 项
> ⚠️ 你不是凌舟；不得写裁定/验收；只动自己的工作树与分支；**不得 push、不得开 PR**。完成后写 `docs/tasks/inbox/ACTIVE-回执-S3-195.md`，卡移入 archive。
> ⚠️ 一卡一会话一工作树；证据日志记 `src`+`dist` 哈希。

## 一、现状（凌舟已实测）

1. **S3-187 只收窄了 1 个文件**（`commerce-fix.routes.ts`：`/api/store` → `/api/store/coupons`）。**其余 9 个以根前缀 `/api/store` 注册的文件仍把整段 `/api/store/**` 前置套上认证+CSRF** ⇒ `POST /api/store/no-such-path` 返回 **401**（而不是 404，路由根本不存在却报未登录）。
2. S3-187 的裁定 ②：A 的跨租户字面反例只验到**等价分支**，凌舟要求补**真库夹具**。

## 二、交付物

1. **逐个收窄**：把 9 个文件从根前缀收窄为「自己拥有的路径段」（逐个给：文件 → 原前缀 → 新前缀 → 该文件实际拥有的路径清单）。
2. **对照取证**：每个文件收窄**前后**各跑一次，给出「被前缀压死的端点」行为对照（至少覆盖：不存在的子路径、以及**别的文件拥有的**端点）。
3. **根前缀共享告警**：在 `shared/auto-routes.ts`（判据已抽到 `shared/route-prefix-rules.js`）增加「**根前缀被多文件共享**」的**告警**（只出声、不判红），避免下次再靠人记。
4. **跨租户真库夹具**：用本机私有 MariaDB（3406）造两个租户 A/B + 各一条 `t_coupon_template`，拿 **A 的凭证**打 **B 的 templateId** ⇒ 期望 **404**（且 B 的券不被领走）；给原始 SQL 与响应。同样覆盖 `flash-sale`/`group-buy` 两条写端点。
5. **门禁**：三条 guard + `guard-rbac-wiring --strict` 现状不变（EXIT 值与收窄前一致，逐条说明变化）。

## 三、验收判据（原始输出）

1. `POST /api/store/no-such-path` ⇒ **404**（收窄前 401）；且 `/api/store/**` 下**真实端点**行为不变（逐条对照表）。
2. 9 个文件的收窄逐一有前后对照，**没有一个端点因此变成 401/404**（区分：**路由 404（HTML Cannot POST）** vs **业务 404（JSON）**）。
3. 跨租户夹具：A 打 B ⇒ 404 + B 的券未被领（数据库复核）。
4. 门禁：`npx vitest run` **0 failed**、`npx tsc --noEmit` **0**、三条 guard **EXIT=0**、`npm --workspace backend run build` **EXIT=0**。

## 四、反测（缺一不可）

- 把某文件改回根前缀 ⇒ `POST /api/store/no-such-path` **回到 401**（红）；复原 ⇒ 404（绿）。
- 跨租户夹具：把服务层的 `AND tenant_id = ?` 摘掉 ⇒ 该用例**变红**（能领到 B 的券）；复原 ⇒ 绿。

## 五、红线

只改路由前缀与判据/台账；**不得改业务逻辑、不得放宽鉴权或 CSRF**；不得改 `.github/**`、`deploy/**`、`R101-收口总清单.md`；生产库零写操作；删工作树前先 `cmd /c rmdir node_modules`（不带 /s）。
