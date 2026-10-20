# QODER-10F1 · 横幅 × 的 lint 基线返工

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-10F1`
> 分支：`fix/qoder-10f1-lint-closeout`｜基线：`9fd90257`
> 红线：不得 push、不得开 PR、不得 `git add -A`；逐文件 add。

## 一、问题

PR #368 的 `build-and-test` 失败：

- `vue/html-indent` warning：12299 → **12301**；
- 新 warning 来自：
  - `app-mobile/src/pages/functions/functions.vue`
  - `app-mobile/src/pages-sub/admin/more/more-functions.vue`

QODER-10 新增的 × 功能本身保留，不得撤销。

## 二、范围

只允许改：

- `app-mobile/src/pages/functions/functions.vue`
- `app-mobile/src/pages-sub/admin/more/more-functions.vue`
- 本单证据与回传卡

不得上调 `app-mobile/scripts/gates-baseline.json` 的 lint warning 基线。

## 三、验收

1. `npm --workspace app-mobile run lint`：EXIT=0；error=20 基线不升；warning ≤12872，`vue/html-indent` ≤12299。
2. `npm --workspace app-mobile run test`：5 文件 / 56 用例全过。
3. `npm --workspace app-mobile run type-check`：EXIT=0、0 错误。
4. 两页 `.*-banner-close` 仍存在，单击仍调用 `menuStore.dismissBanner()`；不写持久存储。
5. 反测：在任一新行注入一处额外缩进错误，lint 门必须红并点名；cp 复原后 SHA256 逐字节一致，复跑绿。
6. `git status` clean；`git diff 9fd90257..HEAD -- backend/` 为 0。

## 四、回传

`docs/tasks/cards/R101-QODER-10F1-回传.md`（十项）+ ACTIVE 回执。
回执体必须包含 `===DSH-RECEIPT-BEGIN===` / `===DSH-RECEIPT-END===`。
