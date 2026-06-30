# 墨 · 客户管理模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 积分与等级管理页面 | P0 | ❌ |
| 2 | 储值卡管理页面 | P0 | ❌ |
| 3 | 会员体系页面（会员卡/权益/注册） | P0 | ❌ |
| 4 | 客户标签与画像页面 | P1 | ❌ |
| 5 | 客户关怀规则页面 | P1 | ❌ |
| 6 | 生命周期看板页面 | P1 | ❌ |
| 7 | 客户分群页面 | P1 | ❌ |

---

## 详细说明

### 1. 积分与等级管理页面
- **文件**：新建 `admin-web/src/views/PointsRules.vue` + `admin-web/src/views/LevelConfig.vue`
- **PointsRules.vue 功能**：
  - 积分规则列表（规则名称/获取方式/比例/每日上限/状态）
  - 新增/编辑规则弹窗（获取方式：消费/签到/生日/推荐，积分比例，每日上限）
  - 积分明细弹窗（客户/变动类型/积分/余额/来源/时间）
  - 手动调整积分（选择客户+增减积分+备注）
- **LevelConfig.vue 功能**：
  - 等级配置表（等级名称/最低积分/最高积分/折扣率/权益描述）
  - 新增/编辑等级配置弹窗
  - 升级记录表（客户/原等级/新等级/升级时间）
- **API**：`fetchPointsRules`、`createPointsRule`、`updatePointsRule`、`fetchLevelConfigs`、`createLevelConfig`、`updateLevelConfig`、`fetchCustomerPoints`、`adjustCustomerPoints`、`fetchPointsRecords`
- **路由**：`/customers/points-rules`、`/customers/level-config`

### 2. 储值卡管理页面
- **文件**：新建 `admin-web/src/views/StoreValueCards.vue`
- **功能**：
  - 储值卡列表（卡号/客户名称/余额/累计充值/累计消费/状态）
  - 状态筛选：正常/冻结/已注销
  - 开卡弹窗（选择客户+初始充值金额）
  - 充值弹窗（充值金额+支付方式）
  - 消费扣款（选择销售单关联扣款）
  - 退款弹窗（退款金额+原因）
  - 冻结/解冻操作
  - 交易明细表（交易号/类型/金额/余额/来源/时间）
- **API**：`fetchStoreValueCards`、`createStoreValueCard`、`rechargeStoreValueCard`、`consumeStoreValueCard`、`refundStoreValueCard`、`freezeStoreValueCard`、`unfreezeStoreValueCard`、`fetchStoreValueTransactions`
- **路由**：`/customers/store-value-cards`

### 3. 会员体系页面
- **文件**：新建 `admin-web/src/views/MemberSystem.vue`
- **功能**：
  - 会员卡展示区（卡面设计：等级图标/会员名/积分/有效期/二维码）
  - 会员列表增强（现有 CustomersView 基础上增加等级/积分/储值余额列）
  - 会员注册表单（姓名/手机号/初始密码/推荐人）
  - 权益配置页（各等级对应折扣率、生日礼包、优先配送等权益开关）
  - 手动调整等级（选择客户+目标等级+原因）
- **API**：`registerMember`、`fetchMemberCard`、`updateMemberLevel`、`fetchMemberBenefits`、`updateMemberBenefits`
- **路由**：`/customers/member-system`、扩展现有 `/customers` 路由

### 4. 客户标签与画像页面
- **文件**：新建 `admin-web/src/views/CustomerTags.vue` + `admin-web/src/views/CustomerProfile.vue`
- **CustomerTags.vue 功能**：
  - 标签列表（标签名/分组/类型/关联客户数/操作）
  - 新增/编辑标签弹窗
  - 为客户打标签（选择客户+多选标签）
  - 自动标签规则配置（消费金额阈值/频次/品类偏好）
- **CustomerProfile.vue 功能**：
  - 客户画像卡片（基本信息/年龄/性别/偏好品类/偏好品牌/平均客单价/累计消费次数）
  - 消费趋势图（ECharts 折线图：近12月消费金额）
  - 标签云展示（客户已打标签可视化）
  - 生命周期阶段标签
- **API**：`fetchCustomerTags`、`createCustomerTag`、`updateCustomerTag`、`deleteCustomerTag`、`addCustomerTag`、`removeCustomerTag`、`fetchCustomerProfile`
- **路由**：`/customers/tags`、`/customers/:id/profile`

### 5. 客户关怀规则页面
- **文件**：新建 `admin-web/src/views/CustomerCareRules.vue`
- **功能**：
  - 规则列表（名称/触发类型/奖励/状态/上次执行时间）
  - 规则编辑弹窗（触发类型：生日/节日/沉睡唤醒/等级升级，内容模板，奖励积分/优惠券）
  - 关怀记录表（客户/触发类型/发送内容/发送时间/状态）
  - 手动执行关怀（选择规则点击执行）
- **API**：`fetchCareRules`、`createCareRule`、`updateCareRule`、`deleteCareRule`、`executeCareRule`、`fetchCareLogs`
- **路由**：`/customers/care-rules`

### 6. 生命周期看板页面
- **文件**：新建 `admin-web/src/views/CustomerLifecycle.vue`
- **功能**：
  - 阶段漏斗图（ECharts 漏斗：潜客/新客/活跃/沉睡/流失，带数量+占比）
  - 阶段卡片（5个el-card：各阶段客户数+环比变化）
  - 转化趋势图（ECharts 折线图：近12月各阶段变化趋势）
  - 阶段明细表（客户/当前阶段/停留天数/最后消费时间/累计消费金额）
  - 日期范围筛选
- **API**：`fetchLifecycleStages`、`fetchLifecycleTrend`、`fetchLifecycleDetail`
- **路由**：`/customers/lifecycle`

### 7. 客户分群页面
- **文件**：新建 `admin-web/src/views/CustomerSegments.vue`
- **功能**：
  - 分群列表（名称/条件摘要/成员数/更新方式/更新时间）
  - 分群条件编辑弹窗（多条件组合：消费金额范围/频次范围/品类/注册时间/标签/地区）
  - 分群成员列表（客户名称/手机/等级/标签/最后消费）
  - 刷新分群按钮
  - 导出分群成员 CSV
  - 群发营销（跳转营销中心，预填分群）
- **API**：`fetchSegments`、`createSegment`、`updateSegment`、`deleteSegment`、`refreshSegment`、`fetchSegmentMembers`
- **路由**：`/customers/segments`