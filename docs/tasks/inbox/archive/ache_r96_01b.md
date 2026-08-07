# 任务卡：ache_r96_01b — R96-01 [P1] 3 套主题体系 + weapp 三模板构建（miniapp 消费端）

- **派发**：2026-08-08 凌舟（总负责人，方向纠正后的重派单）
- **负责人**：阿澈（移动端/小程序）
- **优先级**：P1，预计 2 天
- **状态**：✅ 已完成（2026-08-08 阿澈执行，待凌舟复核收口）
- **取代**：ache_r96_01（旧卡基于 app-mobile 方向，已归档；其工作已由凌舟暂存于 git stash@{0}，与本任务无关，勿恢复、勿参考执行）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`
- **目标工程（重要）**：`miniapp/` = **消费端小程序**（Taro 3.6 + Vue3 + Vant4，构建命令 `build:weapp`）；`app-mobile/` = 商户手机工作台（uni-app），**不在本任务范围，禁止改动**

## 一、任务背景

R96 目标：消费端小程序提供 **3 套不同 UI 模板**，租户填自己的 APPID 即可一键发布使用。本任务只做第一阶段：**3 套主题体系 + 编译期切换 + weapp 三模板构建验证**。R96-02（配置页）/ R96-03（后端发布）/ R96-04（端到端验收）另行派单。

## 二、必读文件

1. `docs/tasks/current-tasks.md` 中 **R96-00（主题定义）** 与 **R96-01（本任务）** 完整小节
2. `miniapp/src/styles/variables.scss`（Design Tokens v4.0，现有 tokens 权威基线）
3. `miniapp/src/styles/app.scss`（全局样式）
4. `miniapp/config/index.js`（Taro 配置，`sass.data` 全局注入是主题切换的接入点）
5. `miniapp/config/theme.js`（现有半成品模板配置，需升级为 3 套正式模板并接入构建）
6. `miniapp/src/app.config.ts`（tabBar 静态配置，需随主题联动）
7. `miniapp/package.json`（scripts：`build:weapp` / `dev:weapp` / `build:h5`）

## 三、三套主题定义（R96-00 已确认，色值以此为准）

- **模板 A「商务经典 · 深海蓝」**（默认主题）：主色 `#1e40af`，渐变 `#2563eb → #1e40af`，白底/浅灰阶背景
- **模板 B「高端酒红金 · 臻品」**：主色 `#9d1f33`，渐变 `#b91c1c → #7f1d2d`，香槟金点缀 `#c9a86a / #e2c992`，暖白底（约 `#faf7f2`）
- **模板 C「清新活力 · 青翠」**：主色 `#0e9f6e`，渐变 `#10b981 → #059669`，青柠点缀 `#84cc16`，浅绿底（约 `#f2fbf7`）

## 四、任务清单

1. 主题变量重构：新建 `themes/theme-a/b/c.scss`，变量名统一，仅值不同；保留既有变量名兼容别名
2. 编译期切换：`UNI_THEME` 环境变量（a/b/c，默认 a）经 `config/index.js` 注入；`config/theme.js` 升级接线
3. 小程序特有联动：tabBar 选中色/导航栏背景随主题（构建期写 app.json）；品牌文案随模板；核实 vant 使用情况
4. 三模板构建验证：`UNI_THEME=a/b/c npm run build:weapp` 均 exit 0，产物可区分；`build:h5` 不回归
5. 视觉走查：首页/分类/购物车/我的三主题截图对比，存 `docs/reports/R96-01-themes/`
6. 提交：commit 到 git（中文提交信息），推送 origin/main

## 五、验收标准

- 三套主题 `build:weapp` 全部 exit 0，产物主色可区分且符合 R96-00 色值
- 变量统一：theme-a/b/c 变量名完全一致，页面/组件无残留硬编码品牌色（中性灰阶可保留）
- `build:h5` 不回归
- 关键页三主题截图/证据齐备
- 完成后更新 `docs/tasks/current-tasks.md` 中 R96-01 状态，并将本任务卡移入 `docs/tasks/inbox/archive/`

## 六、完成记录（2026-08-08 阿澈，详见 current-tasks.md R96-01）

- 交付：3 套主题 SCSS（83 变量统一）+ UNI_THEME 编译期切换 + tabBar/导航栏联动 + 品牌文案注入 + 主题化 tab 图标生成 + H5 入口/运行时修复
- 验证：三主题 weapp 构建全部 exit 0（主色/标题各归其位）；H5 构建 exit 0 且页面正常渲染；type-check 0 errors；截图与视觉核验齐备
- 本任务卡已归档
