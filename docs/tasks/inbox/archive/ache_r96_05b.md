# 任务卡：ache_r96_05b — R96-05 小程序一键生成并发布（续：余额恢复后重新派单）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（移动端/小程序 + 后端发布集成）
- **优先级**：P1
- **取代**：ache_r96_05（原代理因 DeepSeek 402 余额中断，代码保留未提交）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务不变（原任务卡 `docs/tasks/inbox/ache_r96_05.md` 完整要求仍然有效）

目标：小程序配置页改造成**一键生成并发布**（选模板 + 填 AppID/商城名 + 传一次 .key 密钥 → 一个按钮自动生成代码包并上传微信体验版），并记录发布状态。

## 二、当前进度（凌舟核实，从中断处继续）

**后端部分已完成（未提交，工作区 M 状态）：**
- `backend/src/services/admin/miniapp-ci.service.ts`（新增，miniprogram-ci 集成）
- `backend/src/services/admin/miniapp-upload.service.ts`（新增）
- `backend/src/services/admin/miniapp-upload.service.test.ts`（新增测试）
- `backend/src/controllers/admin/miniapp-config.controller.ts`（M，新增 publish/upload-key 等）
- `backend/src/routes/miniapp-config.routes.ts`（M）
- `backend/src/services/admin/miniapp-config.service.ts`（M）
- `backend/src/services/admin/miniapp-publish.service.ts`（M，重构）
- `backend/src/config/env.ts`（M）、`backend/package.json`（M，含 miniprogram-ci 依赖）、根 `package-lock.json`（M）

**前端部分未开始**：`admin-web/src/views/system/MiniappConfigView.vue` 仍是 R96-02 的多步流程，需改造成单页一键流程。

## 三、剩余任务

1. **核查后端已写代码**：读 miniapp-ci.service.ts / miniapp-upload.service.ts / controller / routes，确认逻辑完整可用（miniprogram-ci 上传、密钥管理、publish_log 落库），修正明显问题；`npm run build` + typecheck 通过
2. **前端极简改造**（MiniappConfigView.vue）：单页三要素（模板选择卡片 / AppID+商城名称 / .key 上传，已配置显示"已配置"）+ 主按钮「🚀 一键生成并发布」（进度：生成→上传→完成）+ 结果展示（体验版已上传 + 微信公众平台提交审核链接）+ 发布历史；「仅生成包」降级为次要入口；已存配置自动预填
3. **验证**：后端 build/typecheck + 单测；前端 build；接口链路到生成包 + CI 调用参数正确（真实上传待用户密钥）
4. **提交推送** origin/main（中文提交信息；含上述全部未提交的后端改动）

## 四、注意事项

- 全程简体中文；最小改动；禁止改动 app-mobile/、miniapp/ 模板构建核心
- 微信限制如实提示：上传体验版可自动，审核/上线是微信强制流程
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R96-05、复述关键内容、给完成结果与验证证据
