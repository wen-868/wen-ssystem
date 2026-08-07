# 任务卡：ache_r96_01 — R96-01 [P1] 3 套主题体系 + weapp 三模板构建（miniapp 消费端）

- **派发**：2026-08-08 凌舟（总负责人，方向已纠正）
- **负责人**：阿澈（移动端/小程序）
- **优先级**：P1，预计 2 天
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`
- **目标工程（重要）**：`miniapp/` = **消费端小程序**（Taro 3.6 + Vue3 + Vant4，构建命令 `build:weapp`）；`app-mobile/` = 商户手机工作台（uni-app），**不在本任务范围，勿动**

## 一、任务背景

R96 目标：消费端小程序提供 **3 套不同 UI 模板**，租户填自己的 APPID 即可一键发布使用。本任务只做第一阶段：**3 套主题体系 + 编译期切换 + weapp 三模板构建验证**。R96-02（配置页）/ R96-03（后端发布）/ R96-04（端到端验收）另行派单。

## 二、必读文件

1. `docs/tasks/current-tasks.md` 中 **R96-00（主题定义）** 与 **R96-01（本任务）** 完整小节
2. `miniapp/src/styles/variables.scss`（Design Tokens v4.0，现有 tokens 权威基线，变量名如 `$primary-color/$bg-page/$text-primary/$radius-*` 等）
3. `miniapp/src/styles/app.scss`（全局样式，`@import './variables.scss'`，含工具类）
4. `miniapp/config/index.js`（Taro 配置，`sass.data` 全局注入 `@import "@/styles/variables.scss"` 是主题切换的接入点）
5. `miniapp/config/theme.js`（**现有半成品模板配置**：liquor-blue/warm-retail 两套，含品牌名/配色/导航栏/tabBar 等字段，目前未接线；需升级为 3 套正式模板并接入构建）
6. `miniapp/src/app.config.ts`（tabBar 静态配置，`selectedColor: '#4080ff'` 硬编码，需随主题联动）
7. `miniapp/package.json`（scripts：`build:weapp` / `dev:weapp` / `build:h5`）

## 三、三套主题定义（R96-00 已确认，色值以此为准）

- **模板 A「商务经典 · 深海蓝」**（默认主题）
  - 主色 `#1e40af`，渐变 `#2563eb → #1e40af`，白底/浅灰阶背景；批发/综合零售，稳重专业
- **模板 B「高端酒红金 · 臻品」**
  - 主色 `#9d1f33`，渐变 `#b91c1c → #7f1d2d`，香槟金点缀 `#c9a86a / #e2c992`，暖白底（约 `#faf7f2`）；酒类专卖/高端门店，轻奢文化感（参考口子窖红金案例）
- **模板 C「清新活力 · 青翠」**
  - 主色 `#0e9f6e`，渐变 `#10b981 → #059669`，青柠点缀 `#84cc16`，浅绿底（约 `#f2fbf7`）；便利店/年轻化零售，清爽活力

## 四、任务清单

1. **主题变量重构**
   - 新建 `miniapp/src/styles/themes/theme-a.scss`、`theme-b.scss`、`theme-c.scss`
   - 品牌色/渐变/语义色/背景/卡片/文字/边框/圆角/阴影等统一为**同一套变量名**（如 `$brand-primary`、`$brand-gradient`、`$brand-soft`、`$bg-page`、`$card-bg`、`$text-primary`、`$text-secondary`、`$border-color`、`$shadow-card`、`$focus-ring` 等），3 个文件仅值不同
   - 语义色（成功/警告/错误/信息）可随主题微调，但必须保证可读性与对比度
   - 先全局检索 miniapp/src 中 `$primary-color`、`$bg-*`、`$text-*` 等变量使用量：如大量引用，则保留既有变量名（如 `$primary-color`）指向主题值层，或保留兼容别名，**避免大面积改动页面文件**（最小改动原则）
2. **编译期切换**
   - 通过 `UNI_THEME` 环境变量（a/b/c，默认 a）选择主题
   - `config/index.js` 的 `sass.data` 全局注入改为按 UNI_THEME 引入对应主题（参考/升级 `config/theme.js`：让 `themeName` 从 `process.env.UNI_THEME` 读取，或等价机制）
   - `npm run build:weapp` 不带 UNI_THEME 时等价 UNI_THEME=a，行为不回归
3. **小程序特有联动**
   - tabBar 选中色 / 导航栏背景随主题联动：`app.config.ts` 为静态配置，需构建期处理（如构建后替换 dist/app.json 的 selectedColor/navigationBarBackgroundColor，或评估自定义 tabBar；**优先最小改动**）
   - 品牌文案（导航标题、关于页等）随模板可配置（复用 theme.js 的 brandName/navigationTitle 字段）
   - 若页面实际使用 vant 组件（先核实 miniapp/src 是否有 `@tarojs/components` 之外的 vant import），则需注入 `--van-*` CSS 变量联动；若未使用则跳过并说明
4. **三模板构建验证（必做，逐项记录输出）**
   - `UNI_THEME=a npm run build:weapp` → exit 0
   - `UNI_THEME=b npm run build:weapp` → exit 0
   - `UNI_THEME=c npm run build:weapp` → exit 0
   - 产物需可区分：dist 按主题子目录归档或产物内可 grep 到对应主色值
   - `npm run build:h5`（UNI_THEME=a）不回归（exit 0）
5. **视觉走查**
   - 关键页面三主题视觉对比：首页 index / 分类 category / 购物车 cart / 我的 profile
   - 方式自选（H5 build + 预览截图、weapp 产物分析等）；至少产出 3 组可对比证据，建议存 `docs/reports/R96-01-主题走查-*.png` 或等价文档，并在最终回复说明三主题实际效果是否符合定义
6. **提交**
   - 改动 commit 到 git（中文提交信息），推送 origin/main；push 失败多为网络波动，重试即可

## 五、验收标准

- 三套主题 `build:weapp` 全部 exit 0，产物主色可区分且符合 R96-00 色值
- 变量统一：theme-a/b/c 变量名完全一致，页面/组件无残留硬编码品牌色（中性灰阶可保留）
- `build:h5` 不回归
- 关键页三主题截图/证据齐备
- 完成后更新 `docs/tasks/current-tasks.md` 中 R96-01 状态，并将本任务卡移入 `docs/tasks/inbox/archive/`

## 六、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- 最小改动：只改必要文件，不重构无关页面；**不要动 `app-mobile/`（商户工作台）与 `backend/`**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R96-01、复述任务关键内容、给出完成结果与验证证据
