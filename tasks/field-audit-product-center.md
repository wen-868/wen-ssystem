# 商品中心 · 字段审计报告

**审计日期**：2026-06-28
**审计依据**：`docs/product-spec-v6-adapted.md` 第二部分·商品中心（11个二级模块，~520字段）
**审计范围**：数据库表结构、后端 API、前端页面

---

## 一、产品规格对照

| 二级模块 | 优先级 | 规格字段数 | 当前状态 |
|---------|:---:|:---:|------|
| 1. 商品档案 | P0 | ~80 | ⚠️ 缺 brand/unit/specs 列 |
| 2. SKU 与规格单位 | P0 | ~60 | ⚠️ 缺 unit 独立表 |
| 3. 分类与品牌 | P0 | ~40 | ⚠️ 缺 brand 独立表 + 分类 API |
| 4. 标签与属性管理 | P0 | ~50 | ❌ 未实施 |
| 5. 商品图片与详情 | P0 | ~30 | ⚠️ 轮播图未实现 |
| 6. 批次追溯与有效期 | P1 | ~45 | ⚠️ 表结构有，前端无 |
| 7. 套装与组合品 | P2 | ~30 | ❌ 远期 |
| 8. 价格管理 | P0 | ~50 | ✅ 已实现 |
| 9. 商品营销标签 | P0 | ~26 | ❌ 未实施 |
| 10. 商品导入导出 | P0 | ~10 | ⚠️ 仅有导出，无导入 |
| 11. 商品审核与上下架 | P2 | ~20 | ❌ 远期 |

---

## 二、DDL 与代码不一致问题（必须立即修复）

### 2.1 `product_spu` 表缺少的列

代码中 `product.service.ts` 和 `product.controller.ts` 直接读写以下字段，但 DDL 从未定义：

| 缺失列 | 类型建议 | 代码引用位置 |
|--------|---------|-------------|
| `brand` | VARCHAR(128) | `product.controller.ts:72`, `product.service.ts:127/141/160` |
| `unit` | VARCHAR(32) | `product.controller.ts:73`, `product.service.ts:128/142/160` |
| `specs` | VARCHAR(256) | `product.controller.ts:75`, `product.service.ts:130/143/160` |

> **影响**：如果运行 `init_database.sql` 建表后调用 `updateProduct` 接口，会直接报 SQL 错误。

### 2.2 `add_performance_indexes.sql` 引用了不存在的 `products` 表

```sql
ALTER TABLE products ADD INDEX ...  -- 表名应该是 product_spu
```

### 2.3 数据库表命名规范

| 实际表名 | 建议统一 |
|---------|---------|
| `product_spu` | 保持 |
| `product_sku` | 保持 |
| `product_category` | 保持 |
| `product_price` | 保持 |
| `product_price_log` | 保持 |
| ⚠️ `products`（不存在，误写） | 应改为 `product_spu` |

---

## 三、各二级模块字段审计

### 3.1 商品档案（P0，~80字段）

#### 当前 `product_spu` 表字段

| 字段 | 类型 | 状态 | 备注 |
|------|------|:---:|------|
| spu_code | VARCHAR(64) | ✅ | 商品编码 |
| name | VARCHAR(128) | ✅ | 商品名称 |
| category_id | BIGINT | ✅ | 分类关联 |
| main_image | VARCHAR(512) | ✅ | 主图 |
| image_urls | JSON | ⚠️ | 轮播图（DDL有但前端未实现上传） |
| detail | TEXT | ⚠️ | 详情（DDL有但前端未实现富文本编辑） |
| alcohol_content | DECIMAL(5,2) | ✅ | 酒精度 |
| origin | VARCHAR(128) | ✅ | 产地 |
| sale_channels | JSON | ✅ | 可售渠道 |
| status | VARCHAR(32) | ✅ | 状态 |
| ⚠️ brand | — | ❌ | DDL缺失，代码引用 |
| ⚠️ unit | — | ❌ | DDL缺失，代码引用 |
| ⚠️ specs | — | ❌ | DDL缺失，代码引用 |
| ⚠️ sort_no | — | ❌ | 排序字段缺失 |
| ⚠️ is_new | — | ❌ | 新品标记缺失 |
| ⚠️ is_recommend | — | ❌ | 推荐标记缺失 |
| ⚠️ description | — | ❌ | 商品简介缺失 |

#### 修复方案
```sql
ALTER TABLE product_spu
  ADD COLUMN brand VARCHAR(128) DEFAULT NULL COMMENT '品牌',
  ADD COLUMN unit VARCHAR(32) DEFAULT NULL COMMENT '单位',
  ADD COLUMN specs VARCHAR(256) DEFAULT NULL COMMENT '规格',
  ADD COLUMN sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  ADD COLUMN is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记',
  ADD COLUMN is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记',
  ADD COLUMN description VARCHAR(512) DEFAULT NULL COMMENT '商品简介';
```

---

### 3.2 SKU 与规格单位（P0，~60字段）

#### 当前 `product_sku` 表字段

| 字段 | 类型 | 状态 | 备注 |
|------|------|:---:|------|
| sku_code | VARCHAR(64) | ✅ | SKU编码 |
| barcode | VARCHAR(128) | ✅ | 条码 |
| sku_name | VARCHAR(128) | ✅ | SKU名称 |
| alcohol_degree | DECIMAL(5,2) | ✅ | 酒精度 |
| origin | VARCHAR(128) | ✅ | 产地 |
| base_unit | VARCHAR(16) | ✅ | 基础单位 |
| box_unit | VARCHAR(16) | ✅ | 组合单位 |
| box_ratio | INT | ✅ | 箱瓶换算 |
| temperature | VARCHAR(32) | ✅ | 温度属性 |
| trace_enabled | TINYINT | ✅ | 追溯开关 |
| warning_threshold | INT | ✅ | 预警阈值 |
| status | TINYINT | ✅ | 状态 |
| ⚠️ volume | — | ❌ | 净含量缺失（500ml/1L） |
| ⚠️ packaging | — | ❌ | 包装类型缺失（瓶装/罐装/桶装） |

#### 单位管理缺失
- 无独立 `unit` 表，单位以字符串硬编码在 `product_sku.base_unit` / `box_unit` 中
- 需要新建 `unit` 表，字段改为 unit_id 外键

---

### 3.3 分类与品牌（P0，~40字段）

#### 当前 `product_category` 表

| 字段 | 类型 | 状态 | 备注 |
|------|------|:---:|------|
| parent_id | BIGINT | ✅ | 两级树 |
| name | VARCHAR(64) | ✅ | 分类名称 |
| sort_no | INT | ✅ | 排序 |
| status | TINYINT | ✅ | 启用/停用 |
| ⚠️ icon | — | ❌ | 分类图标缺失 |
| ⚠️ code | — | ❌ | 分类编码缺失 |

#### 品牌表完全缺失
- 需要新建 `brand` 表（id, name, logo, description, sort_no, status, created_at, updated_at）
- `product_spu.brand` 字段需改为 `brand_id` 外键

---

### 3.4 标签与属性管理（P0，~50字段）

**完全未实施。** 酒水行业需要的标签体系：

| 标签类型 | 示例值 | 状态 |
|---------|--------|:---:|
| 香型 | 酱香型/浓香型/清香型/米香型 | ❌ |
| 度数段 | 低度(<38°)/中度(38°-50°)/高度(>50°) | ❌ |
| 产区 | 茅台镇/宜宾/泸州/汾阳 | ❌ |
| 适用场景 | 自饮/宴请/送礼/收藏 | ❌ |
| 年份 | 2024/2023/2020/老年份 | ❌ |

需要新建 `product_tag` 和 `product_tag_relation` 表。

---

### 3.5 商品图片与详情（P0，~30字段）

| 功能 | 状态 | 备注 |
|------|:---:|------|
| 主图上传 | ⚠️ | 接口支持 main_image 字段，前端无上传组件 |
| 轮播图 | ⚠️ | image_urls JSON 字段存在，前端无上传 |
| 详情图/富文本 | ❌ | detail TEXT 字段存在，前端无富文本编辑器 |
| 视频 | ❌ | 未规划 |

---

### 3.6 批次追溯与有效期（P1，~45字段）

仅表结构存在（`inventory_batch`），前端无页面。

---

### 3.8 价格管理（P0，~50字段）

| 表 | 状态 | 备注 |
|------|:---:|------|
| product_price | ✅ | 成本/零售/批发/小程序/门店价 |
| product_price_log | ✅ | 价格变更日志 |
| price_level | ✅ | 价格等级 |
| sku_price | ✅ | 阶梯价格 |
| customer_price_binding | ✅ | 客户价格绑定 |
| price_change_log | ✅ | 价格变更历史 |

---

### 3.9 商品营销标签（P0，~26字段）

**完全未实施。** 需要的标签：新品、爆款、热销、推荐、限时特价、清仓。

---

### 3.10 商品导入导出（P0，~10字段）

| 功能 | 状态 | 备注 |
|------|:---:|------|
| 导出 CSV | ✅ | `GET /api/admin/export/products` |
| 批量导入 | ❌ | 无导入接口和前端页面 |

---

## 四、修复优先级

### 🔴 P0 — 阻塞（必须立即修复）

| # | 问题 | 修复内容 |
|---|------|---------|
| 1 | `product_spu` 缺 brand/unit/specs/sort_no 列 | 添加 ALTER TABLE |
| 2 | `add_performance_indexes.sql` 表名错误 | `products` → `product_spu` |
| 3 | 分类 CRUD 后端 API | 新建 category 路由/控制器/服务 |
| 4 | `admin-web` Products.vue 字段适配 | 匹配后端实际返回格式 |

### 🟡 P1 — 重要（Phase 2 内完成）

| # | 问题 | 修复内容 |
|---|------|---------|
| 5 | 品牌表 + 品牌管理 CRUD | 新建 brand 表 + 路由/页面 |
| 6 | 单位表 + 单位管理 CRUD | 新建 unit 表 + 路由/页面 |
| 7 | product_spu 补 is_new/is_recommend/description | ALTER TABLE |
| 8 | product_sku 补 volume/packaging | ALTER TABLE |
| 9 | product_category 补 icon/code | ALTER TABLE |
| 10 | 商品导入功能 | 新建导入接口 + 前端页面 |
| 11 | 商品主图上传组件 | 前端上传组件 |
| 12 | 商品详情富文本编辑器 | 前端编辑器接入 |

### 🟢 P2 — 远期

| # | 问题 |
|---|------|
| 13 | 标签与属性管理体系 |
| 14 | 商品营销标签 |
| 15 | 批次追溯前端页面 |
| 16 | 商品审核工作流 |

---

## 五、审计结论

商品中心数据库表结构基本完整，但存在以下严重问题：

1. **DDL 与代码不一致**：`product_spu` 表缺少 3 个代码直接引用的字段（brand/unit/specs），运行时会报错
2. **品牌和单位无独立表**：作为字符串散落在 product_spu，无法做数据完整性约束
3. **标签体系完全缺失**：香型/度数段/产区/场景等酒水行业核心标签未实施
4. **前端字段不匹配**：admin-web Products.vue 与后端 API 返回格式不一致

**建议**：Phase 2 集中修复 P0 问题（#1-#4），P1 问题在 Phase 2 内一并完成，P2 进入下一轮。