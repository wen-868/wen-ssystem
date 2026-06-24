# 全局 AI 助手功能方案

> 负责人：阿坚（后端）+ 阿澈（前端） | 预估工时：15天 | 阶段：M3之后（增值功能）

## 一、核心定位

嵌入系统内的 AI 对话助手，通过自然语言 **读取和操作本地系统数据**，帮助商家快速查询经营数据、执行业务操作、获取系统帮助。

**关键原则：AI 只操作本地数据，不引入任何外部数据源。**

## 二、功能范围

### P1 - 核心功能（必须实现）

| 功能 | 示例 | 底层实现 |
|------|------|----------|
| 销售数据查询 | "今天卖了多少钱"、"本月销售额"、"XX客户总共买了多少" | 查询 sale_bill / sale_payment 表 |
| 库存数据查询 | "XX酒还剩多少箱"、"库存预警有哪些"、"快没货的商品" | 查询 inventory_balance 表 |
| 客户数据查询 | "张三欠我多少钱"、"最近下单的客户有哪些" | 查询 member / receivable_account 表 |
| 应收应付查询 | "本月应收总额"、"XX供应商还欠多少货款" | 查询 receivable_account / supplier_statement 表 |
| 快捷操作 | "帮我查XX的单号"、"XX客户最近一笔订单" | 查询对应表并返回详情 |
| 系统帮助 | "怎么退货"、"怎么设置折扣"、"怎么新建供应商" | 预设知识库问答 |

### P2 - 进阶功能

| 功能 | 示例 | 底层实现 |
|------|------|----------|
| 经营分析 | "最近7天卖得最好的商品"、"哪些客户该跟进" | 聚合查询 + 排序 |
| 智能补货建议 | "XX酒按最近销量建议补多少" | 基于历史销售数据计算 |
| 日报/周报生成 | "帮我总结今天的经营情况" | 聚合当天数据生成文字摘要 |
| 商品对比 | "对比XX和YY两个酒这个月的销量" | 多商品聚合对比 |

### P3 - 高级功能（后续迭代）

| 功能 | 示例 |
|------|------|
| 智能定价建议 | "这个客户历史折扣一般是多少" |
| 销售预测 | "按最近趋势，下个月XX酒预计能卖多少" |
| 异常检测 | "有没有异常的大额订单" |

## 三、技术架构

```
用户输入自然语言
      ↓
┌─────────────────────────────────┐
│  后端 AI 接口 (backend)          │
│  /api/ai/chat                   │
│                                  │
│  1. 接收用户消息 + tenantId      │
│  2. 构建 system prompt（含可用   │
│     工具列表 + 租户上下文）       │
│  3. 调用 LLM API                │
│  4. LLM 返回 function_call       │
│  5. 执行对应工具函数             │
│  6. 将结果返回 LLM 生成回答      │
│  7. 返回给前端                   │
└──────────┬──────────────────────┘
           ↓
    ┌──────┴──────┐
    │  LLM API    │  ← 国内大模型（DeepSeek/通义千问/智谱GLM）
    │  (Function  │     成本低、延迟低、中文能力强
    │   Calling)  │
    └─────────────┘
           ↓
    ┌──────┴──────┐
    │  工具函数    │  ← 封装为 JSON Schema
    │  (Tools)    │     LLM 根据意图自动选择调用
    └──────┬──────┘
           ↓
    ┌──────┴──────────────────────┐
    │  本地 MySQL 数据库            │
    │  (自动带 tenant_id 过滤)      │
    └─────────────────────────────┘
```

## 四、LLM 选型建议

| 模型 | API 地址 | 价格 | 推荐理由 |
|------|---------|------|----------|
| **DeepSeek-V3** | api.deepseek.com | 约 1元/百万token | 性价比最高，中文能力强，支持 Function Calling |
| 通义千问 | dashscope.aliyuncs.com | 约 4元/百万token | 阿里云生态，稳定性好 |
| 智谱 GLM-4 | open.bigmodel.cn | 约 5元/百万token | Function Calling 支持好 |

**建议选 DeepSeek-V3**，成本最低，每月预算约 50-100 元即可支撑中小规模使用。

## 五、工具函数定义（Function Calling）

LLM 可调用的工具函数，每个函数对应一个本地数据库查询：

```typescript
// 1. 查询销售额
{
  name: 'query_sales',
  description: '查询销售额数据，支持按日期范围、客户、商品筛选',
  parameters: {
    date_from: '起始日期（可选）',
    date_to: '结束日期（可选）',
    customer_name: '客户名称（可选）',
    product_name: '商品名称（可选）',
    group_by: '分组方式：day/week/month/customer/product（可选）'
  }
}

// 2. 查询库存
{
  name: 'query_inventory',
  description: '查询商品库存，支持按商品名称、分类筛选',
  parameters: {
    product_name: '商品名称（可选）',
    category: '商品分类（可选）',
    low_stock_only: '仅显示库存不足（布尔值，可选）'
  }
}

// 3. 查询客户信息
{
  name: 'query_customer',
  description: '查询客户信息，包括欠款、最近订单等',
  parameters: {
    customer_name: '客户名称（可选）',
    include_arrears: '是否包含欠款信息（布尔值，可选）',
    include_recent_orders: '是否包含最近订单（布尔值，可选）'
  }
}

// 4. 查询应收应付
{
  name: 'query_receivable_payable',
  description: '查询应收账款和应付账款',
  parameters: {
    type: '类型：receivable（应收）/payable（应付）',
    date_from: '起始日期（可选）',
    date_to: '结束日期（可选）',
    name: '客户/供应商名称（可选）'
  }
}

// 5. 查询订单详情
{
  name: 'query_order_detail',
  description: '根据单号查询订单详情',
  parameters: {
    bill_no: '单号',
    type: '单据类型：sale（销售单）/purchase（采购单）/return（退货单）'
  }
}

// 6. 查询供应商信息
{
  name: 'query_supplier',
  description: '查询供应商信息，包括应付账款',
  parameters: {
    supplier_name: '供应商名称（可选）',
    include_payable: '是否包含应付信息（布尔值，可选）'
  }
}

// 7. 经营日报/周报
{
  name: 'query_daily_summary',
  description: '查询经营汇总数据（日/周/月）',
  parameters: {
    period: '周期：today/this_week/this_month/last_month',
    metrics: '指标：sales_amount（销售额）/order_count（订单数）/new_customers（新客户数）/top_products（热销商品）'
  }
}
```

## 六、后端实现要点

### 6.1 API 设计

```
POST /api/ai/chat
Body: {
  message: string,        // 用户消息
  conversation_id: string // 会话ID（可选，用于多轮对话）
}

Response: {
  reply: string,          // AI 回复文本
  data: any | null,       // 结构化数据（如果有查询结果）
  tools_called: string[]  // 调用了哪些工具
}
```

### 6.2 安全控制

- **租户隔离：** 所有工具函数自动注入 tenant_id WHERE 条件
- **权限控制：** AI 只能查询当前用户权限范围内的数据
- **只读优先：** P1 阶段所有工具函数都是只读查询，不执行任何写操作
- **操作确认：** P2 阶段如果加入写操作（如开单），必须返回确认卡片，用户点击确认后才执行
- **频率限制：** 每用户每分钟最多 20 次请求，防止滥用

### 6.3 System Prompt 设计

```
你是智享营销系统的 AI 助手。你可以帮助商家查询经营数据、回答系统使用问题。

当前商家信息：
- 租户ID：{tenantId}
- 门店：{storeName}

你可以使用以下工具查询本地系统数据：
- query_sales：查询销售额
- query_inventory：查询库存
- query_customer：查询客户信息
- query_receivable_payable：查询应收应付
- query_order_detail：查询订单详情
- query_supplier：查询供应商信息
- query_daily_summary：查询经营汇总

注意事项：
1. 所有查询自动限定在当前商家范围内
2. 金额单位为元，库存单位为系统配置单位
3. 如果用户问题不明确，主动追问
4. 回复简洁明了，数据用表格呈现
```

## 七、前端实现要点

### 7.1 UI 组件

- **PC端：** 右下角悬浮气泡按钮，点击展开对话窗口
- **手机端：** 首页右上角 AI 图标，点击进入全屏对话页
- **收银台：** 侧边栏快捷入口

### 7.2 对话窗口功能

- 消息列表（用户消息 + AI 回复）
- 结构化数据展示（AI 返回的表格/卡片数据）
- 输入框 + 发送按钮
- 历史会话列表
- 快捷问题推荐（"今天卖了多少钱"、"库存预警"等）

### 7.3 技术实现

- Vue 3 组件：`<AiChatBubble>` + `<AiChatWindow>`
- 使用 SSE（Server-Sent Events）实现流式输出，提升响应速度
- Markdown 渲染（AI 回复可能包含表格）

## 八、数据库改造

```sql
-- AI 对话记录表
CREATE TABLE ai_conversation (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(200),                    -- 会话标题（取第一条消息摘要）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_user (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 对话消息表
CREATE TABLE ai_message (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant', 'system'),
  content TEXT NOT NULL,
  tools_called JSON,                     -- 调用的工具列表
  data_result JSON,                      -- 结构化数据结果
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 九、任务拆分

| 序号 | 任务 | 负责人 | 工时 | 依赖 |
|------|------|--------|------|------|
| 1 | AI 对话 UI 组件（气泡/窗口/历史记录/快捷问题） | 阿澈 | 3天 | 无 |
| 2 | 后端 AI 接口框架（LLM 对接 + Function Calling） | 阿坚 | 2天 | 无 |
| 3 | 工具函数封装 - 销售查询 | 阿坚 | 1天 | 2 |
| 4 | 工具函数封装 - 库存查询 | 阿坚 | 0.5天 | 2 |
| 5 | 工具函数封装 - 客户/供应商查询 | 阿坚 | 0.5天 | 2 |
| 6 | 工具函数封装 - 应收应付/订单详情 | 阿坚 | 0.5天 | 2 |
| 7 | 工具函数封装 - 经营汇总 | 阿坚 | 0.5天 | 2 |
| 8 | 权限校验 + 租户隔离 + 频率限制 | 阿坚 | 1天 | 2 |
| 9 | System Prompt 设计 + 知识库问答 | 阿坚 | 1天 | 2 |
| 10 | 对话记录存储（建表 + CRUD） | 阿坚 | 0.5天 | 无 |
| 11 | SSE 流式输出 | 阿坚 | 0.5天 | 2 |
| 12 | 测试 | 苏然 | 2天 | 全部完成后 |

**合计约 13 天**（不含测试），建议放在 **M3 之后** 开发。

## 十、成本估算

| 项目 | 月成本 |
|------|--------|
| LLM API（DeepSeek-V3） | 约 50-100 元 |
| 数据库存储（对话记录） | 可忽略 |
| **总计** | **约 100 元/月以内** |
