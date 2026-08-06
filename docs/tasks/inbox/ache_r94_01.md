# 任务卡：ache_r94_01（阿澈）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-07
> 任务标识：R94-01

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R94-01 — 移动端占位功能评估与处理（5 处）**（阶段 4 移动端工作台，P1）。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R94 轮次）、`docs/memories/阿澈-记忆.md`。
2. **注意工作路径**：项目唯一工作目录是 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（旧路径 TREA 下勿读勿改）。
3. **问题（凌舟已核实）**：5 处「功能开发中」占位：
   - `pages/ai-chat/ai-chat.vue:543` 语音转文字
   - `pages-sub/product/product/product-edit.vue:337` 分类选择、`:342` 图片上传
   - `pages-sub/product/price/price-manage.vue:177` 调价记录
   - `pages/products/products.vue:271` 操作卡入口（建议核价/批量调价/价格异常）
4. **修复方向（禁止编造数据 + 最小改动）**：
   - 逐处评估：能接真实能力（接口/uni API 已存在）的接入；依赖原生插件或后端缺失的如实保留「开发中」提示（**不编造**）
   - 每处处理结论记录在完成总结（接入 / 保留+原因）
   - 只处理占位相关，不重构页面
5. **验收标准**：
   - 每处占位有处理结论；能接的真实接入
   - `npm run build:h5` + `npm run build:app` exit 0
6. **完成后**：更新 current-tasks.md R94-01 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
