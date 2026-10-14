# ACTIVE 回执 · S3-203 —— 账号口径三端统一（第 27 项）

- **汇报对象**：凌舟（总负责人）
- **汇报人**：阿坚（后端/前端执行方 · `/root/s3206_ajian`）
- **日期**：2026-10-15
- **对应派单编号**：S3-203（派单卡 `docs/tasks/inbox/ACTIVE-S3-203.md` + 处置卡
  `docs/tasks/cards/R101-S3-203-账号口径统一处置-凌舟.md`）
- **工作树 / 分支**：`D:\Users\ZXQL\wt-agents\S3-203`｜`feat/s3-203-account-unification`
- **基线**：`origin/main = 30bb8994`（取树时）
- **交付 ref**：分支 `feat/s3-203-account-unification` 的 **tip**（本轮共 3 笔本地提交：
  `6e124904` 代码/口径 → `ca8f5bc7` 证据包与回执 → 回执措辞收尾；**以 `git log -1 --format=%h` 为准**，
  避免"回执里写死哈希、再提交一次就过期"的自指问题）
- **未 push、未开 PR**（卡面红线）
- ⚠️ **明文口令一律不在本文件、不在仓内任何文件**；新口令只在**最终交付回复**里给凌舟，由凌舟转业主。

---

## 一、改了什么（逐项对卡）

**总览**：相对基线 `30bb8994`，本分支 **+54 文件（+1295 −246）**：核心代码 6 文件、新增门禁用例 3 文件、
新增唯一出处 1 文件、新迁移 1 件、其余为口径字面量收敛（前端/脚本/e2e/文档/测试夹具）与证据包。

| 卡面条目 | 处置 | 落点（可核对） |
|:--|:--|:--|
| **§七.1 幂等迁移** | ✅ 新增 `docs/migrations/200_账号口径统一.sql`（编号 200，先 `rg` 确认原最大号 = 199） | 平台 `t_platform_admin.admin` 与租户 `t_sys_user.admin`（default）口令统一；门店两账号轮换为**不公开强口令**；`demo` **停用**（`status=0`）+ 口令随机。**只写 bcrypt 哈希，零明文** |
| **§七.2 锁定策略（前半）** | ✅ `admin`（唯一对外账号/演示入口）**永不锁死** | 豁免口径仍从 `constants.DEMO_USERNAME` 派生（`DEMO_USERNAME` 由 `demo` → `admin`），并**补上此前缺失的一条**：移动端 `services/store/auth.service.ts` 的登录同样豁免（原先只有工作台侧豁免） |
| **§七.2 锁定策略（后半）** | ⚠️ **未按卡面实施**，见 §六.1（需求与业主既有"登录不限流"口径直接冲突） | 现状：`store_manager` 仍为库级 5 次/15 分钟锁定；迁移 200 已把爆破留下的 `login_fail_count=21` 与 `locked_until` 清零，账号恢复可用 |
| **§七.3 三端收敛** | ✅ 有效面字面量 **0 命中** | `admin-web/src/api/common.ts`、`app-mobile/src/api/modules/auth.ts`、两个 `.env.example`、`e2e/*.spec.ts`、`scripts/*.mjs`、`tests/api-test-suite.mjs`、`tests/docs/*`、`README.md`、mock 夹具；历史留痕未改写（见 §六.2） |
| **§七.4 同一身份域权限口径一致** | ✅ 新增唯一出处 `backend/src/shared/user-permissions.ts` | 工作台与移动端都读 `t_sys_role.permissions`；移动端**删掉那份硬编码权限数组**（`dashboard.view`…），登录响应补 `permissions`；移动端角色查询补 `r.tenant_id = ur.tenant_id`（与工作台同判据） |
| **§七.5 双向越权门禁** | ✅ 已建机械门禁 | 新用例 `s3-203-cross-domain-isolation.test.ts`：租户 JWT（含**伪造 `type=platform_admin` 的租户 JWT**）打总台 ⇒ 401；平台 JWT 打工作台 ⇒ 401；平台签发但 `type≠platform_admin` ⇒ 403；对照组各自 200 |
| **§七.6 验收取证** | ✅ 见 §二（含两遍迁移的逐条 `affectedRows`、口令语义、副本库构成如实标注） | `docs/evidence/S3-203/` |
| **§七.7 门禁** | ✅ 全绿 | 见 §二.3 |
| **§四 红线** | ✅ 守住 | 明文字面量不进仓（新迁移零明文、证据脚本只收环境变量）；未改 `.github/**`、`deploy/**`、`R101-收口总清单.md`；生产库零写操作 |

### 1.1 关键口径变更（会改变现网行为，请凌舟确认无误再合并）

1. **唯一对外账号 = `admin`（租户 default 真实超管），`demo` 账号停用** —— 这是**业主明确口径**，
   同时意味着 **S3-174-F1 的"演示账号隔离到 demo 租户"被主动作废**（业主："演示 = 真实数据"）。
   随之删除了 `demoLogin()` 里的**归属自愈**（旧逻辑会 `UPDATE t_sys_user SET tenant_id='demo'`——
   在账号就是真实超管之后，这条会把真实超管搬进 demo 租户，属破坏性写操作）。
2. **`demoLogin()` 不再自动建号**：`DEMO_USERNAME` 变成真实超管后，"账号不存在就建一个"相当于
   **免密路径凭空造超管账号** ⇒ 改为 fail-closed 报错（`账号未初始化`）。对应用例已改为断言"拒绝且不发 INSERT"。
3. **门店两账号口令 = 不公开强口令**：`store_manager` / `store_operator` 的**旧公开口令即日起失效**
   （卡面 §四.3 要求）。因此以下脚本若要用这两个账号登录**真库**，需注入新口令（脚本内已无公开默认值）：
   `backend/scripts/s3-160-remember-me.mjs`（可用 `S3_160_PASSWORD` 覆盖）、`scripts/load-test.mjs` 等；
   打 **mock 库**的脚本（`s3-145/146/147`、`app-mobile/scripts/s3-148`、`qa-regression-test`）不受影响。
4. **`backend/src/shared/seed-data.ts` 建号策略**：新建库时门店两账号改为**随机强口令**（不再取统一公开口令），
   与迁移 200 的轮换口径保持一致；否则新库一建出来就与生产口径矛盾。

---

## 二、证据（可复跑；全部原始输出在 `docs/evidence/S3-203/outputs/`）

### 2.1 迁移 200：本机 MySQL 8 副本库**两遍**（生产零写操作）

```
第一遍写语句 affectedRows = [1,1,2,1]   ← 租户 admin / 平台 admin / 门店两账号 / demo
第二遍写语句 affectedRows = [0,0,0,0]   ← 幂等：零变更，行快照逐字节相同
```

16 项断言全 `true`（含：新口令匹配、旧公开口令被拒、`demo` 已停用、`store_manager` 爆破计数清零、
两遍状态一致）。复跑：`node docs/evidence/S3-203/verify-migration-200.mjs`（需注入 3 个口令环境变量）。
原始输出：`outputs/10-migration-200-console.txt`、`outputs/11-migration-200-result.json`。

副本构成如实标注（**勿当"全量真库"读**）：只含本迁移触及的 2 张表，DDL 逐字取自
`backend/src/shared/migration.ts`（`t_sys_user`）与 `docs/migrations/080_平台管理员.sql`（`t_platform_admin`）；
迁移前行用仓内历史迁移（075/127）的真实哈希灌入。

### 2.2 迁移文件的"可执行 + 零明文"门禁（防踩坑[63] 复发）

新用例 `backend/src/__tests__/shared/s3-203-migration-200.test.ts` 用 runner **自身的**
`splitSqlStatements()` 断言：200 号迁移被切成 **5 条**语句、**无一条以注释开头**、4 条 UPDATE 带幂等守卫、
末尾带验证 SQL、文件内**零明文口令**（所有 `password_hash =` 均为 `v2$` 哈希）。

### 2.3 门禁（全量，原始输出在 `outputs/32~34`）

| 门禁 | 读数 | EXIT |
|:--|:--|:--|
| `cd backend && npx vitest run` | **663 文件 / 7972 用例 / 0 failed** | 0 |
| `npx tsc -p tsconfig.json --noEmit` | 空输出 | 0 |
| `guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` | 无违规 | 0 / 0 / 0 |
| `guard-rbac-wiring --strict` | 无新增缺口 | 0 |
| `npm --workspace backend run build` | 801 个 JS，修复 1893 处导入（含动态 import 19 处） | 0 |

> 迁移编号快照门禁（`migration-c6-4-1.test.ts` 的 `EXPECTED_MAX_MIGRATION`）已按约定**显式同步** 199 → 200，
> 并在其头注释登记 200 号归属（不是把断言删掉/放宽）。

---

## 三、反测（门禁铁律：新增/变更门禁必须证明"它会红"）

| 门禁 | 造错方式 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| 双重越权门禁 | 摘掉 `requirePlatformAuth` 的 `issuer`/`audience` 校验 | **红 2/6**：伪造 `type=platform_admin` 的租户 JWT 拿到 **200**、租户 JWT 由 401 变 403 | `outputs/20-reverse-red-isolation.txt` |
| 跨端权限一致门禁 | 把历史硬编码权限数组塞回移动端 `getCurrentUser()` | **红 3/3**（含静态扫描断言） | `outputs/21-reverse-red-parity.txt` |
| 复原 | `git checkout --` 两处临时改动 | **绿 9/9**，工作树回到 HEAD 内容 | `outputs/22-reverse-restored-green.txt` |

---

## 四、未完成与阻塞

1. **卡面 §七.2 后半（门店账号"IP 维度为主 + 账号锁定为辅"）未实施**：与业主既有口径冲突，需裁定（见 §六.1）。
2. **`docs/tasks/current-tasks.md` 与 `docs/数据库变更清单.md` 未动**：按分工属凌舟记账（S3-201/202 同口径），
   新迁移 200 需要登记进变更清单。
3. **`docs/tasks/inbox/ACTIVE.md` 路由表未动**（多人共享文件）；本卡 `ACTIVE-S3-203.md` 已按协议归档，
   见 §七。
4. **生产侧未执行**：迁移 200 只在本机副本库验证过；生产口令轮换需凌舟经部署通道发起
   （命令：`MIGRATION_WRITE_GATE=allow node scripts/run-migration.mjs docs/migrations/200_账号口径统一.sql`）。
5. **e2e/前端 build 未跑**：本工作树只装了 `backend` 侧依赖（与其它工作树一致），
   `e2e/*.spec.ts`、`admin-web`/`app-mobile` 的构建门禁未在本单内跑过；相关字面量改动已用 `rg` 静态核对。

---

## 五、风险与自我报备

1. **这是"降低演示隔离"的改动**（S3-174-F1 被作废）：唯一对外口令从此对应**真实租户超管**。
   业主已明示"演示 = 真实数据"，但**公开口令 = 真实超管口令**意味着任何拿到该口令的人都能读真实经营数据。
   ⇒ 若业主后续想收回，恢复路径是"新建独立 demo 账号 + 把 `DEMO_USERNAME` 指回去"（口径改造，非本单范围）。
2. **`store_manager` 的旧公开口令即刻失效**，依赖该账号的运维脚本若不注入新口令会登录失败
   （已在 §一.3 列出受影响的脚本）。
3. **`seed-data.ts` 改为随机口令**后，新建库不再能"用公开口令登录门店账号"，会改变本地/联调习惯；
   若凌舟认为联调便利优先，可回退这一处（仅一行改动）。
4. **副本库 ≠ 全量真库**：迁移实证只覆盖 2 张表；未覆盖生产上"同名账号出现在其它租户"的边角情形
   ——迁移每条写语句都带 `tenant_id` 限定，正是为规避这一点。

---

## 六、需凌舟裁定

1. **门店账号锁定策略（卡面 §七.2 后半）与业主既有口径冲突**：
   卡面要求"IP 维度为主"。但租户登录路由 `/api/admin/auth/login`、`/api/store/auth/login`
   **没有任何限流器**，且 `backend/src/server.ts:237` 明确写着
   「登录接口（无需认证；**应用户要求不限流**——演示登录/多设备共享IP场景不再触发429）」
   （平台侧 `/api/platform/auth/login` 才挂了 `loginFailLimiters`）。
   ⇒ 若给租户登录加 IP 限流 = 推翻业主的既有要求；若不加，就无法实现"IP 维度为主"。
   我在本单**没有**擅自加限流，也**没有**放宽库级锁定（只做了 admin 豁免 + 迁移清零）。
   可选方案（请择一或另定）：(a) 仅对 `store_manager`/`store_operator` 这两个**内部账号**加 IP 维度失败计数
   （成功登录不计数，不影响业主担心的"演示/多设备"场景）；(b) 服务层按来源 IP 记失败桶、多来源才落库锁定；
   (c) 维持现状（库级 5 次/15 分钟），本项记为不实施并登记技术债。
2. **"全仓旧口令字面量 0 命中"未按字面执行**：有效面已 0 命中；`docs/**` 历史留痕仍有 **35 个文件**保留原字面量
   （含任务卡/回执/台账/证据包/记忆）。理由是不得篡改历史记录与证据，且本项目已有先例
   （S3-202 第 24/25 项对同类命中就是"加指路注释、不动原字面量"，已合入 main `425fa590`）。
   清单见 `docs/evidence/S3-203/outputs/40-demo-password-residue-list.txt`。**若你要求全量改写，请回一句确认**
   （我会按"就地标注作废、不删原文"的方式逐文件处理，但仍会改变历史文书的原始文本）。
3. **`e2e` 是否必须本单内跑**：本工作树没有前端依赖，未跑 Playwright；如卡面要求必须跑，请给前端依赖安装授权。

---

## 七、口径/前提订正与交付清单

1. **卡面 §四.2「全仓 0 命中」**：已按"有效面 0 命中 + 历史留痕不改写"执行（理由见 §六.2）。
2. **卡面 §二"演示账号 demo 停用"**：已执行；但注意 `demoLogin()` 的语义已从"进 demo 租户"变为"进 default 租户"。
3. **卡面 §三"新口令只在回复里告知业主"**：遵守 —— 明文口令只在最终回复；仓内只有哈希。
4. **派单卡归档**：`docs/tasks/inbox/ACTIVE-S3-203.md` → `docs/tasks/inbox/archive/ACTIVE-S3-203-20261015.md`
   （主检出内，按 S3-202 先例；共享的 `inbox/ACTIVE.md` 路由表未动）。
5. **本回执与回传卡**：同内容落 `docs/tasks/cards/R101-S3-203-阿坚-回传.md`，并在主检出 inbox/cards 各留一份副本。
