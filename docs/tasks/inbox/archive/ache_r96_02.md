# 任务卡：ache_r96_02 — R96-02 [P1] 租户小程序配置页（选模板 + 填 APPID + 生成代码包 + 发布指引）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（移动端/小程序 + 后端配置接口）
- **优先级**：P1，预计 2 天
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`
- **相关工程**：`admin-web/`（管理端配置页，Element Plus + Vue3）、`backend/`（Express + TS）、`miniapp/`（Taro 消费端小程序，R96-01 已完成三套主题）

## 一、任务背景

R96 目标：消费端小程序提供 3 套 UI 模板，租户填 APPID 即可一键发布。R96-01（三套主题 + UNI_THEME 编译期切换）已完成。本任务为 R96-02：**租户小程序配置页**——选模板、填 APPID、生成代码包、发布指引，为 R96-03（微信 CI 上传/发布流程打通）打基础。

## 二、必读文件

1. `docs/tasks/current-tasks.md` 中 **R96-00**（主题定义）、**R96-01**（主题实现与验证记录）、**R96-02**（本任务，含现状盘点）完整小节
2. `docs/migrations/020_migrate_v3_payment_miniapp.sql`（t_miniapp_config / t_miniapp_template / t_miniapp_publish_log 表定义与旧种子）
3. `backend/src/routes/miniapp-config.routes.ts` + `backend/src/controllers/admin/miniapp-config.controller.ts` + `backend/src/services/admin/miniapp-config.service.ts`（现有 CRUD 雏形）
4. `backend/src/services/admin/miniapp-publish.service.ts`（旧占位符发布机制，判断去留）
5. `admin-web/src/views/system/MiniappConfigView.vue`（半成品配置页）
6. `miniapp/package.json`（R96-01 新增脚本 build:weapp:a/b/c、build:h5:a、gen:tab-icons）
7. 三套主题预览截图：`docs/reports/R96-01-themes/`（A 根目录 / B theme-b/ / C theme-c/）

## 三、现状关键问题（凌舟调研结论，务必先核实）

1. **字段不匹配**：`miniapp-config.service.saveConfig` 的 SQL 使用 `enabled` 列，但 `t_miniapp_config` 表定义中**没有 enabled 列**（有 status/audit_status）——先核对表定义与所有 SQL 引用，修正为一致
2. **模板种子过时**：`t_miniapp_template` 种子为旧三套（经典蓝白/暖橙商务/深色臻品），与 R96-01 新三套（深海蓝/酒红金/青翠）不一致
3. **生成代码包缺失**：现有 publish 接口是占位（写日志即返回成功），没有真正产出代码包
4. **旧占位符机制脱节**：miniapp-publish.service 的 `__XXX__` 占位符在 miniapp/src 中无任何引用（已核实），与 R96-01 新机制（UNI_THEME 编译期 + theme.js）脱节，需决定去留（建议：退役或仅保留 config CRUD 兼容）

## 四、任务清单

### 1. 模板种子对齐
- 新增迁移 SQL（如 `docs/migrations/130_miniapp_template_r96.sql`）：`t_miniapp_template` 对齐为 R96-01 三套新主题
  - A「商务经典 · 深海蓝」：theme=a，主色 `#1e40af`、渐变 `#2563eb→#1e40af`、背景 `#f5f5f5`
  - B「高端酒红金 · 臻品」：theme=b，主色 `#9d1f33`、渐变 `#b91c1c→#7f1d2d`、香槟金 `#c9a86a`、暖白底 `#faf7f2`
  - C「清新活力 · 青翠」：theme=c，主色 `#0e9f6e`、渐变 `#10b981→#059669`、青柠 `#84cc16`、浅绿底 `#f2fbf7`
- `style_config` JSON 含 `theme`/`primaryColor`/`gradient`/`backgroundColor`/`tabBarSelectedColor` 等；`page_config` 保留结构；旧三条种子置 inactive 或删除（保留 tenant_id='DEFAULT' 全局模板语义）

### 2. 后端修正与新增
- **修正 CRUD**：`miniapp-config.service` 字段与表定义一致（enabled → status；核对 app_version/app_name 等），保存/查询 SQL 全部可用；保留 app_secret 脱敏
- **生成代码包接口**：
  - `POST /api/miniapp-config/packages`：body `{ platform, templateId, appId, appName, version? }` → 校验模板存在 + 配置存在 → 基于预构建产物生成 zip → 落库 → 返回 `{ id, fileName, downloadUrl }`
  - `GET /api/miniapp-config/packages/:id/download`：下载 zip
  - 记录落 `t_miniapp_publish_log`（action='package'、result='success/failed'、error_msg）或独立包记录表（任选，文档写清）
- **预构建产物**：
  - `miniapp/template-dist/{a,b,c}/` 三套模板构建产物（复制自 `UNI_THEME=x npm run build:weapp` 的 dist），加入 `.gitignore`
  - 提供 `npm run build:weapp:all`（或 `scripts/build-all-themes.mjs`）一次构建三套；生成包逻辑优先读缓存，缺失时返回明确错误提示先构建
  - 产物内替换点（必须正确）：`project.config.json` 的 `appid`、`app.json` 的 `navigationBarTitleText`/`navigationBarBackgroundColor`、tabBar `selectedColor`/`color`；`appName` 写入标题（微信小程序标题有长度限制，超长截断）
- **旧占位符机制**：`miniapp-publish.service` 的 renderTemplate/config.template.js 判断去留——建议退役（与源码脱节），仅保留 config CRUD 与日志查询能力；若保留需说明理由

### 3. 前端配置页完善（MiniappConfigView.vue）
- 模板卡片改为新三套：名称/描述/主色预览（预览图用 `docs/reports/R96-01-themes/` 三组截图或内联渐变色块）；选中态清晰
- 表单：AppID / AppSecret / 商城名称 / 联系人（电话/邮箱，选填） + 保存；去掉或修正 enabled 开关
- 生成代码包：按钮（loading 态）→ 成功提示 + 下载链接；失败提示原因（如"模板产物未构建，请先构建"）
- 发布指引：步骤条/弹窗（① 下载代码包 → ② 微信开发者工具导入 → ③ 校验 AppID → ④ 上传代码 → ⑤ 提交审核 → ⑥ 发布上线）
- 发布记录列表：action/version/status/时间/备注，分页
- 菜单入口：确认 admin-web 路由/菜单已有该页面（MiniappConfigView 应已注册，无则补）

### 4. 验证（必做，逐项记录）
- 后端：`npm run build` + typecheck 通过
- admin-web：build 通过
- 三套模板产物：`npm run build:weapp:all` 成功（或说明产物来源）
- 生成代码包实测：接口生成 zip → 下载 → 解压检查 `project.config.json` appid、`app.json` 标题/导航色正确（三套模板各测一次或说明抽样）
- 截图/证据：配置页三套模板选择态、生成包结果、发布指引步骤（可存 docs/reports/R96-02-*）

### 5. 提交
- commit（中文提交信息，建议按 后端/前端/迁移 拆分或一次清晰提交），推送 origin/main；push 网络波动重试即可

## 五、验收标准

- 配置页可完成「选模板 → 填 APPID/名称 → 保存 → 生成代码包（zip 可下载、appid/标题/导航色正确）→ 发布指引清晰」全流程
- 三套模板均可生成代码包；后端/前端构建通过
- current-tasks.md 更新 R96-02 完成记录；任务卡移入 `docs/tasks/inbox/archive/`

## 六、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- 最小改动：只改必要文件；**禁止改动 `app-mobile/`（商户工作台）**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R96-02、复述任务关键内容、给出完成结果与验证证据
