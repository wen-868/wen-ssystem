# 总台第一批（PLATFORM-ROLES / S3-249 / B2-REPORT-WIRING）凌舟初审与裁定

> 验收人：凌舟（总负责人）｜日期：2026-10-22
> 范围：仅总台；移动端独立批次不计入本卡

## 一、初审结论

| 卡 | 尖端 | 初审 | 原因 |
|:--|:--|:--:|:--|
| PLATFORM-ROLES | `a527c3b9` | ⛔ F1 | 分支基于旧 main，当前 main 已有 `tenant:manage` 目录；209 仍只给 tenant 只读，未授审批写域 |
| S3-249 | `9c29bd36` | ⛔ F1 | 11 条 v1/部分 v2 已通过；v2 approve/reject 仍留 `inventory:approve`，应统一 `transfer:approve` |
| B2-REPORT-WIRING | `4aff1439` | ⛔ F1 | 18 条静态接线通过；未更新人读 RBAC 台账，未交付任务书要求的 401/403/200 运行时抽样 |

## 二、凌舟亲跑

| 检查 | PLATFORM-ROLES | S3-249 | B2-REPORT-WIRING |
|:--|:--:|:--:|:--:|
| guard-rbac --strict | 0 | 0 | 0 |
| guard-migration-manifest | 0 | 0 | 0 |
| tsc | 0 | 0 | 0 |
| RBAC/迁移测试 | 15 passed | 18 文件 / 2363 passed | 19 文件 / 2404 passed |
| 真库两遍 | 209 通过 | 210 通过 | 不适用 |
| sentinel | 209 不改已有矩阵 | `["__sentinel__","transfer:*"]` | 不适用 |
| 工作树 | clean | clean | clean |

三树 `backend/` 外还分别含迁移/证据/测试改动；均未见无关业务改动。

## 三、四项裁定

1. **MySQL 8.0.28**：不接受 8.0.46 作为一般替代。官方 8.0.28 归档可下载，已启动补装；F1 最终真库证据必须用 8.0.28，8.0.46 只作兼容旁证。
2. **S3-249 v2 审批**：不认可继续留 `inventory:approve`。生产在册的 `STORE_MANAGER` 与 `WAREHOUSE_STAFF` 在 210 后都持 `transfer:*`，改为 `transfer:approve` 不会造成这两类现役角色回归；S3-249F1 统一。
3. **CSV 导入 2 条**：允许本轮暂留 `store:transfer` 以控制批次范围，但必须另立 S3-252；目标码为 customers ⇒ `customer:create`、products ⇒ `goods:create`，均取既有码。
4. **B2 `report:permission:edit` 一码覆盖 4 条**：认可。207 只立此一个权限码，禁止为四动作临时自造细分码；将“报表权限写操作细分”登记为后续权限目录治理，不在本批扩码。

## 四、范围外动作确认

- 阿坚把独立 clone `dsh/PLATFORM-ROLES` push 到本地主仓 `origin`，目的仅是让主仓可解析对象；不是网络远端 push。确认接受。
- 三卡 manifest 均只在各自树内重跑，合并态必须由集成方再次重跑生成器；不得任取一侧。
- 209 与 210 必须同批合并；单合 210 会留下编号缺口，单合 209 则没有调拨授权配套。

## 五、下一步

按 `PLATFORM-ROLES-F1 → S3-249-F1 → B2-REPORT-WIRING-F1` 返工；三单全绿后再做一次固定序集成、manifest 重生成和合并态复跑。S3-252 另排，不与 B2 同时改同一份人读台账。
