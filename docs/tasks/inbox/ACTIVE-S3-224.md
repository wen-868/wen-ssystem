# ACTIVE-S3-224 · 销售域权限接线（B2 批 6）= 收口总清单第 43 项（续）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树（**本单唯一允许写的工作树**）：`D:\Users\ZXQL\wt-agents\S3-224`｜分支 `feat/s3-224-sales-domain-wiring`
> 卡名（认领用）：`/root/s3228_ajian`（见 `docs/tasks/inbox/ACTIVE.md` 路由表）
> 基线：开工当日 `origin/main`（`git fetch` 后取真值写进回执）
> ⚠️ 与 S3-223（财务域）并行：基线/计数断言按"只移除本域条目、只改计数常量"处理（前四批已跑通此约定）。

---

## 一、一句话目标

把**销售域**（台账 §二：**17 文件 / 91 写端点（88 管理面 + 3 公开）/ 0 条需新立权限点**）的写端点按「**该端点真实使用者已持有的模块码**」接线。
⚠️ 这是**当前最大的一批**（88 条）：**按文件分 2~3 组推进，每组落一次证据**（不要攒到最后一次性交）。

## 二、方法（照批 2~5 已跑通的打法 + 三条硬规则）

1. **生产只读核对**：按 **R-PROD-READ**（`docs/tasks/cards/R101-S3-220-凌舟验收与裁定.md` §四）——**本卡显式授权**只读 `SELECT`：
   导出 `t_sys_role.permissions`（`tenant_id='default'`），并**特别核对** `sale:*` 族（`sale:create|view|return|bill|cancel` 等）与 `store:*`/`finance:*` 的持有关系。
   已知：`STORE_MANAGER` 持 `store:* sale:* customer:* inventory:* report:* dashboard:* finance:payment goods:price finance:daily-settle`；`STORE_OPERATOR` 持 `sale:create sale:view sale:return inventory:view dashboard:view finance:daily-settle`。
2. **接线前先查两道闸**（批 3 的教训）：① `rbac-g0-wiring.test.ts` 内**已锁定/待裁定**的端点；② `guard-rbac-wiring --json` 的 `authForm`。命中锁定的不接、逐条报备。
3. **查询型 POST 不按写端点接**（`preview`/`best-*`/`query` 类不改数据）⇒ 不接、登记。
4. **优先挂"使用者已持有的模块码"**；`sale:*` 族**不许**为了省事整体套用——逐端点看**页面/按钮的真实使用者**：
   `sale:cancel` 属高风险管理动作（已由 S3-209 落过先例：销售单取消端点），不得顺手扩大给收银员。
5. 3 条公开端点按台账口径**免鉴权**并逐条登记理由；找不到合适码的 ⇒ 不接、登记「待授权模型定案」。

## 三、判据（逐条给原始输出；**分组交付时每组都要有**）

1. **对账**：`88 = N（已接） + 锁定/查询型 + 公开 + 待授权`（逐条列名 + 理由）；
2. **两侧反测**：① 缺码 ⇒ 403；② 有码 ⇒ 通过；③ **摘掉任一接线 ⇒ 用例必红**；
3. **门禁**：`guard-rbac-wiring` 缺口 = 起点 − N，`--strict` **EXIT=0**（新接线登记进基线）；
4. **回归**：全量 `npx vitest run` 0 failed、`npx tsc --noEmit` 0、`npm run build` 0；
5. **零回归论证**：每个码列出生产持有角色，并证明与页面/按钮使用者一致（**销售域直接关系钱与货，这条必须逐条写**）。

## 四、红线

1. 不得新增权限码、不得改角色种子权限、不得动 `docs/migrations/**`；
2. 不得改 `.github/**`、`deploy/**`、契约文档、收口总清单、`current-tasks.md`；
3. 不得碰其它单的工作树（`wt-agents/S3-223` 等）；
4. **不得 push、不得开 PR、不得 `git add -A`**；
5. 证据与日志不得出现口令/密钥明文（`guard-evidence-secrets` 已接 CI）；
6. 回传卡**不得**出现「凌舟裁定 / 凌舟验收」字样。

## 五、交付物与回传

- 代码：销售域路由文件的声明式接线（`routeConfig` + `requirePermission`）；
- 用例：本域两侧用例（可分组多个文件）+ 摘中间件反测；
- 台账：`rbac-wiring-baseline.json`（只移除本域条目）+ `docs/tasks/R101-RBAC接线缺口清单.md` 对应行（新增章节）；
- 证据：`docs/evidence/S3-224/**`（生产只读核对、门禁前后、分组读数、反测、哈希）；
- 回传：`docs/tasks/cards/R101-S3-224-阿坚-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-224.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据（可复跑命令 + 原始输出）｜ 验收自评（对照 §三 逐条）｜ 未完成与阻塞 ｜
风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡

## 六、卡外纪律

- 发现卡外问题 ⇒ 只登记不动手；
- **中途报进度**：每完成一组（约 30 条）就把该组证据落盘；若整域 3 小时内拿不下，先把已接线的组交出来（带反测），剩余组在回执里列明"下一组待续"，不要为了整域好看而拖到超时。
