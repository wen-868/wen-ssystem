# R101-S2-02 · `module_access` 只读影响面评估（组 2 前置动作）

- **执行人**：林夕
- **依据**：《R101-S2-02 凌舟裁定》§三 ① —— 登记 **S3-34**，本批不修；**组 2 开始前先出只读影响面评估**；若评估显示授权链路已失配，则升格为组 2 前置必修。
- **性质**：**只读静态评估**（未修改任何代码，未连真库）。真库脏数据计数 SQL 见 §6，待有库环境执行。
- **仓库**：`D:/Users/ZXQL/ZXQL-MS/wen-ssystem`

---

## 一、结论先行

| 判据 | 结论 |
|---|---|
| 数据层语义是否失配 | **是**（成立） |
| 按 `module_code` 校验的授权链路是否已接入 | **否（全仓 0 处）** |
| 当前实际功能后果 | **无功能影响，仅展示错乱**（平台端租户详情把中文当模块码展示） |
| 是否满足升格条件（「授权链路已失配」） | **不满足** → 不升格为组 2 前置必修 |
| 风险定性 | **哑弹**：一旦按 code 的菜单 / 接口门禁上线（或 `updateTenantModules` 接入 UI），**立即**表现为功能不可用 |

**为什么说是哑弹**：唯一键为 `(tenant_id, module_code)`，中文码与英文码**不冲突、会并存成两行**。届时白名单防御会出现「看似已授权、实则码不匹配」的**隐蔽漏判**——比直接报错更难排查。

---

## 二、写入方全量清单（`t_tenant_module_access`）

| 链路 | 位置 | 操作 | 参数来源 |
|---|---|---|---|
| 开通订阅 | `backend/src/services/admin/subscription.service.ts:263-270` | `DELETE ... granted_by='PLAN'` + `INSERT(module_code, module_name) VALUES(?, mod, mod)` | `JSON.parse(plan.module_access)` |
| 换套餐 | `backend/src/services/admin/subscription.service.ts:340-347` | 同上 | 同上（`:339` parse、`:345` 传 `mod, mod`） |
| 续费 | `backend/src/services/admin/subscription-renewal.service.ts:123-130` | 同上 | 同上（`:122` parse、`:128` 传 `mod, mod`） |
| 手动授权 | `backend/src/services/admin/tenant.service.ts:358-369` | `INSERT ... ON DUPLICATE KEY UPDATE` | 请求体 `mod.moduleCode` / `mod.moduleName`（**分列传值，语义正确**） |
| 套餐 CRUD | `subscription-plan.service.ts:127 / :196 / :259` | `UPDATE/INSERT t_subscription_plan SET module_access = JSON.stringify(body.moduleAccess)` | 前端直传，**无任何校验** |

- 三处订阅链路均为「先删 `granted_by='PLAN'` 再重建」→ 手动授权（`MANUAL`）**不会被覆盖**，中英文码并存。
- 其它前端子工程（`admin-web` / `app-mobile` / `website`）对该表与字段**零引用**。

## 三、读取 / 校验方全量清单

| 类别 | 数量 | 位置 | 说明 |
|---|---|---|---|
| **按 `module_code` 校验** | **0 处** | — | 全仓无 `WHERE module_code = ?`，无 `checkModule` / `hasModule` / `requireModule` / `moduleEnabled` 等门禁函数 |
| 仅读取展示 | 3 处 | `tenant.service.ts:155-163`、`327-335`、`380-387` | 均 `SELECT module_code AS moduleCode, module_name AS moduleName`，**仅透出不判定** |

- 前端 `saas-admin/src/api.ts:151,155` 定义了 `getTenantModules` / `updateTenantModules`，但**无任何 `.vue` 调用** → 该 API 目前是死代码。
- `saas-admin/src/views/platform/AdminPermissions.vue:207` 的 `moduleCode` 是角色权限矩阵的本地状态键，与本表无关。

## 四、module 码表：不存在

- `docs/init_database.sql` 无 `t_module` / `t_sys_module` / `t_platform_module` / 字典表（全文仅 `t_operation_log.module VARCHAR(64)`）。
- `t_tenant_module_access` 无字典外键（`docs/reports/schema-audit-2026-08-07.md:229`：8 列）。
- **目前 `module_code` 取值实际由 DDL 注释 + 016 号迁移种子约定**，无强制约束：

```sql
-- docs/migrations/016_phase9_tenant_subscription.sql:213-225（唯一权威种子，12 项）
dashboard 工作台 / sales 销售管理 / purchase 采购管理 / inventory 库存管理
customer 客户管理 / product 商品中心 / credit 财务管理 / report 数据报表
marketing 营销推广 / instant_retail 即时零售 / approval 审批流程 / system 系统管理
```

> ⚠️ `features` 列是**另一套命名空间**（`basic_sales` / `full_inventory` …，见 `:172,182,192`），**勿与 module_code 混用**。

## 五、前端当前送什么

- `saas-admin/src/constants/plan-features.ts:98-105`：`FeatureItem` **只有 `name`，无 `code`**（注释自陈「同时作为 moduleAccess 的存储值（沿用存量口径）」）。
- `FEATURE_GROUPS`（`:112-157`，**5 组 23 项**）全部为中文项名。
- `PackageForm.vue:401` 提交行确认取 `it.name`：
  ```ts
  moduleAccess: featureGroups.flatMap((g) => g.items.filter((it) => checked[it.name]).map((it) => it.name)),
  ```
  回显 `:370`、克隆 `:508-511` 亦按中文名匹配 → **前后端闭环自洽于中文**。
- 后端三道口子全部放行：`subscription-plan.controller.ts:42/66/98` 为 `moduleAccess: z.any().optional()`；service `:127/:196/:259` 直接 `JSON.stringify`；`tenant.controller.ts:84` 仅 `z.string().min(1).max(64)`。
- **其它页面**：`TenantForm.vue` / `TenantDetail.vue` 对 `module` 零命中 → **只有套餐页在写，且只有它送中文**。
- **已有码表 / 映射：不存在**。全仓唯一含中文功能名的后端文件是测试 mock（`backend/src/__tests__/mocks/mock-db-platform-miniapp.ts:17`），非映射。修复时需**新建** name↔code 映射。

## 六、真库脏数据只读统计 SQL（未执行，待有库环境）

```sql
-- ① module_code 含非 ASCII / 非码形 的行数，按租户分组
SELECT tenant_id,
       COUNT(*)                                                        AS total_rows,
       SUM(CASE WHEN LENGTH(module_code) <> CHAR_LENGTH(module_code)
                THEN 1 ELSE 0 END)                                    AS non_ascii_rows,
       SUM(CASE WHEN module_code NOT REGEXP '^[A-Za-z0-9_]+$'
                THEN 1 ELSE 0 END)                                    AS not_code_shape_rows
FROM t_tenant_module_access
GROUP BY tenant_id
ORDER BY non_ascii_rows DESC;
```
> 判定意图：`LENGTH` 计字节、`CHAR_LENGTH` 计字符，不等即含多字节（中文必然命中）；`NOT REGEXP '^[A-Za-z0-9_]+$'` 兜底捕获空格 / 全角 / 标点畸形码。

```sql
-- ② 不在白名单内的 module_code：计数 + 样例（白名单＝016 种子 12 项）
SELECT tenant_id, granted_by, module_code, module_name, COUNT(*) AS cnt
FROM t_tenant_module_access
WHERE module_code NOT IN
  ('dashboard','sales','purchase','inventory','customer','product',
   'credit','report','marketing','instant_retail','approval','system')
GROUP BY tenant_id, granted_by, module_code, module_name
ORDER BY cnt DESC, tenant_id
LIMIT 100;
```
> 判定意图：`granted_by='PLAN'` 的行即三条订阅链路写入的脏数据；若同时存在 `MANUAL` 的英文码 → 中英文并存坐实。

```sql
-- ③ t_subscription_plan.module_access 原始 JSON 抽样（判污染源形态）
SELECT id, plan_code, plan_name, status, module_access, JSON_LENGTH(module_access) AS cnt
FROM t_subscription_plan WHERE module_access IS NOT NULL ORDER BY id LIMIT 50;

-- ③b 污染源快速定性：是否含中文条目
SELECT id, plan_code,
       CAST(module_access AS CHAR) LIKE '%采购管理%'   AS has_zh_caigou,
       CAST(module_access AS CHAR) LIKE '%多门店管理%' AS has_zh_duomendian
FROM t_subscription_plan WHERE module_access IS NOT NULL;
```
> 判定意图：确认 `module_access` 存的是中文文案数组还是英文码数组 → 决定修复要加「前端转换」还是「后端兼容双写」。

## 七、对修复口径的补充建议（待裁定，不在本批执行）

裁定口径为「`module_access` 规范为 module_code 数组 + 前端码表转换 + 后端反查中文名 + 白名单防御」。落地时有三点需先定：

1. **白名单全集从哪来**：目前只能取 016 种子的 **12 项**；但设计稿功能矩阵是 **23 项中文名**，两者**不是同一套**（模块 vs 功能点）。必须先定「模块码体系」——是沿用 12 项模块码，还是按 23 项功能点新立功能码？**这决定码表怎么建**。
2. **存量数据订正**：真库若已有中文 `module_code`，需要一条幂等订正迁移 + 变更清单登记（护栏⑤）。订正映射依赖第 1 点的码表。
3. **两条路径的取舍**：
   - A. 前端加 `code` 字段 + 提交前转换（干净，但要改 `plan-features.ts` 与回显逻辑，且存量中文套餐的回显需兼容）；
   - B. 后端在写 `t_tenant_module_access` 时做「中文→码」反查 + 非白名单拒绝记日志（一处收口，但需后端持有中英文映射表）。
   建议 **B 为主 + A 为辅**（后端兜底防御，前端逐步规范化）。

## 八、组 2 是否可以开工

**可以。** 授权链路尚未接入，本问题不阻塞组 2（账单类）。建议在 S3-34 卡内保留「真库脏数据计数」与「模块码体系定档」两个前置子项，待真库环境就绪后执行。
