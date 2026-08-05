# 任务卡：ache_r78_02（阿澈）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R78-02（移动端部分）

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R78-02 移动端部分 — 小程序上架配置（AUDIT R18/R2/R41）**。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R78 轮次）、`docs/memories/阿澈-记忆.md`、`docs/reports/R77-04-小程序核对.md`。
2. **问题（已核实）**：
   - `app-mobile/src/manifest.json:99` 小程序 `urlCheck: false`（生产必须 true，否则审核被拒，R18）
   - `app-mobile/src/manifest.json:55,97` 与 `miniapp/project.config.json:2` 的 appid 为占位符（R2/R41，上架阻塞）
3. **修复方向（最小改动铁律）**：
   - urlCheck 改为多环境：dev 环境 false / 生产构建 true（用 uni-app 环境变量或条件编译区分）
   - appid 占位：**不改成假值**；在任务文件中记录为「上架阻塞项，需用户提供真实 appid」，如可行加注释说明
   - **不碰无关代码、不编造 appid**
4. **验收标准**：
   - urlCheck 环境化实现可验证（dev=false、prod=true 分支存在）
   - appid 阻塞项已记录
   - `npm run build:h5` + `npm run build:app` exit 0
5. **完成后**：更新 current-tasks.md、记忆文件、归档任务卡、git commit 后由凌舟统一收口。
