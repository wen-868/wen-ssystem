# 墨 · Bug修复 · 管理后台前端

**日期**：2026-07-02
**状态**：待开始
**来源**：全面审查报告 + WorkBuddy 测试报告交叉核对

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 修复 admin-web TypeScript 编译错误（60个） | P1 | ❌ |
| 2 | 删除/修复 CustomerVisit 相关不存在的 API 调用（7处） | P1 | ❌ |
| 3 | 修复 @wangeditor 类型声明缺失 | P1 | ❌ |
| 4 | 修复函数参数类型不匹配（~10处） | P1 | ❌ |
| 5 | 删除 `store-terminal/.env.production`（已提交到仓库） | P2 | ❌ |

---

## 详细说明

### 1. 修复 admin-web TypeScript 编译错误
- **环境**：`cd admin-web && npx vue-tsc --noEmit`
- **当前错误数**：约 60 个
- **分类**：
  - TS2305/TS2724（~15个）：API 函数不存在
  - TS2554（~12个）：函数参数数量不匹配
  - TS2345/TS2322（~10个）：类型不匹配（string vs number/boolean）
  - TS2353（~5个）：对象字面量属性不存在
  - TS2307（~2个）：模块找不到
  - TS6133（~16个）：未使用的变量（警告级，不阻塞）
- **修复目标**：将编译错误数降到 0

### 2. 删除/修复 CustomerVisit 相关不存在的 API 调用
- **问题文件**：
  - `admin-web/src/views/CustomerVisitRecords.vue` — 引用了 6 个不存在的 API：`fetchCustomerVisits`, `createCustomerVisit`, `checkinCustomerVisit`, `checkoutCustomerVisit`, `cancelCustomerVisit`, `fetchCustomerVisitDetail`
  - `admin-web/src/views/CustomerVisitStats.vue` — 引用了 `fetchCustomerVisitStatistics`
- **修复方案**：
  - 方案 A：如果后端已有 CustomerVisit API（可能在其他函数名下），修改前端调用以匹配
  - 方案 B：如果后端确实没有，在 `api.ts` 中添加这些函数声明（即使暂时返回空数据），保持前端可编译
  - 方案 C：注释掉这些页面的路由注册，暂时不可访问

### 3. 修复 @wangeditor 类型声明缺失
- **问题文件**：`admin-web/src/views/Products.vue`
- **问题**：TS2307 — 找不到 `@wangeditor/editor-for-vue` 模块声明
- **修复方案**：在 `admin-web/src/` 下创建 `wangeditor.d.ts` 类型声明文件：
  ```ts
  declare module '@wangeditor/editor-for-vue' {
    import { DefineComponent } from 'vue'
    const Editor: DefineComponent<{}, {}, any>
    export default Editor
  }
  ```

### 4. 修复函数参数类型不匹配
- **典型问题**：传入 `string` 期望 `number`、传入 `number` 期望 `string`
- **修复**：逐一检查 vue-tsc 报错，添加类型转换 `Number()` / `String()` 或修正 API 调用参数

### 5. 删除 `store-terminal/.env.production`
- **问题**：`store-terminal/.env.production` 已被提交到仓库
- **修复**：
  ```bash
  git rm store-terminal/.env.production --cached
  echo "store-terminal/.env.production" >> .gitignore
  ```

---

## 验收标准

1. `cd admin-web && npx vue-tsc --noEmit` 编译错误数为 0
2. 所有页面可正常路由访问（无白屏）
