# 阿澈 · 系统设置模块 · 商户移动端前端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 门店信息页面 - 完善门店展示+详情 | P0 | :x: |
| 2 | 员工列表页面 - 完善员工列表+搜索 | P0 | :x: |
| 3 | 个人信息页面 - 完善个人资料+安全设置 | P0 | :x: |
| 4 | 通知页面 - 新建消息通知中心 | P1 | :x: |

---

## 详细说明

### 1. 门店信息页面 - 完善门店展示+详情
- **文件**：`merchant-mobile/src/views/AdminStoresView.vue`（改造）、`merchant-mobile/src/views/StoreDetailView.vue`（新建）
- **现有代码**：`AdminStoresView.vue`（门店列表+搜索+新增/编辑弹窗）
- **改造内容**：
  - 门店列表：展示门店名称、地址、联系电话、营业状态（营业中/已关闭/暂停中）
  - 列表项交互：左滑显示操作（查看详情、拨打电话）
  - 新增门店详情页 `StoreDetailView.vue`：
    - 展示门店完整信息：编码、名称、地址、联系电话、联系人、配送半径、营业时间、微信商户信息
    - 地图定位展示（使用腾讯地图或高德地图组件显示门店位置）
    - 一键拨打电话按钮
    - 一键导航按钮（跳转第三方地图App）
  - 列表加载：下拉刷新、上拉加载更多
  - 搜索功能：门店名称搜索
  - 状态标签：营业中(绿色)/已关闭(灰色)/暂停中(橙色)
- **API 对接**：`GET /api/admin/system/stores`（门店列表），`GET /api/admin/system/stores/:id`（门店详情）
- **路由**：`/admin/stores`（已有）、`/admin/stores/:id`（新建）

### 2. 员工列表页面 - 完善员工列表+搜索
- **文件**：`merchant-mobile/src/views/AdminStaffView.vue`（改造）、`merchant-mobile/src/views/StaffDetailView.vue`（新建）
- **现有代码**：`AdminStaffView.vue`（员工列表+搜索+新增/编辑弹窗）
- **改造内容**：
  - 员工列表：展示姓名、工号、手机号、角色、所属门店、状态（在职/离职）
  - 列表项交互：点击查看员工详情
  - 新增员工详情页 `StaffDetailView.vue`：
    - 展示员工完整信息：工号、姓名、手机号、角色、所属门店、职位、入职时间
    - 一键拨打电话按钮
    - 角色标签展示：管理员(红色)/店长(橙色)/员工(蓝色)
  - 列表加载：下拉刷新、上拉加载更多
  - 搜索功能：员工姓名/手机号搜索
  - 筛选功能：按门店筛选、按角色筛选
  - 状态标签：在职(绿色)/离职(灰色)
  - 管理员权限：仅管理员可查看员工列表（`role: 'admin'`）
- **API 对接**：`GET /api/admin/system/employees`（员工列表），`GET /api/admin/system/employees/:id`（员工详情）
- **路由**：`/admin/staff`（已有）、`/admin/staff/:id`（新建）

### 3. 个人信息页面 - 完善个人资料+安全设置
- **文件**：`merchant-mobile/src/views/ProfileView.vue`（改造）、`merchant-mobile/src/views/ProfileEditView.vue`（新建）、`merchant-mobile/src/views/ChangePasswordView.vue`（新建）
- **现有代码**：`ProfileView.vue`（个人信息展示：姓名/门店/角色/权限）
- **改造内容**：
  - 个人信息展示优化：
    - 头像展示区（默认头像+角色标签）
    - 信息卡片：姓名、手机号、角色、所属门店、门店地址
    - 功能入口列表：编辑资料、修改密码、门店信息、通知设置、关于系统、退出登录
  - 新增编辑资料页 `ProfileEditView.vue`：
    - 可编辑字段：姓名、手机号、头像（拍照/相册选择）
    - 表单校验：姓名必填、手机号格式校验
    - 保存成功后返回上一页并刷新个人信息
  - 新增修改密码页 `ChangePasswordView.vue`：
    - 旧密码输入、新密码输入、确认新密码输入
    - 密码强度校验：至少8位，包含字母和数字
    - 两次新密码一致性校验
    - 修改成功后自动退出登录，跳转登录页
  - 门店信息入口：点击跳转门店详情页
  - 通知设置入口：点击跳转通知页面
- **API 对接**：`GET /api/store/me`（获取个人信息）、`PUT /api/admin/system/employees/:id`（更新个人资料）、`POST /api/admin/system/employees/:id/reset-password`（修改密码）
- **路由**：`/profile`（已有）、`/profile/edit`（新建）、`/profile/change-password`（新建）

### 4. 通知页面 - 新建消息通知中心
- **文件**：`merchant-mobile/src/views/NotificationView.vue`（新建）、`merchant-mobile/src/views/NotificationDetailView.vue`（新建）
- **现有代码**：无独立通知页面，需全新开发
- **新建内容**：
  - 通知列表页 `NotificationView.vue`：
    - 顶部Tab切换：全部/系统/订单/支付/预警/信用/召回
    - 通知列表项：图标（类型图标）、标题、内容摘要、时间（相对时间：刚刚/X分钟前/X小时前/X天前）
    - 未读通知：左侧蓝色圆点标记
    - 已读通知：灰色背景
    - 列表项交互：点击查看详情（自动标记已读）
    - 顶部操作：全部标记已读按钮
    - 列表加载：下拉刷新、上拉加载更多
    - 空状态：无通知时显示空状态插画+提示文字
  - 通知详情页 `NotificationDetailView.vue`：
    - 通知标题、完整内容、发送时间、相关业务链接（如有）
    - 相关业务跳转：如订单通知可跳转订单详情
  - 底部导航栏：在"我的"Tab显示未读通知数量角标
  - 未读数量：通过 `GET /api/miniapp/notifications/unread-count` 获取
  - 通知类型图标映射：
    - SYSTEM：系统图标（齿轮）
    - ORDER：订单图标（订单）
    - PAYMENT：支付图标（金币）
    - ALERT：预警图标（铃铛）
    - CREDIT：信用图标（盾牌）
    - RECALL：召回图标（消息）
- **API 对接**：`GET /api/miniapp/notifications`（通知列表）、`GET /api/miniapp/notifications/unread-count`（未读数量）、`PUT /api/miniapp/notifications/:id/read`（标记已读）、`POST /api/miniapp/notifications/read-all`（全部已读）
- **路由**：`/notifications`（新建）、`/notifications/:id`（新建）