# 任务卡：ache_r94_02（阿澈）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-07
> 任务标识：R94-02

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R94-02 — 移动端硬编码色 token 化（分批）**（阶段 4 移动端工作台，P1）。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R94 轮次）、`docs/memories/阿澈-记忆.md`。
2. **注意工作路径**：项目唯一工作目录是 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（旧路径 TREA 下勿读勿改）。
3. **问题（凌舟已核实基线）**：`app-mobile/src/pages/` 与 `pages-sub/` 硬编码色共约 1613 处，未全量使用 `uni.scss` 的 token 体系（移动端品牌色/灰阶）。
4. **修复方向（最小改动铁律）**：
   - 分批替换：先 `pages/`（主包 16 页）→ 再 `pages-sub/`（子包按模块批次）
   - 硬编码色替换为 uni.scss 现有 token 变量（如 $brand-primary 或移动端定义色，先确认 uni.scss 已有的变量名，未定义的常见色可补充变量到 uni.scss 后引用）
   - ECharts/canvas 图表色：如移动端无 CHART_COLORS 机制，用与 token 等值的变量或常量
   - **只改颜色值，不碰布局/结构/逻辑/文字**；每批提交均过 `build:h5` + `build:app`
5. **验收标准**：
   - `npm run build:h5` + `npm run build:app` exit 0（每批）
   - 全量完成后 hex 残留 ≤ 原 1613 的 20%（即 ≤322，残留应为平台品牌色/业务值如平台 Logo 色）
   - `npx vue-tsc --noEmit`（如适用）0 errors
6. **完成后**：更新 current-tasks.md R94-02 状态附证据（每批记录）、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
