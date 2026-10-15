# ACTIVE-回执 · S3-183（P0：租户开通不克隆角色/菜单 ⇒ 真实租户功能中心空白 ＋ 存量修复 ＋ demoLogin roles 租户过滤）

> 按 `AGENTS.md`「子代理回传」协议落盘：**改了什么 + 证据 + 阻塞点**；十项完整版见
> `D:\Users\ZXQL\wt-agents\S3-183\docs\tasks\cards\R101-S3-183-阿坚-回传.md`（工作区内），
> 同内容副本 **`docs\tasks\inbox\ACTIVE-回执.md`**（本文件是它的稳定命名副本，防止并行单互相覆盖）。
> **未覆盖、未删除**他人回执：并行单 S3-184 的回执已先复制归档为
> `docs\tasks\inbox\archive\ACTIVE-回执-S3-184-20261013.md`，它自己归档的 S3-181 那份也原样保留。
> 本单派单卡已按协议移入 archive：`docs\tasks\inbox\archive\ACTIVE-S3-183-20261013.md`。
> 产物 ref：工作区 **`D:\Users\ZXQL\wt-agents\S3-183`**（分支 **`fix/s3-183-tenant-rbac-provision`**，基线 **`origin/main` = `1cb29fc5`**）——
> **9 个文件（6 改 + 3 新增）+ 回传卡已在本分支单笔提交 `32ab8915`**（10 文件 / +899 −40，`git show 32ab8915` 可取全量 diff），**未 push、未开 PR**（红线 5：只 add 本单文件；合并由凌舟执行）。
> 另有一棵只读基线工作树 `wt-agents/S3-183-base`（`origin/main` 的**改动前**构建，供复跑"改前"一侧）。
> 证据目录（工作区外）：`D:\Users\ZXQL\wt-agents\_s3183-evidence\`（真库装置脚本 + 各阶段原始日志，命令可复跑）。

```
【汇报 S3-183】开通链路补齐「克隆角色 + 克隆菜单 + 首管绑本租户超管」，存量租户由迁移 198 补全
并把跨租户绑定**原地**改指，demoLogin 的 roles 查询补 `r.tenant_id = ur.tenant_id`：
① 真库两侧反测：改前新建租户 角色 0/17、菜单 0/57、首管无绑定、A/B/C 全空（permissions=[]、菜单 0）；
   改后 17/17、57/57、绑定指向本租户 SUPER_ADMIN、A=["SUPER_ADMIN"]、permissions 非空、超管可识别（可见 57 条菜单）。
② 198 在**生产同构副本库**上：受害租户（f0cbfe78-…，0 角色/0 菜单/绑定指向 default）⇒ 17/57 且绑定改指本租户；
   两遍幂等（第二遍逐表行数 + CRC32 逐字相同：51/119384958478、171/392194312807、16/32077337992）；
   反测（摘掉"克隆角色行"再跑）⇒ 受害租户仍 0 角色、跨租户绑定不归零（该红就红），随后前滚复绿。
③ demo 登录 roles：改前 ["SUPER_ADMIN","SUPER_ADMIN"]（重复）⇒ 改后 ["SUPER_ADMIN"]，permissions 仍 ["*"]。
门禁：全量 vitest 645 files / 7650 tests 0 failed；tsc --noEmit EXIT=0；guard:route-auth / guard:tenant-status 均 EXIT=0。
⚠️ 两条必须先看：① 跨租户绑定有"重复类"残留 5 条，迁移内**零 DELETE** 无法消除（撞 uk_sys_user_role），
已如实报数并给清单口径，需你裁定是否另立单（见回传卡 §四末与 §八.2）；
② 另查出两条 legacy 建租户链路（/api/platform/tenants-management、/api/saas/tenants）**根本不写 t_tenant.id**
⇒ 实测 400「缺少必填参数：id」（1364 映射），它们在"建租户"这一步就失败，本单未改（见回传卡 §二、§八.1）。

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 · 本地子代理通道 /root/s3183_ajian）｜2026-10-13
对应派单编号：docs/tasks/inbox/ACTIVE-S3-183.md（依据 R101-收口总清单第 17、18 项，P0）
```

## 一、改了什么（9 文件；未改门禁/CI/迁移清单/部署/契约文档/收口清单/当前批次）

```
① backend/src/services/platform/tenant-rbac-provision.service.ts  新增 154 行  ← 唯一一套"照 197 口径"的角色/菜单克隆 + 首管绑定（runner 注入，无 INSERT IGNORE）
② backend/src/services/platform-tenant.service.ts                 L1-12 / L138-186  ← createTenant 转事务：建租户 + 建首管 + 供给 + 绑本租户超管
③ backend/src/services/tenant-register.service.ts                 L14-18 / L294-303 ← 删掉"优先本租户、其次 default"的兜底绑定，改为克隆 + 绑本租户超管
④ backend/src/services/platform/tenant-admin.service.ts           L11-15 / L300-315 ← initializeTenantDefaults 补同样两步（该落点当前无路由注册，防复发）
⑤ backend/src/services/admin/auth.service.ts                      L443-451           ← demoLogin roles 查询补 AND r.tenant_id = ur.tenant_id（第 17 项）
⑥ docs/migrations/198_租户角色菜单补全.sql                          新增 172 行       ← 存量：角色/菜单补全 + 跨租户绑定原地改指 + 管理员零绑定兜底（只写 3 张系统表、零 DELETE）
⑦ backend/src/__tests__/shared/migration-c6-4-1.test.ts           L35-42 / L50       ← EXPECTED_MAX_MIGRATION 197 → 198
⑧ backend/src/__tests__/shared/s3-183-tenant-rbac-provision.test.ts 新增 269 行      ← A/A2/B/C/D 五组护栏（含四个落点接线与 198 形状红线）
⑨ backend/src/__tests__/services/platform-tenant.service.test.ts   L3-15 / L133-232  ← 随事务化同步断言 + 新增"同事务克隆/绑定 + 语句次序"断言
```

## 二、证据（原始输出摘要；全部日志在 `_s3183-evidence\`）

| 判据 | 改前（`origin/main` 构建） | 改后（本单构建） |
|:--|:--|:--|
| 新建租户 角色/菜单行（default 17/57） | 0 / 0 | **17 / 57** |
| 首管绑定 | 无绑定 | `SUPER_ADMIN`，`bind_tenant = role_tenant = 本租户` |
| A/B/C 读路径 | roles=[]、permissions **0 行**、超管识别 ❌（可见菜单 0） | roles=["SUPER_ADMIN"]、permissions **1 行**、超管识别 ✅（可见 57） |
| 鉴权/CSRF 对照 | 无令牌 401 / 无 CSRF 403（证明门是活的） | 同左 |
| demo 登录 roles | `["SUPER_ADMIN","SUPER_ADMIN"]` | `["SUPER_ADMIN"]`（permissions 两侧均 `["*"]`） |
| 198 副本库 | 受害租户 0/0、`tenants_without_roles=1`、跨租户绑定 6 | 0/0、受害租户 17/57、绑定改指本租户；第二遍 CRC 逐字相同 |

## 三、未完成与阻塞

1. 已 commit（`32ab8915`）但**未 push、未开 PR**（红线 5）；**未在生产库执行 198**（红线 3，生产写操作由凌舟负责，执行方式见迁移文件头）。
2. 未跑 e2e / 部署防线（凌舟阶段）。
3. 唯一"未完全归零"：跨租户绑定**重复类残留 5 条**（迁移内零 DELETE 消除不了，撞 `uk_sys_user_role`）—— 需凌舟裁定。

## 四、风险与自我报备

1. 两条 legacy 建租户链路**建不出来**（不写 `t_tenant.id` ⇒ 实测 400「缺少必填参数：id」），本单未改，建议另立单或下线。
2. `issueLoginResult`（普通登录）的 roles 查询同样未加 `r.tenant_id = ur.tenant_id`（本单按卡只改 `demoLogin`；198 落地后跨租户绑定被清，该处重复自然消失）。
3. 198 第 ⑤ 条（管理员零绑定兜底）为窄口径（`t_tenant_admin` 登记过 **或** `username='admin'`，且零绑定）；要求收紧时删 `OR u.username = 'admin'` 一处即可。
4. ④（`platform/tenant-admin.service.ts`）是**当前无路由注册**的落点，补齐只为防复发；如判定"死代码不该动"，该文件 3 处改动可单独 revert，不影响其余 8 个文件。
5. 本机环境：取证后端已停（18383 无监听）；副本库 `s3183_verify` 保留便于复跑；未动生产、未动他人库。
6. 关联卡：`docs/tasks/R101-收口总清单.md` 第 **17/18** 项；第 44/45 项由并行单 S3-184 处置（本单未碰其文件与工作树）。

派单人：凌舟（总负责人）｜2026-10-13
回传人：阿坚（后端 · 本地子代理通道）｜2026-10-13
