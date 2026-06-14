# 智享酒业进销存系统 UI Style Guide v2.0

## 设计原则

- 白色主导：页面主背景使用 `#FFFFFF`，让业务数据、表格和操作区保持清爽。
- 浅灰分层：用 `#F5F7FA`、`#E5E7EB` 区分页面、卡片、边框和弱提示。
- 蓝色行动点：`#1677FF` 只用于品牌识别、主按钮、焦点边框和少量装饰条。
- 语义色收敛：成功、警告、危险只用于状态表达，不做大面积背景。

## 设计 Token

| 类别 | Token | 色值 | 用途 |
| --- | --- | --- | --- |
| 主色 | `--color-primary` | `#1677FF` | 主按钮、品牌标识、焦点边框 |
| 主色 Hover | `--color-primary-hover` | `#409EFF` | 主按钮 hover |
| 主色 Active | `--color-primary-active` | `#0958D9` | 主按钮按下 |
| 主色浅底 | `--color-primary-soft` | `#E6F4FF` | 激活导航、Ghost hover |
| 主文本 | `--text-primary` | `#1F2328` | 标题、正文、金额 |
| 次文本 | `--text-secondary` | `#4B5563` | Label、辅助说明 |
| 弱文本 | `--text-muted` | `#9CA3AF` | 时间、占位、弱提示 |
| 反白文本 | `--text-inverse` | `#FFFFFF` | 主按钮文字 |
| 页面背景 | `--bg-page` | `#FFFFFF` | 页面主背景 |
| 卡片背景 | `--bg-card` | `#FFFFFF` | 卡片、弹窗 |
| 浅灰背景 | `--bg-soft` | `#F5F7FA` | 分组、底栏、标签 |
| 标准边框 | `--border-normal` | `#E5E7EB` | 卡片、表格、输入框 |
| 焦点边框 | `--border-focus` | `#1677FF` | 输入框焦点、激活态 |
| 成功 | `--color-success` | `#10B981` | 已付款、已完成 |
| 警告 | `--color-warning` | `#F59E0B` | 待处理、临期、低库存 |
| 危险 | `--color-danger` | `#EF4444` | 删除、失败、负库存 |

## 使用规则

### 按钮

- 主按钮：蓝底白字，使用 `#1677FF` + `#FFFFFF`。
- 次按钮：白底灰边，使用 `#FFFFFF` + `#E5E7EB`。
- Ghost：浅蓝底蓝字，使用 `#E6F4FF` + `#1677FF`。
- 禁止使用黑色、深灰或红金色作为主按钮填充。

### 文本

- 标题、正文和金额统一使用灰阶，优先 `#1F2328`。
- `#1677FF` 不用于大段正文、标题或金额数字。
- 辅助说明使用 `#4B5563`，弱提示使用 `#9CA3AF`。

### 状态

- 成功：`#10B981`
- 警告：`#F59E0B`
- 危险：`#EF4444`
- 状态色只用于标签、提示、边线或小面积状态文字，不用于大面积渐变。

## 跨端落地

- 管理后台：`admin-web/src/styles/tokens.css`
- 门店端：`store-terminal/src/styles/tokens.css`
- 小程序：`miniapp/styles/tokens.wxss`
- UI 契约测试：`scripts/ui-contract-test.mjs`

## 公测前验收口径

- 三端不再保留旧红金主视觉。
- 主按钮、激活导航、焦点边框统一为 `#1677FF`。
- 页面和卡片保持白色与浅灰分层。
- 订单、库存、收款等既有业务流程不因样式切换受影响。
