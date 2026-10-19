# QODER-8 · 移动端收尾：扫描面收紧 + H5 手动验收清单

> 派单人：凌舟｜端：**移动端 → Qoder**｜⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-8`｜分支 `chore/qoder-8-mobile-closeout`｜基线：`origin/main`

## 一、两件事

### ① `check-contract-drift.mjs` 扫描面收紧（凌舟裁定）
- 现状：`rg … app-mobile` 会命中 `app-mobile/docs/**` 的审计档案 2 行历史叙述（`/platform/` 段）；
- 要求：脚本把扫描面**写死**为 `app-mobile/src/**` + `app-mobile/package.json`，**显式排除 `**/docs/**`**；
- 输出必须打印「扫描面 + 文件数 + 排除项」，证明不是靠"少扫一块"换绿灯；
- docs 若要纳入，只能**具名豁免 + 理由**，不许整目录静默排除。

### ② H5 手动验收清单（浏览器级三态 + 真机）
交付 `app-mobile/docs/H5手动验收清单-2026-10-19.md`，至少覆盖：

| # | 场景 | 期望 |
|--:|:--|:--|
| 1 | 首启无缓存（清 storage） | ①加载中：**最小可见集**，无失败提示 |
| 2 | `/admin/auth/me` 返回 `permissions: []` | ②确实无码：需码入口全不显示 |
| 3 | `/admin/auth/me` 500 / 超时 | ③未取到：最小可见集 + 可关闭提示 |
| 4 | 弱网（3G 限速）首屏 | 不出现"整端空白"、不出现阻塞式弹窗 |
| 5 | 真机 WebView（Android） | 三态行为与 H5 一致；`v-if` 显隐无闪回 |
| 6 | iOS（如可得） | 同 5 |

每条给"操作步骤 + 观察点 + 判定（通过/不通过）"，**不做自动化断言**（这是浏览器级补充，不是替代逻辑装置）。

## 二、判据

1. 脚本改动后：`node app-mobile/scripts/check-contract-drift.mjs` **EXIT=0**，且输出含扫描面/文件数/排除项；
2. **反测**：把 1 条 endpoint 改回 `/platform` 段 ⇒ **EXIT=1 并点名**；复原 ⇒ EXIT=0（SHA256 一致）；
3. `npm --workspace app-mobile run test` 不劣化；`type-check` 0=0；
4. 清单文档存在且 6 个场景齐全（缺一条即未完成）。

## 三、红线

只改 `app-mobile/scripts/**`、新增该文档 + 证据/回传卡；不得改业务代码与后端；零字节证据配 `<同名>.note.txt`。

## 四、回传

`docs/tasks/cards/R101-QODER-8-回传.md`（十项）+ 回执。
