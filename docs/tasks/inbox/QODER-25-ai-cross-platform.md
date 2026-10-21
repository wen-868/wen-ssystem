# QODER-25 · AI Chat 条件编译与自绘 tabBar（MO-17/18）

【派单 QODER-25】AI Chat 三端 API/中止/播报与 tabBar 行为对齐
派单人：凌舟（总负责人）｜2026-10-21
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-25`）
优先级 / 时间盒：P1 · 一天

## 回传格式（照抄填满）

```
【汇报 QODER-25】QODER-25 AI Chat 三端条件编译与 tabBar <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-25-回传.md
关联卡：docs/tasks/inbox/QODER-25-ai-cross-platform.md
```

## 一、基线与根因

- 基线：QODER-22 尖端 `bc1087ee`；分支：`fix/qoder-25-ai-cross-platform`。
- `ai-chat.vue:416` 在 `#ifndef H5` 内调用 `uni.getFileSystemManager()`，App 端无该 API。
- `ai-chat.vue:554` 无条件 `new AbortController()`；只有 H5 的 fetch 流使用 signal，App/MP 降级路径无法使用该控制器。
- `speakSystem` 只有 H5/APP-PLUS 分支；MP 语音播报失败后调用它等于静默空操作。
- `pages.json:839` 已 `tabBar.custom=true`；AI 页未实例化自绘栏，H5/APP 对原生栏隐藏口径也不一致。

## 二、交付物

1. 图片读取按端分派：H5 用现有 fetch/FileReader；小程序用 `getFileSystemManager`；App 用 `plus.io` 可读路径。禁止 App 进入小程序 API 分支。
2. 中止模型按端收口：H5 才创建/调用 `AbortController`；非 H5 若底层 `uni.request` 返回 `RequestTask`，暴露明确取消入口并真实 `abort()`。不得仅把 UI 标成停止而请求继续。
3. MP 播报失败必须给出确定行为：明确提示“小程序暂不支持系统语音播报”或采用该端真实可用能力；禁止调用无分支的空函数。
4. AI 页挂载 `custom-tab-bar`。`#ifndef MP-WEIXIN` 统一隐藏原生 tabBar，避免 H5/APP 双栏；微信端核实 `custom:true` 的实际产物与原生目录要求，结论写回证据。
5. 新增静态配对守卫/测试：禁止 App 分支引用 `getFileSystemManager`/`wx.env`，禁止非 H5 分支引用 `AbortController`，禁止 MP 调用只有 H5/APP 实现的 `speakSystem`。
6. 反测逐项摘除：App 分支注回 FS API ⇒ 红；非 H5 注回 AbortController ⇒ 红；AI 页摘 tabBar ⇒ 红。每轮复原 SHA 一致后绿。

## 三、硬验收

- `npm --workspace app-mobile run check:gates` EXIT=0。
- H5、mp-weixin、App 三构建均 EXIT=0，产物中 AI 页/自绘栏存在。
- H5 实开 AI 页：底栏只出现一层，发送、停止生成、附件读取均有运行证据。
- `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean。

## 四、红线

- 不得 push、开 PR、`git add -A` 或改后端。
- 不得用 `typeof xxx !== 'undefined'` 吞掉平台错配；条件编译必须表达真实平台边界。
- 不得把“构建通过”当三端运行通过；无设备项明确写未验。
- 不得改 AI 协议、模型参数或页面业务流；本单收口平台适配与导航。
