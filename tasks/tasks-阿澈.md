# 阿澈 · 客户管理模块 · 商户移动端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 客户积分明细页 | P0 | ❌ |
| 2 | 储值卡管理页 | P0 | ❌ |
| 3 | 会员卡展示页 | P0 | ❌ |
| 4 | 客户标签编辑页 | P1 | ❌ |

---

## 详细说明

### 1. 客户积分明细页
- **文件**：新建 `merchant-mobile/src/views/CustomerPointsView.vue`
- **功能**：
  - 积分余额卡片（当前积分/累计积分/等级）
  - 积分获取记录列表（时间/来源/积分/余额）
  - 积分消耗记录列表
  - 手动调整积分（管理员权限，输入积分+原因）
  - 积分规则说明（消费积分比例等）
- **API**：`fetchCustomerPoints(customerId)`、`fetchCustomerPointsRecords(customerId, type)`、`adjustCustomerPoints(customerId, payload)`
- **路由**：`/customer-points/:customerId`

### 2. 储值卡管理页
- **文件**：新建 `merchant-mobile/src/views/StoreValueCardView.vue`
- **功能**：
  - 储值卡余额展示（卡片样式：余额/卡号/状态）
  - 充值操作（输入金额+选择支付方式）
  - 消费记录列表（时间/类型/金额/余额）
  - 快速充值（固定金额按钮：100/200/500/1000）
- **API**：`fetchStoreValueCard(customerId)`、`rechargeStoreValueCard(cardNo, payload)`、`fetchStoreValueTransactions(cardNo)`
- **路由**：`/store-value-card/:customerId`

### 3. 会员卡展示页
- **文件**：新建 `merchant-mobile/src/views/MemberCardView.vue`
- **功能**：
  - 会员卡正面（等级图标/会员名/积分/有效期/二维码）
  - 会员权益列表（各等级对应折扣/生日礼包/优先配送等）
  - 积分快速查看入口
  - 储值卡快速查看入口
  - 消费记录最近3笔
- **API**：`fetchMemberCard(customerId)`、`fetchMemberBenefits()`
- **路由**：`/member-card/:customerId`

### 4. 客户标签编辑页
- **文件**：新建 `merchant-mobile/src/views/CustomerTagEditView.vue`
- **功能**：
  - 标签云展示（当前客户已打标签，可删除）
  - 可选标签列表（分组展示，点击添加/移除）
  - 客户画像简要信息（偏好品类/消费频次/平均客单价）
  - 保存标签变更
- **API**：`fetchCustomerTags(customerId)`、`fetchAllTags()`、`addCustomerTag(customerId, tagId)`、`removeCustomerTag(customerId, tagId)`
- **路由**：`/customer-tags/:customerId`