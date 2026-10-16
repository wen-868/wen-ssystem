# ACTIVE-回执 · S3-231（收尾批：F1 / F2 / F3 / F4）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**
> 对应派单：**S3-231**｜工作树：`D:\Users\ZXQL\wt-agents\S3-231`｜分支 `chore/s3-231-followups`
> 基线：`origin/main` = **`b5250d69`**（开工日 fetch 后真值，含 S3-230 #356 的 `3b94f432`）
> 完整回传（十项）见 `docs/tasks/cards/R101-S3-231-阿坚-回传.md`
> 本单**未 push / 未开 PR / 未动 main / 未动他单工作树**。

## 改了什么（3 笔本地提交）

| 提交 | 内容 |
|:--|:--|
| `e8d32578` | **F1** 会员等级配置 4 条改挂 `customer:level`（`points.routes.ts`）+ 新增 34 条用例 + 三处既有用例状态变更同步 + 台账同步（gaps 378 → 374） |
| `b8aaffe1` | **F4** 7 条查询型 POST 逐条裁定（`READ_ONLY_POSTS` 新增 3 条）+ **F2** 平台侧 2 条只登记（平台台账 §六 + 缺口清单 §18.4）（gaps 374 → 371） |
| `20805ff3` | **F3** 移动端入口门改失败关闭（`permission-gates.ts` + `usePermissionGate.ts` 注释）+ 关闭清单/影响面 + S3-230 自查脚本口径改判 |

**业务代码改动面（自证）**：`backend/src/routes` 仅 `points.routes.ts`；
`middleware` / `services` / `controllers` **零改动**；`app-mobile/src` 仅入口门 2 文件；
**未动** `stores/menu.ts`、`.github/**`、`deploy/**`、迁移、角色种子。

## 证据（原始输出，均可复跑）

| 项 | 结果 | 原始输出 |
|:--|:--|:--|
| `guard-rbac-wiring --strict` 终值 | **EXIT=0**（gaps 371 / 未登记 0 / 陈旧 0；查询型登记 6） | `docs/evidence/S3-231/raw/40-guard-strict-final.txt` |
| 全量用例（backend） | **679 文件 / 9529 用例 / 0 failed** | `docs/evidence/S3-231/raw/31-full-vitest-after.txt` |
| `tsc --noEmit` / `npm run build`（backend） | 0 / **EXIT=0** | `raw/32-tsc.txt` / `raw/33-build.txt` |
| F1 用例 / S3-229 同步用例 | 34 passed / 114 passed | `F1/10-vitest-f1.txt` / `F1/11-vitest-s3229-synced.txt` |
| F1 反测（摘中段行） | `--strict` **EXIT=1** 且点名 + 用例 **5 failed**；复原 SHA256 一致 | `F1/26-neg-strict.txt` / `F1/27-neg-vitest-red.txt` / `F1/24,28-hash-*` |
| F3 关闭清单 / 验收+反测 | 26 gated / 11 registered；EXIT=0 | `F3/20-impact-closed-entries.md` / `F3/40-f3-verify.txt` |
| F3 `vue-tsc` / `build:h5` | **0 新增**（12 条为既有 crypto.ts）/ **EXIT=0** | `F3/30-vue-tsc.txt` / `F3/31-build-h5.txt` |
| F4 反测（删台账「查询型」行） | 登记被拒 + **EXIT=1** 且点名；复核含本单另两行；台账 SHA256 一致 | `F4/26-neg-ledger-strict.txt` / `F4/24,28-ledger-hash-*` |
| 台账同步脚本 | 移除 7 条（378 → 371）；`_counts` 自洽 | `raw/13-baseline-sync.txt` |

## 阻塞点

**无**。四项均按卡完成，不依赖凌舟先决条件；部署红阻断（跨仓 P0）与本单无关（未 push/未开 PR）。

## 需凌舟处置的 4 项（详见回传卡 §九）

1. **F2 的平台侧单**：`tenant:manage` 在 `PLATFORM_PERMISSIONS` 已有、`PERMISSION_CATALOG` 缺
   ⇒ 接线必须两处同改（否则"接了但授不了权"）；是否与 `/api/platform/applications/*` 双前缀一并收编；
2. **F3 引出两套 null 语义**（入口门失败关闭 vs `stores/menu.ts` 放全量）——本单按卡不动 menu.ts，建议评估另立统一单；
3. **S3-226 用例的 W 4 只显式 2 行**（该用例自身口径不自洽）——本单只登记 + 加长度断言（14 → 10），是否补登由凌舟定；
4. **F4 未裁定的其余候选**（`附.5-1`）——本单 7 条已全裁，其余已在台账登记为写。

## 路由表处置请求

本单已交付，请凌舟把 `ACTIVE.md` 的 **S3-231 在办行**移入已完成表（同批的 S3-232/s3236 仍在办，**未动其行**）。
