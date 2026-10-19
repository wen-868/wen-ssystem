# QODER-10 · 移动端收尾三件（dismissBanner / note 过期 / 4 条陈旧登记）

> 派单人：凌舟｜端：**移动端 → Qoder**｜基线：`origin/main` 的 **#368 分支尖端**（`fix/qoder-9-b31-backend-and-parity`）
> ⚠️ 不得 push / 开 PR / `git add -A`；不得写「凌舟裁定/验收结论」。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-10`｜分支 `chore/qoder-10-mobile-closeout2`

## 一、三件（都很小，逐件给原始输出）

### ① `dismissBanner` 接到 ×（QODER-8 实测缺口）
- `permission-view-state` 的③态提示横幅目前**只有「重试」**，`dismissBanner()` 未接 × 按钮；
- 要求：× 可关闭，**仅本次会话记住**（不写持久存储）；③态再次出现时提示重现。

### ② `permission-gates.ts:585-599` 的 `island-aftersale` note 过期
- 现值仍写"后端 4 条未接、由 S3-250 承接"——**已不成立**（QODER-9 已接 `sale:return`）；
- 改成："4 条已接 `sale:return`（`aftersale.routes.ts:49/51/69/74`）；本门为 **gated**"。

### ③ 4 条"基线陈旧"具名登记与清理
- `guard-rbac-wiring --strict` 报 `293 = 现场 289 + 4 条基线既有陈旧`；
- 要求：**逐条列出这 4 条**（文件 + 端点），判定"已接线可删 / 仍缺需保留"，删掉的同步 `_counts`（和式守恒），保留的写理由；
- 输出必须打印"清理前 293 / 清理后 N / 未登记 0 / 陈旧 0"。

## 二、判据

1. ①：装置输出"③态 ⇒ 横幅出现 ⇒ 点 × ⇒ 消失 ⇒ 再次③态 ⇒ 重现"四步原始输出；
2. ②：`rg -n "S3-250|未接" app-mobile/src/config/permission-gates.ts` **0 命中**（MSYS 排除态）；
3. ③：清理前后计数原样；`guard --strict` **EXIT=0 且陈旧=0**；
4. 回归：`npm --workspace app-mobile run test` 不劣化、`type-check` 0=0、`backend/` 零改动（`merge-base..HEAD`）。

## 三、回传

`docs/tasks/cards/R101-QODER-10-回传.md`（十项）+ 回执。
