# 任务卡：ache_r76_04（阿澈）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R76-04

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R76-04 — app-mobile 3 处「敬请期待」子功能补齐**，归属移动端职责。

1. **必读文件（开工前必须逐一阅读）**：
   - `docs/项目规则.md`（重点：2.1 任务分配与责任到人、2.2 工作纪律、五道防线）
   - `docs/tasks/current-tasks.md`（R76 轮次 + 顶部必读清单）
   - `docs/memories/阿澈-记忆.md`（恢复上下文）
   - `docs/项目统一标准.md`（前端规范第六章）
2. **问题**：3 处按钮点击仅提示「敬请期待，即将上线」（派单前核实 `rg "敬请期待" app-mobile/src` → 3 处）：
   - `app-mobile/src/pages-sub/admin/admin/admin.vue:119`
   - `app-mobile/src/pages-sub/finance/reports/sales-reports.vue:170`
   - `app-mobile/src/pages-sub/marketing/marketing/marketing.vue:135`
3. **修复方向**：逐个补齐子功能或跳转真实页面（先确认后端/页面是否存在对应能力）；无法实现的按项目标准提示「开发中」（**不编造数据**）；**最小改动，不碰无关代码**。
4. **验收标准**：
   - `rg "敬请期待" app-mobile/src` → 0
   - `npm run build:h5` + `npm run build:app` exit 0
5. **完成后**：
   - 在 `docs/tasks/current-tasks.md` R76-04 状态标记完成并附证据
   - 更新 `docs/memories/阿澈-记忆.md`
   - 将本任务卡移动到 `docs/tasks/inbox/archive/`
   - git commit（信息用中文，格式 `type: 中文描述`）后由凌舟统一收口推送
