# 移动端开单/单据页 统一设计语言（v1）

> 目标：8 个开单/单据业务页的 UI/交互 与整站精致风格一致。只改 **UI/交互**，**不碰业务逻辑/接口/数据结构**。

## 1. 视觉基调
- 底部底色：`$uni-bg-color-page`(#F5F5F7)；卡片 `$uni-bg-color`(#FFF)。
- 卡片圆角：一级 `$uni-border-radius-base`(32rpx)，二级/输入/按钮 `$uni-border-radius-xs`(16rpx)。
- 卡片阴影：`$uni-shadow-card-sm`(0 2rpx 12rpx rgba(0,0,0,0.04))；卡片间距 16rpx。
- 主色渐变：`$uni-gradient-blue`；主文字 `$uni-text-color`(#171717)；次文字 `$uni-gray-500/600`。

## 2. 字号（统一，勿再放大）
- 页面顶栏标题：**30rpx/600**（page-header 组件已定，勿改）。
- 分区/分组标题（.section-title 等）：**26rpx/600**；次级小节标题 **22rpx/500**。
- 列表项/功能标题（.li-title/.fg-label 等）：**24rpx/500**。
- 表单标签（label 类）：20–22rpx/400–500；表单值：26rpx。
- 辅助/说明文字：22rpx；错误提示：24rpx。

## 3. 卡片/分区
- 分区卡片：`padding 24rpx; margin 16rpx 24rpx; 圆角32rpx; box-shadow card-sm; 白底`。
- 卡片内分隔：`1rpx solid rgba(0,0,0,.04)`；`last-child` 无边框。
- 分区标题下留白 16rpx。

## 4. 表单控件
- 输入框/选择器：高 68rpx，`background $uni-bg-color-page`，圆角16rpx，右对齐文本（金额/值），padding 0 20rpx。
- 选择器右侧统一 `›` 箭头(`$uni-gray-300`)。
- label 上、值下（column），或左右布局，整页统一，勿混搭。

## 5. 按钮主次
- 主操作：`$uni-gradient-blue` 圆角胶囊，白字 **28rpx/600**，高 80rpx。
- 次操作（保存/分享/取消等）：白底 `2rpx solid $uni-border-color`，灰字(`$uni-gray-600`) 28rpx/500。
- 禁用态：opacity .5。

## 6. 交互态
- 卡片/列表项/按钮 `:active` 给轻微反馈（`opacity .7~.8` 或 `transform scale(.98)`）。
- 空态：图标 + 主文案(24rpx) + 次文案(22rpx)，居中。
- 校验错误：红字 `$uni-color-error` 24rpx，置于字段下方。

## 7. 页面方向
- 列表页：顶部搜索/筛选 + 卡片列表 + 分页/加载更多 + 底部安全区。
- 详情页：分组卡片（信息/明细/操作）+ 顶部返回。
- 表单页：分段选择 + 字段卡片 + 底部主/次操作栏（固定）。

## 8. 禁止
- 不放大已经统一的标题/按钮字号；不引入第二种配色/胶囊圆角；不改变业务字段名与提交逻辑。
