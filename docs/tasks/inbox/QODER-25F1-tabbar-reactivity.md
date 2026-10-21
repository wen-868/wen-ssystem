# QODER-25F1 · AI 自绘栏撞名与消息响应式返工

【派单 QODER-25F1】消除微信 tabBar 组件撞名，并修复 AI 流式消息当场不更新
派单人：凌舟（总负责人）｜2026-10-22
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-25F1`）
优先级 / 时间盒：P1 · 一天
基线：QODER-25 尖端 `286d071b`

## 回传格式（照抄填满）

```
【汇报 QODER-25F1】QODER-25F1 tabBar 撞名与 AI 响应式返工 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号 + SHA256>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-25F1-回传.md
关联卡：docs/tasks/inbox/QODER-25F1-tabbar-reactivity.md
```

## 一、必须修复

### A. 自绘栏撞名

- `custom-tab-bar.vue` 与平台保留组件名冲突；四树 mp-weixin 构建都报 `<custom-tab-bar> 是 H5 平台专用组件` 警告。
- 将组件文件与标签统一改名为无冲突名称，如 `app-tab-bar.vue` / `<app-tab-bar>`；同步 5 个既有 tab 页和 AI 页。
- 不要求改 CSS 类名，但必须确保产物组件路径不再叫 `components/custom-tab-bar.*`，构建警告消失。
- 核实微信端 `pages.json.tabBar.custom=true` 与本项目手动挂载组件的真实关系；若微信必须另有根级 `custom-tab-bar/`，按框架正确形态落地并留产物证据。不得用“构建过”代替。

### B. AI 消息响应式

- `aiMsg` 对象 push 进 `messages.value` 后，onText/onDone/finally 继续改原始对象，DOM 不即时更新，重挂载才出现。
- 改为对象先进入 Vue 响应式代理，后续回调只修改代理；或采用等价可靠方案。
- 完整收流和停止生成都要验证当场 DOM 更新，禁止用 `location.reload()` 后的数据证明当场状态。

## 二、硬验收

- `check:gates` EXIT=0；三端构建 EXIT=0；mp-weixin 构建日志 **0 次** `<custom-tab-bar>` 撞名警告。
- `app-mobile/dist/build/mp-weixin` 不再出现 `components/custom-tab-bar.*`。
- H5 实开：完整收流时最新文本当场增长；停止生成后按钮当场消失；服务端确认剩余 SSE 未发。
- 新增响应式/静态守卫并反测：摘掉代理或注回旧组件名，目标用例必须红；复原后绿。
- `backend/` diff 0、工作树 clean。

## 三、红线

- 不得 push、开 PR、`git add -A`。
- 不得改 AI 协议、工具确认、消息持久化结构。
- 不得在 MP 用“提示不支持”替代正确 tabBar 接线；不得用隐藏所有栏冒充单层。
- 不得把重挂载后的 DOM 数量当成未重挂载响应式通过的证据。
