# 回执 · S3-183-F1（收口总清单第 48/49 项）

> 汇报对象：凌舟（总负责人）｜汇报人：**阿坚（后端·本地子代理通道执行）**｜日期：**2026-10-13**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-183F1.md`（已归档为 `archive/ACTIVE-S3-183F1-20261013.md`）
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-183-F1-阿坚-回传.md`
> **本地提交（未 push、未开 PR）：`7a76afb9`**，分支 `fix/s3-183-f1-type-safe-and-tenant-id`（基线 `origin/main` = `8f5600f0`）

## 一、一句话结论

第 **49** 项修好：198 的两处**跨类型比较**已按列真实类型改写，**生产同构库**上整份跑通、连跑两遍第二遍**真 0 变更**
（行数 + 内容 MD5 双比对一致）。第 **48** 项修好：两个建租户落点从**400 → 200 且落库**——除卡里指出的 `id` 之外，
实测还有**第二个** NOT NULL 无默认列 `name`（只补 id 不够）。

## 二、改了什么（5 个文件，改动面 = 卡 §三.5 允许范围）

| 文件 | 改动 |
|:--|:--|
| `docs/migrations/198_租户角色菜单补全.sql` | ⑤ 两行判据改同类型比较：`(r.status='ACTIVE' OR r.status=1 OR r.status='1')` ⇒ `r.status IN ('ACTIVE','1')`；`(u.status=1 OR u.status='ACTIVE' OR u.status='1')` ⇒ `u.status = 1`。①②③④、⑤ 的兜底口径、任何列类型**都没动** |
| `backend/src/services/saas/tenant.service.ts` | `createTenant`：INSERT 补 `id`（`randomUUID()`）、`name`、`tenant_name`、`contact_name`；`status` 由字面量 `'ACTIVE'` 改数字 `1`；返回体按生成主键取真行；`getTenantDetail` 签名加宽到 `number \| string` |
| `backend/src/services/admin/tenant.service.ts` | `createTenant`：同样补四列；`t_operation_log.tenant_id` 由 `insertId` 改真 UUID（varchar 主键的 `insertId` 恒 0，会把日志写成 `'0'`）；返回体增 `id` |
| `backend/src/__tests__/services/saas/tenant.service.test.ts` | 新增 1 例护栏（列清单必须 `id, tenant_code, name` 开头 / 主键 UUID / SQL 内不得出现 `'ACTIVE'` / 按 UUID 取行） |
| `backend/src/__tests__/services/admin/tenant.service.test.ts`（新增） | 1 例护栏（同上 + 操作日志 `tenant_id` 必须是同一 UUID） |

证据目录：`D:\Users\ZXQL\wt-agents\_s3f1f-evidence\`（00–34 号日志 + 夹具/探针 SQL + HTTP 装置脚本）。

## 三、证据（摘，全部可复跑）

**49 · 生产同构库两侧**

```
夹具类型（01）：t_sys_role.status varchar(20) DEFAULT 'ACTIVE' ／ t_sys_user.status tinyint DEFAULT 1 ／ t_sys_menu.status tinyint DEFAULT 1
改前原件（02）：迁移失败: Truncated incorrect DECIMAL value: 'ACTIVE'   ← 复现生产现象（MariaDB 措辞 DECIMAL / MySQL 措辞 DOUBLE，同为 1292）
                部分执行现场（03）：victim 角色 12 / 菜单 5 / 跨租户绑定 0 / 第二管理员仍零绑定 —— 与生产同形
改后第一遍（06）：迁移执行成功（exit 0）；第二遍（08）：迁移执行成功（exit 0）
0 行变更（07 vs 09）：role/menu/binding 行数 24/10/3 与三个 MD5 逐字节相同
198⑥ 核对（10）：tenants_without_roles=0、tenants_without_menus=0、cross_tenant_bindings=0、bindings_on_own_role=2
⑤ 真生效：victim_admin2（零绑定已登记管理员）拿到本租户 SUPER_ADMIN 绑定；victim_disabled（status=0）不发放
反测（11/12/13/14）：u.status 跨类型 ⇒ 1292 'ACTIVE'；r.status 跨类型 ⇒ 1292 'DISABLED'；两条同数据改后写法均绿
```

**48 · 可达性 + 处置**（真后端 + 副本库 `s3f1f_http`）

```
改前（s3f1f-http-baseline.log）：无令牌 401（两个端点）/ 带令牌 400「缺少必填参数：id」（两个端点）/ 主链路 200
中间态（-after1.log）：只补 id 后 ⇒ 400「缺少必填参数：name」  ← 卡里没写到的第二个 NOT NULL 列
改后（-after2.log）：①POST /api/platform/tenants-management ⇒ 200 {tenant_code, id:"4ef7f9fa-…"}
                    ②POST /api/saas/tenants          ⇒ 200 {id:"852090be-…", status:1, …}
落库（28）：两行都在（name/tenant_name/company_name/contact_name/contact_person 全有值）；操作日志 tenant_id = 4ef7f9fa-…（真 UUID，不是 0）
路由对照（30）：未注册路径 POST /api/saas/tenants-xyz ⇒ 404 «Cannot POST»（证明 400/200 是"到了 handler"）
代码级反测（20 → 21）：两个 service 退回改前 ⇒ 2 failed | 17 passed（正是两例新护栏）；按 SHA256 原样还原 ⇒ 2 passed (19)
```

**门禁**：全量 `npx vitest run` **647 files / 7664 tests / 0 failed**；`tsc --noEmit` **EXIT=0**；
`guard-route-auth` **EXIT=0**；`guard-tenant-status` **EXIT=0**；`npm run build` **EXIT=0**；
`EXPECTED_MAX_MIGRATION` 快照**保持 198**（未新增迁移）。

## 四、阻塞点 / 待凌舟裁定（详见回传卡 §六 §七）

1. **【裁定 1】** 这两个落点建出的租户是 **0 用户 / 0 角色 / 0 菜单**（与 S3-183 修的 P0 形态同源）。
   本单**未接线** `provisionTenantRbac`——理由：收口总清单第 48 项的动作只有「生成 id」；卡 §三.2 判据是「200 落库」；
   且这两个端点**不建管理员账号**（入参无 `adminUsername/adminPassword`，service 不写 `t_sys_user`），
   故卡 §二.2 里的「首管绑本租户超管」**结构性不可成立**（更像沿用 S3-183 主链路卡的措辞）。
   若要求接线：admin 侧 2 行（既有事务内）；saas 侧需先包 `transaction()`（约 5 行，保证原子）。
2. **【裁定 2】** `saas/tenant.service.ts` 的相邻缺陷本单未动（都不属"建不出租户"）：
   ① `getTenantStatistics` L320 `WHERE status='ACTIVE'` 与 tinyint 混比 ⇒ 只告警但**口径失真**；
   ② `listTenants/auditTenant/toggleTenantStatus` 仍按字符串与 tinyint 比较；
   ③ `controllers/saas/tenant.controller.ts` L18/51/78/93 的 `Number(req.params.id)` 与 varchar UUID 主键不匹配
   ⇒ `GET/PUT /api/saas/tenants/:id`、audit、toggle-status 对任何真实租户都取不到行。建议另立一单。
3. **残留边界（未修，如实报备）**：`t_tenant.name` 是 `varchar(100)` 而 zod 允许 128/200 ⇒ 超长公司名会 1406；
   **主链路同源暴露**。本单不静默截断（截断=丢数据），口径请凌舟定。
4. 无外部依赖阻塞。**生产库零写操作**（本单所有取证都在本机副本库/夹具库）。

## 五、自我报备（含对派单前提的纠正）

- 我改了卡里没写的 3 列（`name` 必须，实测；`tenant_name`/`contact_name` 是为"建出的租户在平台清单里不空白"，
  与主链路同口径）。若判为扩大范围，删这 3 列即可（各一处）。
- **卡 §一 对 49 的根因只写了一半**：⑤ 里同一处还有 `r.status = 1`（字符串列当数字比）。两处都改了，两侧都做了反测；
  只改 `u.status` 一侧时，`status='DISABLED'` 的角色行仍会让整份迁移中止。
- **上一轮夹具漏检的真正原因**（建议登记踩坑日志）：夹具**类型本来就同构**，漏的是 ①数据形态——
  夹具里没有"能让 OR 链被求值"的行（非 default 租户里的 `status ≠ 1` 用户 / 非数字状态的角色行）；
  ②只在 `SELECT` 上验——严格模式下跨类型转换在 `SELECT` **只降级为警告**，只有 `INSERT/UPDATE` 才升级为错误。
  ⇒ 夹具必须含"能触发判据的行"，且必须跑**真写语句**。
- HTTP 侧用 harness 自签平台令牌（被验证对象是建租户落点，不是登录）；无令牌对照 401、未注册路径对照 404 均已给。

## 六、复跑指引（取证人离场后可原样重放）

```powershell
# ① 副本库：本机 MariaDB 11.4.5（数据目录 D:\Users\ZXQL\tools\mariadb\data）
#    取证结束时已停库；重开（本机 root 无口令，需 skip-grant-tables）：
& 'D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mariadbd.exe' `
  '--datadir=D:/Users/ZXQL/tools/mariadb/data' '--port=3306' '--ssl=0' '--skip-name-resolve' `
  '--bind-address=127.0.0.1' '--skip-grant-tables' '--console'
#    库：s3f1f_verify（198 的夹具库）、s3f1f_http（HTTP 取证库）；夹具/探针/装置脚本全在
#    D:\Users\ZXQL\wt-agents\_s3f1f-evidence\（fixture-198.sql、state-digest.sql、
#    probe-*.sql、s3f1f-http-probe.mjs、start-http-server.ps1、00–34 号日志）

# ② 198：cwd 放 .env（DB_NAME 指向 s3f1f_verify），SQL 用仓库真文件绝对路径
cd D:\Users\ZXQL\wt-agents\_s3f1f-evidence\runner
node D:\Users\ZXQL\wt-agents\S3-183\scripts\run-migration.mjs <198 的绝对路径>

# ③ HTTP：先 npm run build，再用 start-http-server.ps1 起服务，再
node D:\Users\ZXQL\wt-agents\_s3f1f-evidence\s3f1f-http-probe.mjs http://127.0.0.1:18384 after2
```
