# 任务卡：阿澈 R73-06B 移动端打磨回归验证

> 派发人：凌舟 | 日期：2026-08-03 | 系统标识：ache_r73_06b

## 任务来源

你被 spawn 时可能收不到消息正文（平台故障），请以本任务卡为准。任务已登记于 `docs/tasks/current-tasks.md` 的 R73-06 段（本卡为 R73-06B 重派）。

## 必读文件（按顺序，逐份读完）

1. `D:\Users\Documents\TREA\.trae\agents\ache.md`（你的角色定义）
2. `D:\Users\Documents\TREA\wen-ssystem\docs\memories\阿澈-记忆.md`（你的记忆）
3. `D:\Users\Documents\TREA\wen-ssystem\docs\tasks\current-tasks.md`（R73-06 段（本卡为 R73-06B 重派） + 必读清单）
4. `D:\Users\Documents\TREA\wen-ssystem\docs\项目规则.md`
5. `D:\Users\Documents\TREA\wen-ssystem\docs\项目统一标准.md`
6. `D:\Users\Documents\TREA\wen-ssystem\docs\踩坑日志.md`

## 任务内容（R73-06 移动端回归，工作目录 D:\Users\Documents\TREA\wen-ssystem，分支 main）

1. **构建验证**（必须两项都 exit 0）：
   - `cd D:\Users\Documents\TREA\wen-ssystem\app-mobile && npm run build:h5`
   - `cd D:\Users\Documents\TREA\wen-ssystem\app-mobile && npm run build:app`
2. **代码走查**（逐项确认后记录结论）：
   - 自定义 tabBar：`app-mobile/src/components/custom-tab-bar.vue` 存在；5 个 tab 页面（home/products/ai-chat/functions/profile）均正确引入 `<custom-tab-bar :current="..." />`；AI 按钮凸起（translateY 负值）+ 渐变 + 呼吸动画；pages.json tabBar `custom: true`
   - 商品页操作卡：`app-mobile/src/pages/products/products.vue` 含建议核价/批量调价/价格异常三入口；批量调价跳转 `/pages-sub/product/batch-price/batch-price`（确认该页面存在）；其余入口提示"开发中"；无编造数字
   - 底部占位：5 个 tab 页面底部占位高度含 `108rpx + env(safe-area-inset-bottom)`，内容不被 tabBar 遮挡
3. **产物抽查**：H5 构建产物 `app-mobile/dist/build/h5/assets/` 应含 `custom-tab-bar.*.js` 与含"建议核价/价格异常"关键字的页面 chunk
4. **更新任务文件**：在 `docs/tasks/current-tasks.md` R73-06 段（本卡为 R73-06B 重派）标注你负责部分的完成状态与证据
5. **提交**：git add + git commit（信息如 `feat: 移动端打磨回归验证通过`），**不要 push**（凌舟统一收口）
6. **归档**：将本任务卡移动到 `docs/tasks/inbox/archive/`

## 最终回复要求

必须包含：任务标识（R73-06）；对任务正文关键内容复述（如"构建两项 + 5 页 tabBar 走查"）；构建 exit code 证据；走查发现的问题（如有）；commit 哈希。不要编造未执行的结果。

## 验收标准

`npm run build:h5`、`npm run build:app` exit 0；5 页 tabBar 引入与操作卡走查有明确结论；任务文件状态更新；任务卡归档。

