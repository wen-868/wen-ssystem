# ACTIVE-S3-233-F1 · S3-233 **返工单**（CodeQL 新 high：上传路由缺限流）

> 派单人：凌舟｜日期：2026-10-16｜执行方：**`/root/s3240_ajian`**（S3-233 原执行方）
> ⚠️ 你不是凌舟；不得写「凌舟裁定/验收结论」；只动自己的工作树与分支；**不得 push、不得开 PR**。
> 工作树：`D:\Users\ZXQL\wt-agents\S3-233`｜分支：`feat/s3-233-bclass-wiring-batch1`
> ⚠️ 开始前先 `git fetch origin`，确认分支 HEAD = **`b66e59a5`**（凌舟的合并收口提交）且工作树干净；若在别的提交上，先说明再动手。

## 一、要修的（唯一一件事）

凌舟已把这个分支推上 origin 并开了 **PR #359**。CI 结果：`e2e` / `migration-check` / `CodeQL Analyze` 全绿，但**默认 CodeQL 检查判红：1 条 new high**，注解原文：

```
backend/src/routes/admin-product.routes.ts:34
Missing rate limiting — This route handler performs a file system access, but is not rate-limited.
```

该行是本批给它挂了 `requirePermission("goods:create")` 的 `POST /products/upload-image`（带 `multer` 上传 ⇒ 文件系统访问）。属第 57 项同族（`js/missing-rate-limiting`）。

## 二、修法（照第 57 项既有形状，不许自创）

在**注册点内联**挂限流（`backend/src/config/rate-limit.ts` 的头注释写明：CodeQL 只把"注册点上**直接出现**的 `rateLimit(...)` 调用"识别为限流证据 —— 包进 helper 就识别不到，这是硬要求不是风格偏好）：

```ts
import { AUTHED_ROUTE_LIMIT } from "../config/rate-limit";
...
adminProductRouter.post("/products/upload-image", requirePermission("goods:create"), rateLimit(AUTHED_ROUTE_LIMIT), upload.single("image"), uploadProductImage);
```

顺序：鉴权 → 限流 → multer → 控制器（与仓内既有 `rateLimit(AUTHED_ROUTE_LIMIT)` 注册点同形）。

**只改被 CodeQL 规则命中的那类行**（带 FS 访问 + 缺限流）；若同文件还有同类行，逐条列出并给判据，**不要全文件扫射**；其它路由文件本单不动。

## 三、自证（原始输出存 `docs/evidence/S3-233/raw/`，用新文件名）

1. `npx vitest run src/__tests__/config/rate-limit-options.test.ts`（若该文件存在）+ `npx vitest run src/__tests__/routes/rbac` ⇒ 全绿；
2. `npx tsc -p tsconfig.json --noEmit` ⇒ 0；
3. 说明你怎么确认这条改动**不会让**既有两侧断言（403/200）回归；
4. 结论：全仓**还有无**其它同类新命中的行（给判据与检索方式）。

## 四、红线
不得改 `.github/**`、`deploy/**`、收口总清单、`current-tasks.md`、其它单工作树；**不得 push/开 PR/`git add -A`**；证据不得含口令明文；回传卡不得出现「凌舟裁定/凌舟验收」字样。

## 五、回传
在你的分支上提交（`fix(S3-233): ...`）后，写 `docs/tasks/inbox/ACTIVE-回执-S3-233-F1.md`（改了什么 + 三条读数 + "还有无同类行"结论），并在最终回答里给：提交哈希(短) + 读数。
