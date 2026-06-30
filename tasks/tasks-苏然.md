# 苏然 · 客户管理模块 · 测试与DAO层

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 积分与等级 DAO + 单元测试 | P0 | ❌ |
| 2 | 储值卡 DAO + 单元测试 | P0 | ❌ |
| 3 | 会员体系 DAO + 单元测试 | P0 | ❌ |
| 4 | 客户标签/画像 DAO + 单元测试 | P1 | ❌ |
| 5 | 客户关怀 DAO + 单元测试 | P1 | ❌ |
| 6 | 生命周期看板 DAO + 集成测试 | P1 | ❌ |
| 7 | 客户分群 DAO + 单元测试 | P1 | ❌ |

---

## 详细说明

### 1. 积分与等级 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/points.dao.ts`、`backend/src/daos/level-config.dao.ts`
- **DAO 方法**：CRUD for points_rule/points_record/customer_points/level_config/customer_level
- **测试文件**：`backend/src/__tests__/points.test.ts`、`backend/src/__tests__/level-config.test.ts`
- **测试用例**：积分规则创建/查询/更新、积分获取记录写入/余额验证、等级配置创建/查询、自动升级触发验证

### 2. 储值卡 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/store-value-card.dao.ts`
- **DAO 方法**：CRUD for store_value_card/store_value_transaction，事务操作（充值/消费/退款需原子更新余额）
- **测试文件**：`backend/src/__tests__/store-value-card.test.ts`
- **测试用例**：开卡/充值/消费/退款/冻结/解冻、余额一致性验证、事务回滚验证

### 3. 会员体系 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/member.dao.ts`
- **DAO 方法**：会员注册（含手机号唯一性校验）、会员卡信息查询（联表 customer+customer_points+customer_level+store_value_card）、等级调整
- **测试文件**：`backend/src/__tests__/member.test.ts`
- **测试用例**：注册成功/手机号重复/会员卡信息完整性/等级调整记录

### 4. 客户标签/画像 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/customer-tag.dao.ts`、`backend/src/daos/customer-profile.dao.ts`
- **DAO 方法**：CRUD for customer_tag/customer_tag_relation/customer_profile，标签关联查询，画像聚合查询
- **测试文件**：`backend/src/__tests__/customer-tag.test.ts`、`backend/src/__tests__/customer-profile.test.ts`
- **测试用例**：标签CRUD/批量打标/移除标签、画像字段聚合计算/画像更新

### 5. 客户关怀 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/customer-care.dao.ts`
- **DAO 方法**：CRUD for customer_care_rule/customer_care_log，查询待关怀客户（生日今天/节日/流失超30天）
- **测试文件**：`backend/src/__tests__/customer-care.test.ts`
- **测试用例**：规则CRUD/关怀记录写入/待关怀客户查询准确性

### 6. 生命周期看板 DAO + 集成测试
- **DAO 文件**：`backend/src/daos/customer-lifecycle.dao.ts`
- **DAO 方法**：阶段统计（按最后消费时间分段）、转化趋势（按月统计各阶段客户数）、阶段明细查询
- **测试文件**：`backend/src/__tests__/customer-lifecycle.test.ts`
- **测试用例**：阶段统计准确性/转化趋势数据完整性/分页查询

### 7. 客户分群 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/customer-segment.dao.ts`
- **DAO 方法**：CRUD for customer_segment/customer_segment_member，条件解析器（将JSON条件转为SQL WHERE），分群刷新（清空成员+重新匹配写入）
- **测试文件**：`backend/src/__tests__/customer-segment.test.ts`
- **测试用例**：分群CRUD/条件解析正确性/刷新分群成员/分群成员查询