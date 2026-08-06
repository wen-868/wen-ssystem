# 任务卡：ajian_r92_01（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-07
> 任务标识：R92-01

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R92-01 — 即时零售后端契约对齐（banners/分类/shop-config）**（P0）。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R92 轮次）、`docs/memories/阿坚-记忆.md`。
2. **注意工作路径**：项目唯一工作目录是 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（旧路径 `D:\Users\Documents\TREA` 下是历史副本，勿读勿改）。
3. **问题（凌舟已验证属实，墨 R90-01 上报）**：
   - **G1 banners**：`instant-retail.controller.ts` create/updateBannerSchema 校验 camelCase（title/imageUrl/linkUrl/sortNo），但 `retail-shop.service.ts` 写入读取 snake_case 表字段（banner_title/banner_image/link_type/link_value/sort_order），schema 无 startTime/endTime → `banner_image` NOT NULL 写入失败
   - **G2 分类**：create/updateCategorySchema（name/icon/sortNo）vs service 表字段（category_name/category_icon/sort_order，缺 parentId/status）→ 新增分类插空名失败
   - **G3 shop-config**：saveShopConfig 无 storeId 直接 throw；getShopConfig 无 storeId 返回 null；管理端请求不带 storeId → 读取空/保存失败
4. **修复方向（对齐项目惯例：API camelCase、DB snake_case、service 做映射；最小改动）**：
   - banners：service 写入时映射 title→banner_title、imageUrl→banner_image、linkUrl→link_type/link_value、sortNo→sort_order，schema 补 startTime/endTime 可选字段
   - 分类：service 写入映射 name→category_name、icon→category_icon、sortNo→sort_order，schema 补 parentId/status 可选
   - shop-config：无 storeId 时回退租户默认门店（如 store 1 或租户首个门店），GET 无 storeId 返回默认门店配置，保存同理
   - 补对应测试用例
5. **验收标准**：`npm run typecheck` 0 errors；`npx vitest run` 全通过（新增 banners/分类/shop-config 写接口用例）；`rg "banner_image|category_name|sort_order" backend/src/services/instant-retail/retail-shop.service.ts` 有映射逻辑
6. **完成后**：更新 current-tasks.md R92-01 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
