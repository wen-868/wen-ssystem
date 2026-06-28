# 阿澈 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 1 | 分类 API 化（替换硬编码） | P0 | 阿坚#1 | 待开始 |
| 2 | 商品详情页 ProductDetailView.vue | P0 | 阿坚#2 | 待开始 |
| 3 | AdminProductsView 增强 | P1 | 阿坚#5 | 待开始 |
| 4 | 商品搜索优化 | P1 | 无 | 待开始 |
| 5 | 路由+导航注册 | P0 | 无 | 待开始 |

---

## 1. 分类 API 化（P0）

**现状**：`merchant-mobile/src/views/ProductsView.vue` 中分类为前端硬编码：
```ts
const categories = [
  { value: 'all', label: '全部' },
  { value: 'baijiu', label: '白酒' },
  { value: 'hongjiu', label: '红酒' },
  { value: 'pijiu', label: '啤酒' },
  { value: 'other', label: '其他' }
]
```

**要求**：
- 在 `merchant-mobile/src/api.ts` 中新增 `fetchCategories` 函数，调用后端分类接口
- 修改 `ProductsView.vue` 的 `categories` 从 API 动态获取
- 分类切换时传 `categoryId` 而非硬编码字符串
- 保持"全部"作为默认选项

---

## 2. 商品详情页（P0）

**要求**：
- 新建 `merchant-mobile/src/views/ProductDetailView.vue`
- 从 `ProductsView.vue` 商品卡片点击跳转到详情页
- 展示内容：
  - 商品主图（占位或真实图片）
  - 商品名称、条码、分类
  - SKU 规格列表（规格名、箱规、单位）
  - 价格信息（零售价/批发价）
  - 库存信息（可用库存/预警阈值）
  - 温度要求、溯源码标识
- 调用后端 `GET /api/admin/products/:spuId`（或 `/api/store/products/:spuId`）
- UI 风格与现有 `ProductsView.vue` 保持一致（Vant 组件）

---

## 3. AdminProductsView 增强（P1）

**现状**：`merchant-mobile/src/views/AdminProductsView.vue` 已有基本列表+上下架+改价功能。

**要求**：
- 添加分类筛选（从 API 获取分类列表）
- 添加商品搜索（按名称/条码/SKU 编码）
- 列表项增加显示：分类名称、SKU 数量、品牌
- 添加新建商品入口（跳转到新建商品页或弹窗）
- 保持现有的 Vant 组件风格

---

## 4. 商品搜索优化（P1）

**现状**：ProductsView.vue 搜索仅支持关键词。

**要求**：
- 搜索历史记录（localStorage 存储最近 10 条）
- 热门搜索标签（可配置或从后端获取）
- 搜索建议/自动补全（可选）
- 扫码搜索保持现有微信扫码 + 浏览器摄像头两种方式

---

## 5. 路由+导航注册（P0）

**要求**：
- 在 `merchant-mobile/src/router.ts` 中注册：
  - `/products/:spuId` → `ProductDetailView.vue`
- 在 `ProductsView.vue` 商品卡片添加点击跳转
- 在 `AdminProductsView.vue` 添加商品详情跳转入口