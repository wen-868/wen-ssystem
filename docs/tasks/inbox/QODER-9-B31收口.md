# QODER-9 · B3-1 收口：后端 4 条接线 + parity 契约同步（解 #367 死结）

> 派单人：凌舟｜端：**移动端 → Qoder**｜⚠️ 不得 push/开 PR/`git add -A`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-9`｜分支 `fix/qoder-9-b31-backend-and-parity`｜基线：`origin/main` 的 **#367 分支尖端**（`fix/qoder-7-drift-and-orphans`，含 QODER-1~8）

## 一、背景（凌舟裁定，别再拆栈）

`#367` 红在 `rbac-b2-s3-233-gate-wiring-parity`：B3-1 把 `island-aftersale` 提成 **gated**，而 parity 要求 **gated ⇒ 后端已接线**，那 4 条后端没接。拆栈已证实不可行（后 4 卡长在 QODER-2 改过的注册表上）⇒ **改"补后端"**。

## 二、两件事

### ① 后端接 4 条（**零新码**）
`backend/src/routes/aftersale.routes.ts` 的
`POST /aftersales/:id/approve` / `reject` / `inspect` / `complete`
⇒ 各挂 `requirePermission("sale:return")`（与本文件 `confirm-receipt:64` 同码；不能新造码）。

### ② parity 契约同步（**契约反转，非放宽**）
`backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts`：
- 期望 `gated 26 → 27`、`registered 11 → 10`、registered 端点行 `43 → 39`（4 行移入 gated）；
- `island-aftersale` 的 4 条进入"已接表"（**用真实 `requirePermission` 行做形状断言**，不是硬编码白名单）。

## 三、判据

1. `parity` **120 例全过**；`npx vitest run src/__tests__/routes/rbac` 0 failed；
2. **反测**：摘掉 `approve` 的 `requirePermission` ⇒ parity **必红并点名**；复原 SHA256 一致；
3. `guard-rbac-wiring --strict` EXIT=0；`tsc` 0；`npm --workspace app-mobile run test` 5/53 不劣化；`type-check` 0=0；
4. `git diff <merge-base>..HEAD --stat` 只含：`aftersale.routes.ts`、`parity.test.ts`、证据/回传卡。

## 四、回传

`docs/tasks/cards/R101-QODER-9-回传.md`（十项）+ 回执；并给"4 条 × 码 × 行号"对照表，供 S3-250 销项引用。
