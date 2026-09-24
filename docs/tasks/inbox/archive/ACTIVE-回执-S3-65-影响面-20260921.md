# 回执 · R101-S3-65 影响面精确扫描（只读静态扫描）

> 汇报对象：凌舟（总负责人）
> 汇报人：阿坚（后端域；本地子代理代执行）｜2026-09-21
> 对应派单编号：**R101-S3-65-影响面**（派单卡 `docs/tasks/cards/R101-S3-65-影响面-派单卡.md`；开工第一步已按 AGENTS.md 读 `docs/tasks/inbox/ACTIVE.md` 全文）
> 交付物：`docs/tasks/cards/R101-Ajian-S3-65-影响面.md`（本次唯一新建的报告文件）

---

## 一、一句话结论

三 helper 写路径调用点共 **356** 处（UPDATE 281 + DELETE 75），其中"修复前静默 0 行、修复后首次真正生效"的写操作调用点为 **38 处 / 27 个文件**；旧口径 10 处全部包含在内，新增 28 处（含生产 P0 现场 `services/admin/auth.service.ts:293` 改密）。

## 二、改了什么（严格只读）

| # | 动作 | 文件 | 说明 |
|---|---|---|---|
| 1 | 新建 | `docs/tasks/cards/R101-Ajian-S3-65-影响面.md` | 报告卡（唯一新建的报告文件），含写路径全量表 356 行、读路径按文件聚合 169 行、命中集逐条展开 38 行、反证 4 组、口径差异表、风险与需运行期确认清单、复跑命令、脚本附录 |
| 2 | 新建 | `docs/tasks/inbox/ACTIVE-回执.md` | 本回执（署名齐全 + 复跑命令） |
| 3 | 归档移动 | `docs/tasks/inbox/ACTIVE.md` → `docs/tasks/inbox/archive/ACTIVE-S3-65-影响面-20260921.md` | 按 inbox 铁律（同时只允许一张活动卡） |

**未做**：未改任何 `backend/**` 源码与测试、未改 `docs/` 其他文件（含 `current-tasks.md`、`踩坑日志.md`、`R101-总进度与推进计划.md`）、未 commit/push/切分支/改 HEAD、未连数据库、未起服务与浏览器。

## 三、证据（可复跑）

1. **计数**（AST 调用点级；命令与输出同卡 §2.2）：
   - `files scanned: 707  calls: 1842`；`byHelper: queryWithTenant 967 / queryOneWithTenant 851 / executeWithTenant 24`
   - `byStmt: UPDATE 281 / DELETE 75 / INSERT 177 / SELECT 1298 / 动态+不可解析 11`
   - `write rows: 356  hits: 38（27 files）`；删除类 75 处"首个 WHERE 前占位符"全部 = 0 ⇒ DELETE 无一命中
2. **反证（真实函数两版复算）**：从 main 现版与分支 `fix/s3-65-change-password-fail` 提交 `1c46dd9c` 提取真实 `injectXxxTenant` 五函数，同进程复算（未连库）：
   - `UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?` + `["$2b$12$HASH",7]` + `"default"`：
     修复前 `["default","$2b$12$HASH",7]`（SET 拿到 `'default'`）；修复后 `["$2b$12$HASH","default",7]`（各归其位）
   - 反例三条（SET 全字面量 / 已自带 tenant_id / SELECT 分支）两版输出**完全一致** ⇒ 判据可分辨
   - 附带发现：`injectInsertTenant` 重建 SQL 对 `VALUES (..., NOW())` 会丢尾部括号，`services/admin/push.service.ts:371` 注入后括号不平衡（13 处可静态注入的 INSERT 中唯一 1 处）
3. **只读性**：`git status --porcelain` 原始输出见报告卡 §8（仅本卡三项 + 凌舟开工前既有改动）。

## 四、验收自评（逐条对照派单卡 §一 验收标准 1-6）

| # | 验收标准 | 自评 | 依据 |
|---|---|---|---|
| 1 | 计数可独立复算（误差 0） | 通过 | §2.1 总表 + §2.2 命令（含"分母怎么数出来"+旧命令复跑对照） |
| 2 | 命中集逐条可核对（文件:行号 + 展开后 SQL + tenantId 实参行） | 通过 | §3 共 38 行，动态 SET 一律展开为元素清单（如 `updates.join(", ")` ⇒ 6 个 `= ?` 元素）并给元素来源行号 |
| 3 | 反证（不命中 ≥3 条归类 + 命中 ≥3 条两版参数对照） | 通过 | §4.1 命中 5 例（S1/S2/S3/S5/S6）+ 反例 3 例；§4.2 不命中 6 条逐条指明卡在哪一条件 |
| 4 | 与旧口径（10 处 / 484 / 439）差异逐条解释 | 通过 | §5.1 一张对照表（10/10 全包含 + 28 新增分类与依据）；§5.2 484 不可复现（旧命令复跑 769）并给替代数字 356/396/26 |
| 5 | 四条件逐项有依据（SET 原文片段 + tenantId 实参来源） | 通过 | §1.1 表内"SET 含占位符?"列即 SET 原文片段证据；"参数 tenantId @函数:行"与"实参行"两栏给溯源；§4.1 给真实下发参数 |
| 6 | 只读性自查（`git status --porcelain`） | 通过 | §8，原始输出 + 逐项说明哪些属既有改动 |

## 五、未完成与阻塞

1. **旧数字 484/439 无法复现**（非本卡未做，而是旧扫描脚本未入库）：按旧卡 §七 命令复跑得 769 行，与 484 不符；本卡已给出可复算替代（三 helper 356 / 五 helper 396 / 事务内 `conn.*` 26）。
2. **本通道无运行期能力**（Node 子进程 `spawn EPERM`、无浏览器、不连库）：所有"运行期相关"结论已单列报告卡 §7（**需运行期确认**），不计入命中集。
3. 无其他未完成项。

## 六、风险与自我报备

1. 命中集 38 处中 **32 处**调用方不校验 `affectedRows`（有校验 6 处已列名）⇒ 修复后写入生效，但"0 行"仍不会被感知（另一批工作，本卡未动）。
2. `services/admin/marketing-points.service.ts:292` 修复前存在"积分流水已写入（`:301` 的 INSERT 自带 tenant_id，未被注入短路影响）、用户余额未扣减"的矛盾数据 ⇒ **存量数据需人工清点**（本卡不能连库，未清点）。
3. **附带发现两处范围外缺陷（本卡只读未修）**：① 读路径同族——`injectSelectTenant` 含 WHERE 分支（`config/database.ts:225`）同为前置写法，本卡扫得 1 处满足错位形态（`services/admin/report/sales-report.service.ts:154`），且修复分支 `1c46dd9c` **未触及**该函数，属**未根治**；② `injectInsertTenant`（`:251-266`）重建 SQL 会丢尾部括号（`push.service.ts:371`）。
4. 判据口径说明（供凌舟复核判据本身）：本卡以"**首个 `where` 之前是否存在 `?` 占位符**"作为"注入后参数是否错位"的判据，与实现（`lowerSql.indexOf('where')` 首现位置 + `[tenantId, ...params]` 前置）一致；该判据已由 §4.1 两版复算正反各验。
5. 本卡未按 `current-tasks.md` 更新看板：派单卡 §五.3 明确"本卡为只读扫描单，不涉及看板状态变更（由凌舟验收后统一更新）"，故本卡遵守派单卡、未动该文件。
6. 扫描脚本临时产物写在 `%TEMP%\s365\`（仓外），仓库内未留任何脚本或临时文件。

## 七、复跑命令（原样可粘贴）

```powershell
cd D:\Users\ZXQL\ZXQL-MS\wen-ssystem

# 1) 关键锚点（main 现版 = 修复前；只读）
rg -n 'modifiedParams: \[tenantId, \.\.\.params\]' backend/src/config/database.ts   # → :225（SELECT 含 WHERE）、:281（UPDATE 含 WHERE）
rg -n 'placeholdersBeforeWhere' backend/src/config/database.ts                       # → main 现版 0 命中（该写法仅在分支 1c46dd9c）
rg -n 'injectUpdateTenant|injectSelectTenant|injectInsertTenant|injectDeleteTenant' backend/src/config/database.ts

# 2) 命中集最小复现（真实函数两版复算）——把报告卡「附录 B」脚本存为 %TEMP%\s365\replay.mjs 后执行
New-Item -ItemType Directory -Force -Path "$env:TEMP\s365" | Out-Null
git show 1c46dd9c:backend/src/config/database.ts | Set-Content -Encoding UTF8 "$env:TEMP\s365\database.fixed.ts"
# （把附录 B 全文写入 "$env:TEMP\s365\replay.mjs"）
node "$env:TEMP\s365\replay.mjs"

# 3) 全量扫描（调用点计数 / 写路径全量表 / 命中集）——把报告卡「附录 A」脚本存为 %TEMP%\s365\scan.mjs 后执行
# （把附录 A 全文写入 "$env:TEMP\s365\scan.mjs"）
node "$env:TEMP\s365\scan.mjs"
```

---

派单人：凌舟（总负责人）｜2026-09-21
汇报人：阿坚（后端域；本地子代理代执行）｜2026-09-21
关联卡：`docs/tasks/cards/R101-Ajian-S3-65-影响面.md`、`docs/tasks/cards/R101-S3-65-影响面-派单卡.md`
