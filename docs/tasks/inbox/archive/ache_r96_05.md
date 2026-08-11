# 任务卡：ache_r96_05 — R96-05 [P1] 小程序一键生成并发布（极简流程改造）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（移动端/小程序 + 后端发布集成）
- **优先级**：P1
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务背景（用户需求）

用户反馈：现有小程序配置流程「配置 → 选模板 → 生成代码包 → 手工导入微信开发者工具」对非技术店主太复杂，"很多人根本不会操作"，要求**越简单越好**：直接一键生成并发布。

目标体验：**单页三要素 + 一个按钮**——选模板 → 填 AppID + 商城名称 → 传一次上传密钥（.key）→ 点「🚀 一键生成并发布」，系统自动完成生成代码包 + 上传微信（体验版），给出提交审核入口。已配置信息自动预填，二次发布只点按钮。

## 二、必读文件

1. `docs/tasks/current-tasks.md`：R96-00（方案）、R96-01（三套主题构建）、R96-02（现有配置页完成记录）、R96-05（本任务）小节
2. `admin-web/src/views/system/MiniappConfigView.vue`（现有配置页，需极简改造）
3. `backend/src/controllers/admin/miniapp-config.controller.ts` + `services/admin/miniapp-config.service.ts`（现有 generatePackage/downloadPackage）
4. `backend/src/routes/miniapp-config.routes.ts`（现有端点）
5. `miniapp/scripts/build-with-theme.js`、`post-build-theme.js`（模板构建与产物处理）
6. `docs/migrations/130_miniapp_template_r96.sql`（三套模板种子，theme a/b/c）

## 三、现状（凌舟已核实）

- R96-02 已完成：模板卡片选择 + AppID/名称表单 + `POST /packages` 生成 zip + 下载 + 发布指引（手工导入开发者工具）
- 后端已有 generatePackage（基于 `miniapp/template-dist/{a,b,c}` 预构建产物生成 zip，替换 project.config.json appid、app.json 标题/导航色）
- `template-dist/` 与 `backend/storage/` 不入库；服务器需先 `cd miniapp && npm run build:weapp:all` 生成三套产物
- 微信发布需：AppID + 上传密钥（.key 文件，微信公众平台生成）+ miniprogram-ci（npm 包）

## 四、任务清单

### 1. 前端极简改造（MiniappConfigView.vue）
- 单页布局，三个区块：
  - **模板选择**：3 张卡片（名称/描述/渐变主色预览），选中态清晰
  - **基础信息**：小程序 AppID（必填）+ 商城名称（必填）；已保存时自动预填，可编辑
  - **上传密钥**：.key 文件上传（一次性）；已配置时显示"已配置（重新上传可覆盖）"，不重复要求
- 主按钮「🚀 一键生成并发布」：点击后进入进度态（生成代码包 → 上传微信 → 完成），轮询或等待结果；成功显示结果（体验版已上传 + 微信公众平台提交审核链接），失败显示原因
- 发布历史列表保留（publish_logs）；「仅生成包下载」可保留为次要入口（高级选项），主流程只突出一个按钮
- 微信限制提示：上传后为体验版，微信审核为平台强制流程，系统提供「提交审核」指引，审核通过后在公众平台上线

### 2. 后端一键发布接口
- 新增 `POST /api/miniapp-config/publish`（body: 可选覆盖 appId/appName/templateId，未传读租户已存配置）：
  - 校验：配置存在、AppID 合法、模板存在、密钥已配置
  - 复用 R96-02 generatePackage 的产物生成逻辑（不重复实现）
  - 调用 **miniprogram-ci** 上传：AppID + 上传密钥（+ 私钥密码若有）+ project 路径指向产物目录，上传为体验版（版本号/备注从配置或自动生成）
  - 写 publish_log（action='publish'，result=success/failed，status=uploaded/submitted，error_msg 记录失败原因）
  - 返回 `{ publishLogId, version, status, message, 公众平台链接 }`
- 新增密钥管理：
  - `POST /api/miniapp-config/upload-key`：multipart 上传 .key（含可选私钥密码），加密存储（复用 app_secret 加密方式或独立存储），响应脱敏
  - `GET /api/miniapp-config/key-status`：返回是否已配置/配置时间
- 后端 package.json 增加 `miniprogram-ci` 依赖
- 上传密钥文件存 `backend/storage/miniapp-keys/`（不入库，.gitignore）

### 3. 服务器部署注意（写进任务说明/文档）
- 服务器需 `npm install`（含 miniprogram-ci）
- 服务器首次需 `cd miniapp && npm run build:weapp:all` 生成三套 template-dist
- 迁移 130 需已执行（三套模板种子）

### 4. 验证
- 后端 `npm run build` + typecheck 通过；单测补充（publish 校验逻辑/日志落库）
- 接口层验证到「生成代码包 + miniprogram-ci 调用参数正确」（可 mock 上传或 dry-run）
- 前端 build 通过，页面三要素 + 一键按钮交互可用（本地 H5/截图）
- **端到端真实上传需用户提供真实 AppID + 上传密钥**（标注为待用户密钥项，不阻塞代码交付）

### 5. 提交
- commit（中文提交信息，前端/后端拆分或一次清晰提交），推送 origin/main；push 网络波动重试即可

## 五、验收标准

- 配置页单页完成「选模板 + 填 AppID + 传密钥 → 一键生成并发布」
- 后端 publish 接口链路通（生成包→CI 上传→日志），密钥管理完整
- publish_log 状态完整；文档说明微信审核限制与服务器部署前置
- current-tasks.md 更新 R96-05 完成记录；任务卡归档

## 六、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- 最小改动：在 R96-02 基础上改造，不重构无关页面；**禁止改动 app-mobile/、miniapp/ 的模板构建核心逻辑**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R96-05、复述任务关键内容、给出完成结果与验证证据
- 微信侧限制如实说明：上传体验版可自动，审核/上线是微信平台强制流程，前端提示到位即可
