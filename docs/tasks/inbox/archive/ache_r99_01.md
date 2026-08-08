# 任务卡：ache_r99_01 — R99-01 设计体系落地（tokens + 主题 + 骨架 + 5 示范页）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（前端设计/开发）
- **优先级**：P1
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务背景

工作台（admin-web）152 个页面此前仅首页有设计，其余未按体系落地。用户要求达到两张参考图的高端 SaaS 精美度。本任务为 **R99 阶段 1：设计体系落地 + 5 个示范页**，为后续全页面设计打地基。

## 二、必读文件与参考

1. `docs/tasks/current-tasks.md` R99-00（设计方案）
2. `docs/design/PC端UIUX设计方案-Swiss.md`（Swiss 结构语言：品牌蓝 #3F6FEF、白底、1px 细线、左对齐、克制）
3. `admin-web/src/styles/tokens.css`（Design Tokens v4.0，需补齐间距/圆角/阴影/字号）
4. `admin-web/src/styles/styles.css` + `src/App.vue`（现有全局样式入口）
5. `admin-web/src/components/`（PageCard/DataTable/StatBar/TableSkeleton/DetailDrawer 通用组件）
6. **参考图（用户指定精美度标准，务必用 read-image 技能查看）**：
   - `D:\Huawei Share\Huawei Share\share_86a64ce95dc681ea4c99f0450b8c3878.png`（销售 B 端后台）
   - `D:\Huawei Share\Huawei Share\share_a7a0e28abc05cff2740fcb0cf325a4d3.png`（SaaS 后台）
   - read-image 技能：`node C:\Users\XIONG\.codex\plugins\cache\codex-read-image\read-image\0.2.0\scripts\read_image.js <图路径> --prompt "..."`（已配置）

## 三、设计要点（凌舟从参考图提炼，作为标准）

- **结构**：Swiss 骨架（品牌蓝、左对齐、信息清晰、无花哨装饰）
- **质感**：卡片化分组 + 柔和阴影分层；圆角 8-12px；适中留白（信息密度从"高密度"适度放宽）
- **数据**：指标卡大数字构图；图表精致（渐变/统一配色）；金额数字等宽
- **字体层级**：大标题（页头）→ 正文 → 辅助文字（灰）
- **图标**：扁平线性、统一风格（Element Plus 图标库）
- **禁止**：emoji 当图标、AI-slop 文案、玻璃拟态、花哨渐变（登录品牌区除外）

## 四、任务清单

### 1. Design Tokens 补齐（tokens.css）
- 补全：间距刻度（4/8/12/16/24/32）、圆角（4/8/12/16）、阴影（卡片/悬浮/弹窗三档柔和阴影）、字号/字重、状态标签规范
- 与参考图对齐：柔和阴影（如 `0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)` 层级）、圆角 8-12px
- 保持 Swiss 品牌蓝 #3F6FEF 与现有语义色不变

### 2. Element Plus 主题定制
- 按 tokens 全局定制：主色/圆角/表格（表头底、行 hover、斑马纹可选）/表单（输入框高度、焦点环）/卡片/弹窗/按钮（主次三级）/分页/标签
- 统一在全局样式（styles.css 或 App.vue 的 :root 覆盖 + el-* 类覆盖），一次生效 152 页

### 3. 四种页面骨架规范 + 通用组件完善
- **列表页骨架**：页头（标题+操作按钮）→ 筛选栏（卡片内）→ 表格（PageCard/DataTable）→ 分页
- **表单页骨架**：页头 → 表单卡片（分区）→ 底部操作栏
- **详情页骨架**：页头 → 描述/详情抽屉（DetailDrawer）→ 关联区块
- **看板页骨架**：指标卡行（StatBar）→ 图表区 → 明细表
- 完善通用组件：空态（插图+文案+操作）、加载态（TableSkeleton）、状态标签（统一语义色）
- 产出规范文档：`docs/design/工作台页面设计规范.md`（骨架结构 + 组件用法 + tokens 说明，供后续 R99-02/03 使用）

### 4. 五个示范页精设计（按骨架完整落地）
1. **登录页** `views/LoginView.vue`（品牌区 + 表单区，参考图精致度）
2. **首页看板** `views/Dashboard.vue`（指标卡 + 图表 + 明细，重点页）
3. **收银台** `views/pos/CashierView.vue`（高频操作页，信息密度与快捷性）
4. **商品列表** `views/product/Products.vue`（列表页骨架示范）
5. **销售开单** `views/sale/SalesOrderCreate.vue`（表单页骨架示范）

### 5. 验证
- `npm run build`（admin-web）exit 0；后端/其他工程无改动
- 本地 H5 走查 5 个示范页截图（`docs/reports/R99-01-*`），与参考图对照说明达标点
- 提交推送 origin/main（中文提交信息）

## 五、验收标准

- tokens/主题/骨架/规范文档齐备；5 个示范页视觉达到参考图精美度（截图对照）
- 全局样式一次生效，其余 147 页无明显样式回归
- admin-web 构建通过
- current-tasks.md 更新 R99-01 完成记录；任务卡归档

## 六、注意事项

- 全程简体中文；最小改动：只改 admin-web 样式/示范页，**禁止改动 backend/miniapp/app-mobile/saas-admin 业务逻辑**
- 若示范页涉及业务逻辑，只改样式不动数据流
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-01、复述关键内容、给出完成结果与验证证据
