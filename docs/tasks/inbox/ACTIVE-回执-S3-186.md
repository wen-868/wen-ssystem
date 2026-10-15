# ACTIVE 回执 · S3-186（空库迁移静默丢 173 条补列）

- 汇报对象：凌舟（总负责人）
- 汇报人：阿坚（后端 · 本地子代理通道）｜2026-10-13
- 对应派单：`docs/tasks/inbox/ACTIVE-S3-186.md`（收口总清单第 46 项）→ 已移入 `docs/tasks/inbox/archive/ACTIVE-S3-186-20261013.md`
- 工作区：`D:\Users\ZXQL\wt-agents\S3-186`｜分支 `fix/s3-186-empty-db-migration`｜基线 `origin/main` = `09309817`｜**未 commit / 未 push / 未开 PR**
- 详细回传卡：`docs/tasks/cards/R101-S3-186-阿坚-回传.md`｜证据包：`docs/evidence/S3-186/`（README + harness + outputs）

## 一、改了什么

本单不新增迁移文件，只把 **173 条 `CALL add_column_if_not_exists / add_index_if_not_exists`** 改成不依赖存储过程的幂等写法
（`information_schema` 守卫 + `PREPARE/EXECUTE`，与仓内 081/196 同款；首关键字 `SET` ⇒ 结构语句，**默认写闸门下可执行**）：

| 文件 | 条数 |
|:--|--:|
| `docs/migrations/092_租户ID.sql` | 138 |
| `docs/migrations/120a_合规凭证字段.sql` | 8 |
| `docs/migrations/125_instant_retail_admin_fix.sql` | 10 |
| `docs/migrations/129_sale_bill_item_compliance.sql` | 6 |
| `docs/migrations/134_sale_bill_role_fields.sql` | 5 |
| `docs/migrations/137_sys_user_dept_position.sql` | 2 |
| `docs/migrations/138_approval_business_link.sql` | 2 |
| `docs/migrations/123_member_contact.sql` | 1 |
| `docs/migrations/132_product_box_barcode.sql` | 1 |

另加：① 新增守门单测 `backend/src/__tests__/shared/migration-no-call.test.ts`（迁移语料不得再出现 `CALL`，防复发）；
② `backend/src/__tests__/shared/migration-delimiter.test.ts` 的"S3-57 的 CALL 全被闸门挡下"判据因 092 已无 CALL 而**失去对象**，改为注入同形状合成 CALL（+14/−3）。
`git diff --stat` = **10 files changed, 706 insertions(+), 176 deletions(-)**。

## 二、证据（原始输出，均可复跑）

1. **缺陷两条机制**（本机私有 MariaDB 空库；`outputs/key-lines.txt`）：
   - 默认闸门：`写闸门 block 跳过 CALL 总条数：173`（173 条一条不执行）；
   - 显式 `allow`：`ER_SP_DOES_NOT_EXIST 跳过条数：35`（092 末尾 DROP 之后的过程不存在）。
2. **差多少**（`outputs/diff-runA-vs-runB.txt`）：**差异合计 83** = 缺列 **24**（12 张表，含 6 张审批表 `tenant_id`、`t_retail_cart.tenant_id`、`t_member.contact`、`t_sale_bill*` 5 列、`t_sale_bill_item` 6 列、`t_product_sku.box_barcode`、`t_miniapp_order_sync_log` 4 列）+ 缺索引 **59**（其中 **49 条是同表同列的重复命名**，功能不缺；**10 条真缺失**，9 条为缺列连带）。分类见 `outputs/gap-analysis.txt`。
3. **修复后**（`outputs/diff-runB-vs-runC.txt`）：**差异合计 0**（缺表/缺列/缺索引/列定义不一致全 0）；
   `outputs/acceptance-runE.txt`：`判据①~④ 全 PASS`、`S3186_ACCEPTANCE=GREEN`。
4. **反测两侧**：退回修复 ⇒ `acceptance-runD.txt` = **RED（差异 83 / 173 条被静默跳过）**；复原 ⇒ `acceptance-runE.txt` = **GREEN**；
   另两条单测反测（往 137 加一行 CALL ⇒ 新守门红并点名文件行；去掉合成 CALL ⇒ 该既有用例红）。
5. **门禁**：`npx vitest run` ⇒ **647 files / 7664 tests / 0 failed（EXIT=0）**；`tsc --noEmit` ⇒ **EXIT=0**；`guard-route-auth` / `guard-tenant-status` ⇒ **EXIT=0**。
6. **等价性自证**：`verify-rewrite.mjs` ⇒ 173 条逐条 `① 条数守恒 ② 落盘一致 ③ 前缀免疫 ④ 动态 SQL 逐字节等价` = **ALL PASS**。

## 三、阻塞点与需凌舟裁定/处置

1. **生产实测未做**（红线 1 只允许空库副本）：本单基线是"语料意图"结构，不是生产实测；只读核对 SQL 已写在回传卡 §八.1，建议随部署窗口执行。若证实生产同源缺这 24 列，**补齐生产属另一条链**（写操作 + 备份），本单不顺手做。
2. **`docs/数据库变更清单.md` 需凌舟更新**（红线 3 禁止我改）：125 条目的"092 之后存储过程可用"前提不成立；120a 条目"✅ 已执行"与其 8 条 CALL 传无前缀表名（恒 `ER_NO_SUCH_TABLE`）矛盾。
3. **24 条无 `t_` 前缀的 CALL 语义按原样保留**（092=12、120a=8、137=2、138=2，全部恒失效）：属**另一个独立缺陷**（表名缺前缀），建议另立一单。
4. **记忆文件未改**：`docs/memories/阿坚-记忆.md` 与并行 S3-187 同署名，并发写会互相覆盖；建议凌舟统一落一笔。
5. 观察项（非本单）：语料"第二次跑才收敛"的 15 个索引、`t_delivery_record.rider_id` 列序（就地 vs 事后重放），已在证据包 README 如实登记。
