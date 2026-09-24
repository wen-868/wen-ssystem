# S3-107 生产残留辅助存储过程清理（凌舟执行，2026-09-25）

## 背景

S3-57/D1 修复后，生产库 `liquor_inventory` 仍剩 **1 个**无来源的辅助存储过程 `add_col_if_not_exists`：
- 创建于 **2026-08-07 13:45:47**、DEFINER `zhixiang_app@localhost`；
- **仓内不存在**（`rg -rn "add_col_if_not_exists" docs/` 仅命中 D1 的证据与派单卡，非来源）；
- 属"历史手工修复遗留"（派单卡 `R101-派单-20260919-B.md:31` 已记录：库内原有 3 个残留辅助过程，第三个**仓内不存在**）。

## 执行前的三源确认（缺一不做）

| 项 | 结果 |
|---|---|
| 是否被引用 | 服务器全盘 `grep -rl`（排除仓库证据目录）⇒ 仅 git pack（历史）与仓库文档，**无可执行引用** |
| 是否有来源 | 仓库内**无**该过程定义（D1 与派单卡均记为"仓内不存在"） |
| 定义是否已备份 | ✅ 已 `SHOW CREATE PROCEDURE` 落盘（本目录 `add_col_if_not_exists.definition.sql`，681 B），服务器侧 `/root/archive-20260925/s3-107/` 同份 |

## 执行与验证（可复跑）

```sql
-- 执行前
SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='liquor_inventory';   -- 1
DROP PROCEDURE IF EXISTS `liquor_inventory`.`add_col_if_not_exists`;
-- 执行后
SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='liquor_inventory';   -- 0
```

| 项 | 执行前 | 执行后 |
|---|---|---|
| `information_schema.ROUTINES` 计数 | **1** | **0** |
| `/health` | 200 | **200** |
| 平台 captcha | 200 | **200** |

**回滚方式**：重放本目录 `add_col_if_not_exists.definition.sql` 里的 `CREATE PROCEDURE` 语句即可恢复（定义与参数签名完全保留）。

## 结论

生产库**已无任何残留辅助存储过程** —— "辅助过程残留"这一族彻底闭环：D1/S3-57 让 `092:282-283` 的 `DROP` 真正执行（清掉 2 个），本次 S3-107 清掉最后 1 个仓内无来源的残留。
