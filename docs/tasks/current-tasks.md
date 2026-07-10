# 当前任务 — R22

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-12  
> **硬性标准：覆盖率阈值 100%，测试不允许跳过，只有修复一条路。**

---

## R22 任务列表

### R22-A1 — 修复 auto-routes.test.ts 失败用例 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿坚
- **预计**：0.5 天
- **问题**：`auto-routes.test.ts:145` — "router 为 undefined 的配置项应被跳过" 断言 `/api/test-router-valid` 未注册
- **验收**：`npx vitest run src/__tests__/shared/auto-routes.test.ts` → 0 失败

### R22-A2 — 77 个 it.skip 测试全部修复 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿坚 + 苏然
- **预计**：3 天

### R22-A3 — admin-web 客户详情页 + 编辑/禁用 UI [P0]

- **状态**：✅ 已完成
- **优先级**：P0
- **负责人**：墨
- **预计**：2 天
- **完成时间**：2026-07-12
- **完成内容**：
  1. ✅ 客户详情页 — 显示完整客户信息（基本信息+地址+结算方式+积分+等级）
  2. ✅ 详情页内子数据 Tab — 采购统计、销售单列表、付款记录、对账单
  3. ✅ 客户编辑功能 — 编辑弹窗（调用 PUT /admin/members/:id）
  4. ✅ 客户禁用/启用 — 列表页和详情页加禁用/启用按钮（调用 PUT /admin/members/:id/disable）
  5. ✅ 会员卡信息展示 — 调用 GET /admin/members/:id/member-card
  6. ✅ 会员等级调整 UI — 调用 PUT /admin/members/:id/member-level
- **验收结果**：
  - ✅ vue-tsc --noEmit 0 错误
  - ✅ npm run build 成功，所有 chunk ≤500KB
- **修改文件**：
  - `admin-web/src/api.ts` — 新增 8 个 API 函数
  - `admin-web/src/views/CustomerDetail.vue` — 新建客户详情页
  - `admin-web/src/views/CustomersView.vue` — 添加详情、禁用/启用按钮
  - `admin-web/src/router/index.ts` — 添加客户详情路由
  - `admin-web/src/utils/format.ts` — 新增 formatMoney 函数

### R22-A4 — app-mobile 客户 API 路径修复 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿澈
- **预计**：0.5 天

### R22-A5 — R22 全量回归测试 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：苏然
- **前置条件**：R22-A1~A4 全部完成

---

## R21 任务列表（已完成）

### R21-A8 — admin-web chunk 优化

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：墨
- **预计**：1 天
- **完成时间**：2026-07-11
- **截止时间**：2026-07-13
- **问题**：admin-web 构建存在 chunk 过大警告（部分超过 500KB）
- **修复**：配置 `build.rollupOptions.output.manualChunks` 进行代码分割

**优化措施：**
1. echarts 按需导入：创建 `src/utils/echarts.ts` 封装模块，只导入项目使用的 6 种图表（bar/line/pie/scatter/funnel/heatmap）和组件，echarts chunk 从 1128KB 降至 468KB
2. echarts/zrender 拆分：zrender 单独拆分为 180KB chunk，echarts core+charts+components 合并为 468KB（避免循环依赖）
3. element-plus 按需导入：使用 `unplugin-vue-components` + `unplugin-auto-import` + `ElementPlusResolver`，移除 main.ts 全量注册，element-plus 从 957KB 大 chunk 消除，分散到各页面
4. wangeditor 替换为 tiptap：wangeditor ESM 是 809KB 自包含打包无法拆分，替换为 tiptap（@tiptap/vue-3 + @tiptap/starter-kit），体积约 85KB，分散到页面 chunk

**验收结果：**
- ✅ 所有 chunk ≤500KB（最大 chunk：echarts 468.66 KB）
- ✅ 构建无警告（无 "Some chunks are larger than" 警告，无 Circular chunk 警告）
- ✅ `vue-tsc --noEmit` 0 错误
- ✅ ESLint 0 错误

**修改文件清单：**
1. `admin-web/vite.config.ts` — 添加 AutoImport/Components 插件，配置 manualChunks
2. `admin-web/src/utils/echarts.ts` — 新建，echarts 按需导入封装
3. `admin-web/src/main.ts` — 移除 element-plus 全量注册
4. `admin-web/src/views/Products.vue` — wangeditor 替换为 tiptap
5. `admin-web/src/views/InstantRetailReport.vue` — EChartsOption → EChartsCoreOption
6. `admin-web/src/wangeditor.d.ts` — 已删除
7. 20 个 echarts 使用文件 — 导入改为 `@/utils/echarts`
8. `admin-web/package.json` — 添加 tiptap 依赖，添加 unplugin 插件

---

## R18-R20 任务列表（已完成）

（保留历史记录，详见原文件）

---

## 强制闭环流程

1. **读取任务** — ✅ 已完成
2. **执行** — ✅ 已完成
3. **验证** — ✅ vue-tsc + build
4. **总结** — ✅ 已更新
5. **提交** — ✅ 已完成
6. **更新踩坑日志** — ✅ 已完成
7. **推送** — ✅ 已完成