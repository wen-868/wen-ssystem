# S3-144 验证记录（可复跑命令 + 原始输出）

> 执行人：阿坚（后端）｜2026-10-02
> 被测对象：`docs/evidence/S3-144/patch/S3-144.diff`（7 个文件）应用后的 scratch 树
> scratch 树：`$env:TEMP\s3144-scratch-010658`（`backend/src` 复制自本工作树 + 补丁覆盖 + `docs/migrations` 含 192）
> 私有 DB：`D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin` 起的 MariaDB 11.4.5，127.0.0.1:3402，datadir 在 `$env:TEMP`

## 一、环境与构建

| 步骤 | 命令 | 结果 |
|:--|:--|:--|
| 装补丁前的基线类型检查 | `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`（本工作树） | EXIT=0 |
| 补丁后类型检查（生产代码） | 同命令（scratch/backend） | **EXIT=0** |
| 补丁后类型检查（含测试） | `tsc -p tsconfig.test.json --noEmit`（scratch/backend） | 全仓 224 处**存量**测试类型报错；**本单 3 个测试文件 0 处**（grep 本单文件名无命中） |
| 补丁后构建 | `tsc -p tsconfig.json` + `node scripts/fix-esm-extensions.js dist` | **EXIT=0**（785 个 JS，修复 1785 处导入） |
| ESLint（本单 4 个源文件） | `node node_modules/eslint/bin/eslint.js src/services/...`（scratch/backend） | **0 error**，1 warning（`applyTenantRegister` complexity 40 > 15，存量警告，C6-3-2a 裁定⑦同口径不返工） |

## 二、真实库运行期证据

装置：`docs/evidence/S3-144/tools/s3144-e2e.mjs`（跑补丁后的 `dist`，非 SQL 手抄）。

### 2.1 全新库（只跑 `migration.ts` 口径 + 迁移段）

```
node s3144-e2e.mjs        # S3144_MODE=fresh，DB=s3144_fresh（DROP 后新建空库）
```

原始输出：`docs/evidence/S3-144/evidence/fresh-db-run.txt`

```
PASS | 迁移 192：全新库 t_tenant 补齐缺列 | 命中列 = company_name,contact_person,source,tenant_code
PASS | 迁移 192：t_tenant_register_application 增 promo_code/agent_id | 命中列 = agent_id,promo_code
PASS | 反测：原实现 INSERT 复现失败 | ER_NO_DEFAULT_FOR_FIELD Field 'id' doesn't have a default value
PASS | 反证：VARCHAR 主键 INSERT 的 insertId 恒为 0 | insertId=0
PASS | A 项：createTenant 返回真实 UUID（非 0） | tenantId=fc947bfc-783d-47fd-a5bb-3043bfdea6db
PASS | A 项：建租户落库（tenant_code 非空 / source=MANUAL / status=1） | {...te...}
PASS | A 项：平台侧开租户不写归因 | attribution rows=0
PASS | A 项反测：缺必填 ⇒ 400 且不落库 | status=400 body={"code":"400","msg":"缺少必填字段",...}
S3144_E2E_SUMMARY total=8 passed=8 failed=0        （进程 EXIT=0）
```

### 2.2 全流程（含 `docs/init_database.sql` 基线表后跑迁移）

```
# 基线表：mariadb -e "source docs/init_database.sql"  → liquor_inventory（62 张基础表）
node s3144-e2e.mjs        # S3144_MODE=full，DB=liquor_inventory
```

原始输出：`docs/evidence/S3-144/evidence/full-flow-run.txt`

```
PASS | 迁移 192：全新库 t_tenant 补齐缺列 | 命中列 = company_name,contact_person,source,tenant_code
PASS | 迁移 192：t_tenant_register_application 增 promo_code/agent_id | 命中列 = agent_id,promo_code
PASS | 反测：原实现 INSERT 复现失败 | ER_NO_DEFAULT_FOR_FIELD ...
PASS | 反证：VARCHAR 主键 INSERT 的 insertId 恒为 0 | insertId=0
PASS | A 项：createTenant 返回真实 UUID（非 0） | tenantId=b803f36e-...
PASS | A 项：建租户落库（tenant_code 非空 / source=MANUAL / status=1） | {...}
PASS | A 项：平台侧开租户不写归因 | attribution rows=0
PASS | A 项反测：缺必填 ⇒ 400 且不落库 | status=400 code=400
PASS | B 项：带邀请码注册申请落库 | applicationId=1
PASS | B 项：审批通过返回真实 tenant_id（UUID） | tenantId=ba8a7a97-3127-433e-8719-af687982b4f4
PASS | B 项：t_tenant.source 合规（既有三取值之一，邀请码 ⇒ INVITATION） | {"...","source":"INVITATION"}
PASS | B 项：联系人/手机号落库未串位 | contact_person=王五 contact_mobile=13900000001
PASS | D 项：归因 +1（t_tenant_attribution 新增 1 行且指向该租户） | {"tenant_id":"ba8a...","promo_code_id":1,"agent_id":null,"attribution_type":"PROMO",...}；总数 0 → 1
PASS | 反测：坏邀请码 ⇒ 400 且不建租户 | err=推广码不存在：PCNOTEXIST；租户数 3 → 3
PASS | D 项反测：一租户一条归因，二次写 ⇒ 409 + 明确文案 | err=该租户已存在归因记录（一租户一条归因），不可重复归因：ba8a...
S3144_E2E_SUMMARY total=15 passed=15 failed=0      （进程 EXIT=0）
```

## 三、跑不了的门禁（如实报）

| 门禁 | 状态 | 原因（实测） |
|:--|:--|:--|
| `npx vitest run`（全量） | ❌ 未跑 | 本沙箱禁止 node 创建子进程：`node -e "require('child_process').spawnSync(process.execPath,['-v'])"` ⇒ `err EPERM`；vitest 需 esbuild 子进程服务 + forks/threads worker，故启动即 `Error: spawn EPERM`（配置阶段就失败）。把 esbuild.exe 复制到 `$env:TEMP` 并设 `ESBUILD_BINARY_PATH` 仍 EPERM。 |
| `npm run build`（等价复跑） | ✅ 已跑 | 用 `tsc` + `fix-esm-extensions.js` 复现（见 §一），EXIT=0 |
| `npx eslint src`（全仓） | ⚠️ 只跑本单文件 | 本单 4 个源文件 0 error；全仓 eslint 未跑（沙箱限制同上，非本单范围） |

## 四、未根治的独立缺陷（本单只报不改，见回执"未完成与阻塞"）

`backend/src/shared/migration.ts` 第 1.5 步执行 `init_database.sql` 时用的是
`.split(";").filter(s => s.trim().toUpperCase().startsWith("CREATE TABLE"))`——
**以注释块开头的语句整块被丢弃**（踩坑 [63] 同类），导致全新库上 `t_sys_config` 等表建不出来
（实测：`s3144_fresh` 上 `SELECT COUNT(*) FROM information_schema.TABLES` 有 308 张表，但没有 `t_sys_config`，
种子初始化报 `Table 's3144_fresh.t_store' doesn't exist`）。
本单的全流程验证因此采用"先 `source docs/init_database.sql` 建基线表、再跑迁移"的生产同构方式。
该缺陷影响面（哪些表只在 init_database 里定义、全新库缺表清单）未在本单统计，建议另立单。
