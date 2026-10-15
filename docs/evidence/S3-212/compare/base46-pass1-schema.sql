
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `t_aftersale`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_aftersale` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '售后单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `aftersale_no` varchar(64) NOT NULL COMMENT '售后单号',
  `aftersale_type` varchar(32) NOT NULL DEFAULT 'REFUND' COMMENT '售后类型：REFUND/EXCHANGE/RETURN',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单ID',
  `order_no` varchar(64) DEFAULT NULL COMMENT '关联订单号',
  `customer_id` bigint DEFAULT NULL COMMENT '客户ID',
  `store_id` bigint DEFAULT NULL COMMENT '门店ID',
  `reason` varchar(500) DEFAULT NULL COMMENT '售后原因',
  `reason_detail` text COMMENT '原因说明',
  `refund_amount` decimal(12,2) DEFAULT '0.00' COMMENT '退款金额',
  `exchange_qty` int DEFAULT '0' COMMENT '换货数量',
  `exchange_sku_id` bigint DEFAULT NULL COMMENT '换货SKU ID',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/APPROVED/REJECTED/COMPLETED/CANCELLED',
  `process_remark` varchar(500) DEFAULT NULL COMMENT '处理备注',
  `processed_by` bigint DEFAULT NULL COMMENT '处理人ID',
  `inspected_by` bigint DEFAULT NULL COMMENT '验收人ID',
  `inspect_result` text COMMENT '验收结果',
  `inspect_images` text COMMENT '验收图片',
  `images` text COMMENT '图片列表',
  `items` json DEFAULT NULL COMMENT '售后明细（JSON数组）',
  `receiver_name` varchar(64) DEFAULT NULL COMMENT '收货人姓名',
  `receiver_mobile` varchar(20) DEFAULT NULL COMMENT '收货人手机号',
  `receiver_address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `return_logistics_company` varchar(64) DEFAULT NULL COMMENT '退货物流公司',
  `return_logistics_no` varchar(64) DEFAULT NULL COMMENT '退货物流单号',
  `customer_comment` text COMMENT '客户评价',
  `satisfaction` int DEFAULT NULL COMMENT '满意度评分',
  `deadline` datetime DEFAULT NULL COMMENT '处理截止时间',
  `version` int NOT NULL DEFAULT '0' COMMENT '乐观锁版本',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_aftersale_no` (`aftersale_no`),
  KEY `idx_aftersale_order` (`order_id`),
  KEY `idx_aftersale_customer` (`customer_id`),
  KEY `idx_aftersale_status` (`status`),
  KEY `idx_aftersale_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='售后单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_agent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_agent` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `agent_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '代理商编码（唯一）',
  `agent_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '代理商名称',
  `level_id` bigint unsigned NOT NULL COMMENT '层级ID（逻辑引用 t_agent_level.id，同型对齐，不建物理外键）',
  `region` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '授权区域（NULL=未填写，不得用空串冒充未填写）',
  `contact_name` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '联系人姓名（NULL=未填写，不得用空串冒充未填写）',
  `contact_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '联系人电话（NULL=未填写，不得用空串冒充未填写）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待审核/ACTIVE-正常/FROZEN-冻结/TERMINATED-终止',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  `updated_by` int DEFAULT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_code` (`agent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台代理商档案（C6-3-3 档 1：只存档案与状态机，无任何金额列）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_agent_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_agent_level` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `level_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '层级编码（唯一，如 level_a / level_b，编码自定）',
  `level_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '层级名称（D11③ 自定义命名，不写死"一级/二级"）',
  `allow_sub_level` tinyint NOT NULL DEFAULT '0' COMMENT '是否允许发展下级代理：1-允许/0-不允许',
  `plan_scope` json DEFAULT NULL COMMENT '可售套餐范围（planId 数组，如 [1,2]；NULL=未配置，不得用空数组或 0 冒充）',
  `discount_low` decimal(5,2) DEFAULT NULL COMMENT '拿货折扣区间下限（未配置=NULL，不得写 0 冒充）',
  `discount_high` decimal(5,2) DEFAULT NULL COMMENT '拿货折扣区间上限（未配置=NULL，不得写 0 冒充）',
  `profit_mode_signup` tinyint NOT NULL DEFAULT '1' COMMENT '新签订单分润模式：1-开/0-关（D11② 初期只开新签与续费）',
  `profit_mode_renew` tinyint NOT NULL DEFAULT '1' COMMENT '续费订单分润模式：1-开/0-关',
  `profit_mode_upsell` tinyint NOT NULL DEFAULT '0' COMMENT '增值收入分润模式：1-开/0-关（D11② 增值初期关闭，默认 0）',
  `profit_rate_signup` decimal(6,4) DEFAULT NULL COMMENT '新签分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  `profit_rate_renew` decimal(6,4) DEFAULT NULL COMMENT '续费分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  `profit_rate_upsell` decimal(6,4) DEFAULT NULL COMMENT '增值分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号（数字越小越靠前）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  `updated_by` int DEFAULT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_level_code` (`level_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台代理商层级权益配置（C6-3-3 档 1：只存配置值，零计提）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户ID',
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '会话ID',
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI服务商',
  `model` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型名称',
  `intent` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '意图标签',
  `user_message` text COLLATE utf8mb4_unicode_ci COMMENT '用户消息原文',
  `tool_calls` json DEFAULT NULL COMMENT '工具调用记录（JSON数组）',
  `prompt_tokens` int NOT NULL DEFAULT '0' COMMENT '提示Token数',
  `completion_tokens` int NOT NULL DEFAULT '0' COMMENT '完成Token数',
  `latency_ms` int DEFAULT NULL COMMENT '本次调用延迟毫秒',
  `success` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否成功: 1=成功 0=失败',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息（失败时记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `cost` decimal(12,4) DEFAULT NULL COMMENT '本次调用费用（元，4位小数；NULL=未记录，不造0）',
  `deduct_source` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '扣减来源：free_grant/monthly_quota/points/overage（NULL=未记录）',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI调用审计日志（每次调用1条明细）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_evolution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_evolution` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID（进化仅租户内生效）',
  `target` varchar(16) NOT NULL COMMENT '进化对象：prompt/tool/graph/newtool',
  `version` int NOT NULL DEFAULT '1' COMMENT '进化版本号',
  `status` varchar(20) NOT NULL DEFAULT 'proposed' COMMENT 'proposed/review/gray/rolled_out/rejected/rolled_back',
  `current_snapshot` text COMMENT '现版本快照（回滚依据）',
  `proposed_diff` text COMMENT '建议内容（prompt文本/newtool JSON/diff）',
  `rationale` varchar(1000) DEFAULT NULL COMMENT '依据（引学习经验）',
  `review_id` bigint DEFAULT NULL COMMENT '关联待审工单ID',
  `gray_percent` int NOT NULL DEFAULT '0' COMMENT '灰度比例（0-100）',
  `proposed_by` varchar(64) DEFAULT NULL COMMENT '提出人',
  `reviewed_by` varchar(64) DEFAULT NULL COMMENT '审核人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rolled_out_at` datetime DEFAULT NULL COMMENT '生效时间',
  PRIMARY KEY (`id`),
  KEY `idx_evolution_tenant` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI自主进化版本（P3 SE 门控）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_external_model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_external_model` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL COMMENT '唯一标识（provider 类型名，如 custom_kimi）',
  `display_name` varchar(128) NOT NULL COMMENT '展示名称（如 Kimi）',
  `provider_base_url` varchar(255) NOT NULL COMMENT 'OpenAI 兼容 API 基础地址（如 https://api.moonshot.cn/v1）',
  `api_key` varchar(512) DEFAULT NULL COMMENT 'API Key（AES-256-GCM 加密存储，格式 iv:authTag:ciphertext hex）',
  `model_name` varchar(128) NOT NULL COMMENT '模型名称（如 moonshot-v1-8k）',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：1=启用 0=停用',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序（小的在前）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_external_model_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI底座外部大模型配置';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_knowledge_chunks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_knowledge_chunks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID（知识库按租户隔离）',
  `doc_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文档名称（含扩展名，如 产品手册.pdf）',
  `chunk_index` int NOT NULL COMMENT '分块序号（从0开始）',
  `chunk_text` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分块文本内容（单块约500字符）',
  `embedding` json NOT NULL COMMENT '文本向量（OpenAI兼容 embedding 数组 JSON）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_doc` (`tenant_id`,`doc_name`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识库分块向量表（RAG检索）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_learning_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_learning_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `exp_id` bigint DEFAULT NULL COMMENT '关联情节经验ID',
  `hint_key` varchar(64) DEFAULT NULL COMMENT '回流提示键（tool_select/routing）',
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '应用时间',
  `effect` varchar(32) DEFAULT NULL COMMENT '效果：positive/negative（采纳评估）',
  `note` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_learning_tenant` (`tenant_id`,`applied_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI学习回流记录（P2 自主学习 LN）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_ltm_archival`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_ltm_archival` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `title` varchar(255) NOT NULL COMMENT '标题',
  `body` text COMMENT '正文/知识沉淀',
  `source` varchar(64) DEFAULT NULL COMMENT '来源（学习/复盘/文档）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ltm_archival_tenant` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-归档（文档/知识沉淀）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_ltm_episodic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_ltm_episodic` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `summary` varchar(1000) DEFAULT NULL COMMENT '经验摘要',
  `what` varchar(1000) DEFAULT NULL COMMENT '发生了什么',
  `why` varchar(1000) DEFAULT NULL COMMENT '原因',
  `outcome` varchar(32) DEFAULT NULL COMMENT 'good/bad',
  `score` int NOT NULL DEFAULT '0' COMMENT '重要度评分（淘汰用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ltm_episodic_tenant` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-情节（历史交互经验）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_ltm_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_ltm_profile` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `entity_type` varchar(32) NOT NULL DEFAULT 'tenant' COMMENT '主体类型：tenant/user/customer',
  `entity_id` varchar(64) DEFAULT NULL COMMENT '主体ID（租户下用户/客户）',
  `k` varchar(128) NOT NULL COMMENT '档案键（偏好/常用对象/禁区）',
  `v_json` json DEFAULT NULL COMMENT '档案值',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ltm_profile` (`tenant_id`,`entity_type`,`entity_id`,`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-档案（稳定事实/偏好）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_review_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_review_task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `session_id` varchar(64) DEFAULT NULL COMMENT '图会话ID（续跑定位）',
  `graph_id` varchar(64) DEFAULT NULL COMMENT '图ID',
  `node_id` varchar(64) DEFAULT NULL COMMENT '触发审核的图节点ID',
  `tool_name` varchar(64) DEFAULT NULL COMMENT '触发审核的工具名',
  `payload` json DEFAULT NULL COMMENT '审核载荷（操作摘要/明细）',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人/发起者',
  `reviewed_by` varchar(64) DEFAULT NULL COMMENT '审核人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`id`),
  KEY `idx_review_tenant_status` (`tenant_id`,`status`),
  KEY `idx_review_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI待审工单（对接现有审核流程）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_ai_usage_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ai_usage_daily` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `chat_count` int NOT NULL DEFAULT '0' COMMENT '对话次数',
  `tool_call_count` int NOT NULL DEFAULT '0' COMMENT '工具调用次数',
  `prompt_tokens` bigint NOT NULL DEFAULT '0' COMMENT '提示Token数',
  `completion_tokens` bigint NOT NULL DEFAULT '0' COMMENT '完成Token数',
  `total_tokens` bigint NOT NULL DEFAULT '0' COMMENT '总Token数',
  `prompt_cost` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT '提示费用（元）',
  `completion_cost` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT '完成费用（元）',
  `total_cost` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT '总费用（元）',
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI服务商',
  `model` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型名称',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_date_provider` (`tenant_id`,`stat_date`,`provider`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_tenant_date` (`tenant_id`,`stat_date`),
  KEY `idx_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI用量日统计表（按租户+日期+服务商汇总）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_alert_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_alert_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '预警记录ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `alert_no` varchar(64) NOT NULL COMMENT '预警编号',
  `rule_id` bigint unsigned NOT NULL COMMENT '预警规则ID',
  `rule_type` varchar(32) NOT NULL COMMENT '预警类型：STOCK_LOW/EXPIRY/CREDIT/OVERDUE/STOCK_OVERSTOCK',
  `alert_level` varchar(16) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别：INFO/WARNING/CRITICAL',
  `title` varchar(255) NOT NULL COMMENT '预警标题',
  `description` text COMMENT '预警描述',
  `biz_type` varchar(64) DEFAULT NULL COMMENT '业务对象类型：SKU/CUSTOMER/SUPPLIER/BILL',
  `biz_id` bigint unsigned DEFAULT NULL COMMENT '业务对象ID',
  `biz_no` varchar(64) DEFAULT NULL COMMENT '业务对象编号',
  `current_value` decimal(12,2) DEFAULT NULL COMMENT '当前值',
  `threshold_value` decimal(12,2) DEFAULT NULL COMMENT '阈值',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/HANDLED/IGNORED',
  `handler_id` bigint unsigned DEFAULT NULL COMMENT '处理人ID',
  `handler_name` varchar(64) DEFAULT NULL COMMENT '处理人姓名',
  `handle_time` datetime DEFAULT NULL COMMENT '处理时间',
  `handle_remark` varchar(255) DEFAULT NULL COMMENT '处理备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alert_record_no` (`alert_no`),
  KEY `idx_alert_record_rule` (`rule_id`,`rule_type`),
  KEY `idx_alert_record_status` (`status`),
  KEY `idx_alert_record_biz` (`biz_type`,`biz_id`),
  KEY `idx_alert_record_created_at` (`created_at`),
  KEY `idx_t_alert_record_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预警记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_alert_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_alert_rule` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '预警规则ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `rule_code` varchar(64) NOT NULL COMMENT '规则编码',
  `rule_name` varchar(128) NOT NULL COMMENT '规则名称',
  `rule_type` varchar(32) NOT NULL COMMENT '规则类型：STOCK_LOW(安全库存)/EXPIRY(保质期)/CREDIT(信用额度)/OVERDUE(回款逾期)/STOCK_OVERSTOCK(库存积压)',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：1启用，0停用',
  `threshold_value` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '阈值',
  `threshold_unit` varchar(32) NOT NULL DEFAULT 'DAYS' COMMENT '阈值单位：DAYS(天)/PERCENT(百分比)/BOTTLES(瓶)/AMOUNT(金额)',
  `extra_config` json DEFAULT NULL COMMENT '额外配置（JSON格式）',
  `description` varchar(255) DEFAULT NULL COMMENT '规则描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alert_rule_code` (`rule_code`),
  KEY `idx_alert_rule_type` (`rule_type`),
  KEY `idx_t_alert_rule_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='预警规则表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_app_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_app_version` (
  `id` int NOT NULL AUTO_INCREMENT,
  `platform` varchar(32) NOT NULL COMMENT 'admin_web/app_mobile/print_agent',
  `version_code` int NOT NULL COMMENT '版本号(整型，递增)',
  `version_name` varchar(32) NOT NULL COMMENT '版本名，如 1.0.0',
  `min_version_code` int NOT NULL DEFAULT '0' COMMENT '最低兼容版本',
  `is_force` tinyint NOT NULL DEFAULT '0' COMMENT '是否强制更新',
  `update_url` varchar(512) NOT NULL DEFAULT '' COMMENT '下载/详情地址',
  `package_url` varchar(512) NOT NULL DEFAULT '' COMMENT '安装包/wgt 热更新包地址',
  `update_note` text COMMENT '更新说明',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用(作为当前版本)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `update_url_x64` varchar(512) NOT NULL DEFAULT '' COMMENT 'x64 安装包下载地址',
  `update_url_ia32` varchar(512) NOT NULL DEFAULT '' COMMENT 'x86(ia32) 安装包下载地址',
  `update_url_arm64` varchar(512) NOT NULL DEFAULT '' COMMENT 'arm64 安装包下载地址',
  `status` varchar(16) NOT NULL DEFAULT 'PUBLISHED' COMMENT '发布状态 DRAFT/PUBLISHED/PAUSED/ARCHIVED（历史行按已发布）',
  `gray_ratio` tinyint NOT NULL DEFAULT '0' COMMENT '灰度放量比例 0-100（0=未放量）',
  `archived_at` datetime DEFAULT NULL COMMENT '归档时间（NULL=未归档）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_version` (`platform`,`version_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应用版本发布';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_approver`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_approver` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `approver_type` varchar(32) NOT NULL COMMENT '审批人类型：ROLE/USER/DEPARTMENT',
  `approver_value` varchar(64) NOT NULL COMMENT '审批人值：角色代码/用户ID/部门ID',
  `approver_name` varchar(64) NOT NULL COMMENT '审批人名称',
  `backup_approver_id` bigint unsigned DEFAULT NULL COMMENT '备用审批人ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_approver_type` (`approver_type`,`approver_value`,`status`),
  KEY `idx_approval_approver_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批人配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_instance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_instance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '实例ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `instance_no` varchar(64) NOT NULL COMMENT '审批实例编号',
  `rule_id` bigint unsigned NOT NULL COMMENT '关联规则ID',
  `business_type` varchar(32) NOT NULL COMMENT '业务类型',
  `business_no` varchar(64) NOT NULL COMMENT '业务单号',
  `business_title` varchar(255) NOT NULL COMMENT '业务标题',
  `applicant_id` bigint unsigned NOT NULL COMMENT '申请人ID',
  `applicant_name` varchar(64) NOT NULL COMMENT '申请人姓名',
  `current_level` int NOT NULL DEFAULT '1' COMMENT '当前审批层级',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED/CANCELLED/ESCALATED',
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_approval_instance_no` (`instance_no`),
  KEY `idx_approval_instance_business` (`business_type`,`business_no`),
  KEY `idx_approval_instance_applicant` (`applicant_id`),
  KEY `idx_approval_instance_status` (`status`,`submitted_at`),
  KEY `idx_approval_instance_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批实例表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `instance_id` bigint unsigned NOT NULL COMMENT '关联实例ID',
  `task_id` bigint unsigned DEFAULT NULL COMMENT '关联任务ID',
  `action` varchar(32) NOT NULL COMMENT '操作：SUBMIT/APPROVE/REJECT/CANCEL/ESCALATE',
  `operator_id` bigint unsigned NOT NULL COMMENT '操作人ID',
  `operator_name` varchar(64) NOT NULL COMMENT '操作人姓名',
  `from_status` varchar(32) DEFAULT NULL COMMENT '原状态',
  `to_status` varchar(32) DEFAULT NULL COMMENT '新状态',
  `comment` varchar(500) DEFAULT NULL COMMENT '操作备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_log_instance` (`instance_id`),
  KEY `idx_approval_log_operator` (`operator_id`),
  KEY `idx_approval_log_created_at` (`created_at`),
  KEY `idx_approval_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_notification` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `instance_id` bigint unsigned NOT NULL COMMENT '关联实例ID',
  `task_id` bigint unsigned DEFAULT NULL COMMENT '关联任务ID',
  `notification_type` varchar(32) NOT NULL COMMENT '通知类型：NEW_TASK/ESCALATION/REMINDER/RESULT',
  `recipient_id` bigint unsigned NOT NULL COMMENT '接收人ID',
  `recipient_name` varchar(64) NOT NULL COMMENT '接收人姓名',
  `title` varchar(255) NOT NULL COMMENT '通知标题',
  `content` text NOT NULL COMMENT '通知内容',
  `channel` varchar(32) NOT NULL DEFAULT 'SYSTEM' COMMENT '通知渠道：SYSTEM/WECHAT/SMS/EMAIL',
  `read_status` tinyint NOT NULL DEFAULT '0' COMMENT '已读状态：0未读，1已读',
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `read_at` datetime DEFAULT NULL COMMENT '已读时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_notification_recipient` (`recipient_id`,`read_status`),
  KEY `idx_approval_notification_instance` (`instance_id`),
  KEY `idx_approval_notification_sent_at` (`sent_at`),
  KEY `idx_approval_notification_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批通知表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_rule` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `rule_name` varchar(128) NOT NULL COMMENT '规则名称',
  `business_type` varchar(32) NOT NULL COMMENT '业务类型：PURCHASE_ORDER/SALE_RETURN/PRICE_CHANGE/CREDIT_LIMIT',
  `trigger_condition` json NOT NULL COMMENT '触发条件：金额阈值、状态变更等',
  `approval_chain` json NOT NULL COMMENT '审批链：[{level: 1, approver_type: "ROLE", approver_value: "MANAGER"}]',
  `sla_hours` int NOT NULL DEFAULT '24' COMMENT 'SLA超时时间（小时）',
  `escalation_level` int DEFAULT '1' COMMENT '升级层级：1-直属上级，2-部门经理，3-总经理',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_rule_business_type` (`business_type`,`status`),
  KEY `idx_approval_rule_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批规则配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_approval_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_approval_task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `instance_id` bigint unsigned NOT NULL COMMENT '关联实例ID',
  `approval_level` int NOT NULL COMMENT '审批层级',
  `approver_id` bigint unsigned NOT NULL COMMENT '审批人ID',
  `approver_name` varchar(64) NOT NULL COMMENT '审批人姓名',
  `task_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '任务状态：PENDING/APPROVED/REJECTED/ESCALATED',
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '接收时间',
  `processed_at` datetime DEFAULT NULL COMMENT '处理时间',
  `sla_deadline` datetime NOT NULL COMMENT 'SLA截止时间',
  `escalated` tinyint NOT NULL DEFAULT '0' COMMENT '是否已升级：0否，1是',
  `approval_comment` varchar(500) DEFAULT NULL COMMENT '审批意见',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_task_instance` (`instance_id`),
  KEY `idx_approval_task_approver` (`approver_id`,`task_status`),
  KEY `idx_approval_task_sla` (`sla_deadline`,`task_status`),
  KEY `idx_approval_task_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审批任务表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `user_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `user_name` varchar(64) DEFAULT NULL COMMENT '操作人姓名',
  `role` varchar(32) DEFAULT NULL COMMENT '操作人角色',
  `action` varchar(64) NOT NULL COMMENT '操作动作',
  `resource_type` varchar(64) DEFAULT NULL COMMENT '资源类型',
  `resource_id` varchar(64) DEFAULT NULL COMMENT '资源ID',
  `detail` text COMMENT '操作详情',
  `ip` varchar(64) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(255) DEFAULT NULL COMMENT '浏览器UA',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_log_tenant` (`tenant_id`),
  KEY `idx_audit_log_action` (`action`),
  KEY `idx_audit_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审计日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_bank_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_bank_account` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL,
  `bank_name` varchar(64) NOT NULL COMMENT '银行名称',
  `branch_name` varchar(128) NOT NULL DEFAULT '' COMMENT '支行名称',
  `account_name` varchar(64) NOT NULL COMMENT '开户名',
  `account_no` varchar(64) NOT NULL COMMENT '银行账号(加密)',
  `bank_code` varchar(32) NOT NULL DEFAULT '' COMMENT '银行联行号',
  `qr_code_url` varchar(512) NOT NULL DEFAULT '' COMMENT '收款码图片URL',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认收款账户',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
  `remark` varchar(255) NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bank_branch` varchar(128) DEFAULT NULL COMMENT '支行名称(与branch_name同义)',
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='银行收款账户';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_bargain_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_bargain_activity` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动名称',
  `activity_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '活动描述',
  `product_id` bigint NOT NULL COMMENT '商品SPU ID',
  `sku_id` bigint DEFAULT NULL COMMENT 'SKU ID',
  `original_price` decimal(10,2) NOT NULL COMMENT '原价',
  `min_price` decimal(10,2) NOT NULL COMMENT '最低砍到价',
  `total_stock` int NOT NULL DEFAULT '0' COMMENT '活动总库存',
  `sold_count` int NOT NULL DEFAULT '0' COMMENT '已售数量',
  `bargain_times` int NOT NULL DEFAULT '10' COMMENT '砍价次数上限',
  `time_limit_hours` int NOT NULL DEFAULT '24' COMMENT '砍价时限(小时)',
  `help_min_amount` decimal(10,2) NOT NULL DEFAULT '1.00' COMMENT '每次帮砍最小金额',
  `help_max_amount` decimal(10,2) NOT NULL DEFAULT '10.00' COMMENT '每次帮砍最大金额',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/ACTIVE/PAUSED/ENDED',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_by` bigint DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_time_range` (`start_time`,`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='砍价活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_bargain_help`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_bargain_help` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `record_id` bigint unsigned NOT NULL COMMENT '砍价记录ID',
  `helper_id` bigint NOT NULL COMMENT '帮砍人用户ID',
  `helper_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '帮砍人昵称',
  `bargain_amount` decimal(10,2) NOT NULL COMMENT '砍掉金额',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_record_id` (`record_id`),
  KEY `idx_helper` (`helper_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帮砍记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_bargain_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_bargain_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint unsigned NOT NULL COMMENT '活动ID',
  `initiator_id` bigint NOT NULL COMMENT '发起人用户ID',
  `current_price` decimal(10,2) NOT NULL COMMENT '当前价格',
  `bargain_count` int NOT NULL DEFAULT '0' COMMENT '已砍次数',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ONGOING' COMMENT '状态：ONGOING/SUCCESS/FAILED/EXPIRED',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单ID',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `success_at` datetime DEFAULT NULL COMMENT '砍价成功时间',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_initiator` (`initiator_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='砍价记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_bill`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_bill` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '票据ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `bill_no` varchar(64) NOT NULL COMMENT '票据号',
  `bill_type` varchar(16) NOT NULL DEFAULT 'INVOICE' COMMENT '类型：INVOICE/RECEIPT/CHECK/DRAFT',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '金额',
  `issue_date` date DEFAULT NULL COMMENT '出票日期',
  `due_date` date DEFAULT NULL COMMENT '到期日期',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/VERIFIED/VOID',
  `verified_at` datetime DEFAULT NULL COMMENT '核销时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_no` (`bill_no`,`tenant_id`),
  KEY `idx_bill_tenant_status` (`tenant_id`,`status`),
  KEY `idx_bill_tenant_type` (`tenant_id`,`bill_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='票据管理表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_brand`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_brand` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '品牌ID',
  `name` varchar(64) NOT NULL COMMENT '品牌名称',
  `logo` varchar(512) DEFAULT NULL COMMENT '品牌Logo',
  `description` varchar(255) DEFAULT NULL COMMENT '品牌描述',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态 1=启用 0=停用',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_brand_tenant` (`tenant_id`),
  KEY `idx_brand_sort` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='品牌表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_cart_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_cart_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '购物车项ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) DEFAULT NULL COMMENT 'SKU名称快照',
  `name` varchar(128) DEFAULT NULL COMMENT '商品名称快照',
  `main_image` varchar(255) DEFAULT NULL COMMENT '主图URL',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '数量',
  `retail_price` decimal(12,2) DEFAULT NULL COMMENT '零售价快照',
  `miniapp_price` decimal(12,2) DEFAULT NULL COMMENT '小程序价快照',
  `wholesale_price` decimal(12,2) DEFAULT NULL COMMENT '批发价快照',
  `available_qty` int DEFAULT NULL COMMENT '可用库存快照',
  `added_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cart_customer_sku` (`customer_id`,`sku_id`,`tenant_id`),
  KEY `idx_cart_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='购物车表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_cash_flow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_cash_flow` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '流水ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `transaction_type` varchar(32) NOT NULL COMMENT '交易类型',
  `transaction_date` date NOT NULL COMMENT '交易日期',
  `amount` decimal(12,2) NOT NULL COMMENT '交易金额（正收负支）',
  `balance_before` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '变动前余额',
  `balance_after` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '变动后余额',
  `related_type` varchar(32) DEFAULT NULL COMMENT '关联类型',
  `related_no` varchar(64) DEFAULT NULL COMMENT '关联单号',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_flow_tenant` (`tenant_id`),
  KEY `idx_cash_flow_date` (`transaction_date`),
  KEY `idx_cash_flow_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='现金流表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_collection_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_collection_link` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '分享收款ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `link_no` varchar(64) NOT NULL COMMENT '分享收款单号',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型：SALE_BILL/MINIAPP_ORDER/STATEMENT',
  `source_no` varchar(64) NOT NULL COMMENT '来源单号',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID',
  `amount` decimal(12,2) NOT NULL COMMENT '本次收款金额',
  `tax_enabled` tinyint NOT NULL DEFAULT '0' COMMENT '是否展示税率',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '税率',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已支付金额',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PARTIAL/PAID/EXPIRED/CLOSED',
  `share_channel` varchar(32) NOT NULL COMMENT '分享方式：MINIAPP_CARD/LINK/IMAGE/QR_CODE',
  `share_user_id` bigint unsigned NOT NULL COMMENT '分享人',
  `share_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分享时间',
  `expire_at` datetime NOT NULL COMMENT '过期时间',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '查看次数',
  `last_view_time` datetime DEFAULT NULL COMMENT '最近查看时间',
  `pay_no` varchar(64) DEFAULT NULL COMMENT '关联支付单号',
  `token` varchar(128) NOT NULL COMMENT '访问令牌',
  `closed_reason` varchar(255) DEFAULT NULL COMMENT '关闭原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `display_config` json DEFAULT NULL COMMENT '显示字段配置',
  `document_title` varchar(128) DEFAULT '销售单' COMMENT '单据标题',
  `last_pay_time` datetime DEFAULT NULL COMMENT '最近支付时间',
  `store_id` bigint DEFAULT NULL COMMENT '门店ID(分享收款报表筛选)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collection_link_no` (`link_no`),
  UNIQUE KEY `uk_collection_link_token` (`token`),
  KEY `idx_collection_link_source` (`source_type`,`source_no`),
  KEY `idx_collection_link_status_expire` (`status`,`expire_at`),
  KEY `idx_t_collection_link_tenant` (`tenant_id`),
  KEY `idx_collection_link_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分享收款链接表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_collection_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_collection_record` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `customer_id` int NOT NULL COMMENT '客户ID',
  `receivable_no` varchar(64) DEFAULT NULL COMMENT '关联应收单号',
  `overdue_days` int DEFAULT '0' COMMENT '逾期天数',
  `overdue_amount` decimal(12,2) DEFAULT '0.00' COMMENT '逾期金额',
  `collection_level` enum('REMIND','LIGHT','MEDIUM','HEAVY','SEVERE') NOT NULL COMMENT '催收等级',
  `collection_method` enum('SMS','PHONE','VISIT','LETTER','LEGAL') NOT NULL COMMENT '催收方式',
  `collection_content` text COMMENT '催收内容',
  `contact_person` varchar(64) DEFAULT '' COMMENT '联系人',
  `contact_result` enum('PROMISED','REFUSED','NO_ANSWER','PARTIAL_PAID','DISPUTED') DEFAULT NULL COMMENT '催收结果',
  `promised_amount` decimal(12,2) DEFAULT NULL COMMENT '承诺还款金额',
  `promised_date` date DEFAULT NULL COMMENT '承诺还款日期',
  `next_follow_up_date` date DEFAULT NULL COMMENT '下次跟进日期',
  `operator_id` int NOT NULL COMMENT '操作人',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_collection_record_customer` (`customer_id`),
  KEY `idx_collection_record_follow_up` (`next_follow_up_date`),
  KEY `idx_t_collection_record_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='催收记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_collection_view_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_collection_view_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `link_no` varchar(64) NOT NULL COMMENT '分享收款单号',
  `ip` varchar(64) DEFAULT NULL COMMENT '访问IP',
  `user_agent` varchar(512) DEFAULT NULL COMMENT '用户代理',
  `viewed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (`id`),
  KEY `idx_collection_view_log_link_no` (`link_no`),
  KEY `idx_collection_view_log_viewed_at` (`viewed_at`),
  KEY `idx_t_collection_view_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分享收款访问日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_combo_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_combo_product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '组合品编号',
  `combo_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '组合品名称',
  `combo_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FIXED' COMMENT '组合类型：FIXED=固定组合 OPTIONAL=可选组合',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '描述',
  `base_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '基础价格',
  `min_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '最低价格',
  `max_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '最高价格',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '状态：0=停用 1=启用',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combo_no_tenant` (`combo_no`,`tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_combo_type` (`combo_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组合品表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_combo_product_option`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_combo_product_option` (
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_id` int NOT NULL COMMENT '组合品ID',
  `group_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '选项组名称',
  `sku_id` int NOT NULL COMMENT '商品SKU ID',
  `sku_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU名称',
  `barcode` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '条码',
  `extra_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '加价金额',
  `is_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否必选：0=否 1=是',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否默认选中：0=否 1=是',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_combo_id` (`combo_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组合品可选项目表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_coupon_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_coupon_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_code` varchar(32) NOT NULL COMMENT '模板编码',
  `template_name` varchar(128) NOT NULL COMMENT '模板名称',
  `coupon_type` varchar(32) NOT NULL COMMENT '优惠券类型（AMOUNT/DISCOUNT/GIFT）',
  `coupon_value` decimal(10,2) NOT NULL COMMENT '优惠值（金额/折扣率）',
  `min_purchase` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '最低消费金额',
  `max_discount` decimal(10,2) DEFAULT NULL COMMENT '最大优惠金额（折扣券用）',
  `applicable_scope` varchar(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围（ALL/CATEGORY/PRODUCT/STORE）',
  `applicable_ids` json DEFAULT NULL COMMENT '适用范围ID列表（商品ID/分类ID/门店ID）',
  `total_quantity` int NOT NULL DEFAULT '0' COMMENT '发行总量（0表示不限量）',
  `issued_quantity` int NOT NULL DEFAULT '0' COMMENT '已发行数量',
  `used_quantity` int NOT NULL DEFAULT '0' COMMENT '已使用数量',
  `per_limit` int NOT NULL DEFAULT '1' COMMENT '每人限领数量',
  `valid_type` varchar(32) NOT NULL COMMENT '有效期类型（FIXED/DAYS）',
  `valid_start` datetime DEFAULT NULL COMMENT '固定开始时间',
  `valid_end` datetime DEFAULT NULL COMMENT '固定结束时间',
  `valid_days` int DEFAULT NULL COMMENT '领取后有效天数',
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态（DRAFT/ACTIVE/PAUSED/EXPIRED/DEPLETED）',
  `description` varchar(500) DEFAULT NULL COMMENT '使用说明',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `name` varchar(128) DEFAULT NULL COMMENT '模板名称(与template_name同义)',
  `type` varchar(32) DEFAULT NULL COMMENT '券类型(与coupon_type同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_code` (`template_code`),
  KEY `idx_template_code` (`template_code`),
  KEY `idx_template_status` (`status`),
  KEY `idx_template_tenant` (`tenant_id`),
  KEY `idx_template_valid` (`valid_start`,`valid_end`),
  KEY `idx_coupon_template_status` (`status`),
  KEY `idx_coupon_template_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='优惠券模板表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_credit_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_credit_operation_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `customer_id` int NOT NULL COMMENT '客户ID',
  `operation_type` enum('ADJUST_LIMIT','OCCUPY','RELEASE','FREEZE','UNFREEZE','OVERDUE_DEDUCT','MANUAL_ADJUST') NOT NULL COMMENT '操作类型',
  `amount` decimal(12,2) NOT NULL COMMENT '变动金额（正=增加，负=减少）',
  `balance_before` decimal(12,2) NOT NULL COMMENT '操作前可用额度',
  `balance_after` decimal(12,2) NOT NULL COMMENT '操作后可用额度',
  `related_order_no` varchar(64) DEFAULT NULL COMMENT '关联订单号',
  `operator_id` int NOT NULL COMMENT '操作人',
  `remark` varchar(255) DEFAULT '' COMMENT '备注',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_credit_operation_log_customer` (`customer_id`),
  KEY `idx_credit_operation_log_order` (`related_order_no`),
  KEY `idx_t_credit_operation_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='授信操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_custom_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_custom_report` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报表名称',
  `report_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报表类型：SALES/INVENTORY/FINANCE/CUSTOMER',
  `data_source` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据源表名',
  `config` json NOT NULL COMMENT '报表配置（字段、筛选、图表配置）',
  `chart_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'TABLE' COMMENT '图表类型：TABLE/LINE/BAR/PIE',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报表描述',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED',
  `created_by` bigint DEFAULT NULL COMMENT '创建人',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_report_type` (`report_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义报表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_custom_report_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_custom_report_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_id` bigint unsigned NOT NULL COMMENT '报表ID',
  `generated_by` bigint DEFAULT NULL COMMENT '生成人',
  `params` json DEFAULT NULL COMMENT '生成参数',
  `row_count` int NOT NULL DEFAULT '0' COMMENT '数据行数',
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '导出文件URL',
  `export_format` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '导出格式：EXCEL/CSV/PDF',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：PENDING/SUCCESS/FAILED',
  `error_msg` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '错误信息',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_report_id` (`report_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报表生成记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_custom_report_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_custom_report_schedule` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `template_id` bigint unsigned NOT NULL COMMENT '模板ID',
  `name` varchar(128) NOT NULL COMMENT '任务名称',
  `cron_expression` varchar(64) NOT NULL COMMENT '定时表达式',
  `export_format` varchar(16) DEFAULT 'EXCEL' COMMENT '导出格式：EXCEL/PDF',
  `recipients` json DEFAULT NULL COMMENT '接收人列表',
  `last_run_at` datetime DEFAULT NULL COMMENT '上次执行时间',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/PAUSED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='定时报表导出表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_custom_report_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_custom_report_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL COMMENT '模板名称',
  `type` varchar(32) NOT NULL COMMENT '报表类型：SALES/INVENTORY/FINANCE/CUSTOMER',
  `config` json NOT NULL COMMENT '报表配置（指标、维度、筛选条件）',
  `creator_id` bigint unsigned NOT NULL COMMENT '创建人',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_creator` (`creator_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='自定义报表模板表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_care_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_care_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `rule_id` bigint NOT NULL COMMENT '关怀规则ID',
  `trigger_type` varchar(20) NOT NULL COMMENT '触发类型',
  `sent_content` text COMMENT '发送内容',
  `sent_at` datetime DEFAULT NULL COMMENT '发送时间',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SENT/FAILED',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_rule` (`rule_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户关怀记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_care_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_care_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `trigger_type` varchar(20) NOT NULL COMMENT '触发类型: BIRTHDAY/HOLIDAY/INACTIVE/LEVEL_UP',
  `template_content` text COMMENT '关怀内容模板',
  `reward_points` int DEFAULT '0' COMMENT '奖励积分',
  `reward_coupon_id` bigint DEFAULT NULL COMMENT '奖励优惠券ID',
  `enabled` tinyint DEFAULT '1' COMMENT '是否启用',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trigger` (`trigger_type`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户关怀规则';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_credit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_credit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `customer_id` int NOT NULL COMMENT '客户ID',
  `credit_limit` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '授信总额度',
  `credit_used` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已用额度',
  `credit_frozen` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '冻结额度',
  `credit_available` decimal(12,2) GENERATED ALWAYS AS (((`credit_limit` - `credit_used`) - `credit_frozen`)) STORED COMMENT '可用额度',
  `payment_term` enum('COD','NET_7','NET_15','NET_30','NET_60','NET_90') DEFAULT 'COD' COMMENT '账期',
  `late_fee_rate` decimal(6,4) DEFAULT '0.0005' COMMENT '日滞纳金费率(0.05%)',
  `max_late_fee_rate` decimal(6,4) DEFAULT '0.3000' COMMENT '最高滞纳金比例(30%)',
  `warning_threshold` decimal(5,2) DEFAULT '0.80' COMMENT '预警阈值(80%)',
  `overdue_freeze_days` int DEFAULT '15' COMMENT '逾期多少天自动冻结',
  `status` enum('ACTIVE','FROZEN','CLOSED') DEFAULT 'ACTIVE',
  `freeze_reason` varchar(255) DEFAULT NULL,
  `frozen_at` datetime DEFAULT NULL,
  `unfrozen_at` datetime DEFAULT NULL,
  `version` int DEFAULT '1' COMMENT '乐观锁版本号',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_id` (`customer_id`),
  KEY `idx_t_customer_credit_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户授信额度表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_level` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `level_name` varchar(20) NOT NULL DEFAULT 'VIP1' COMMENT '等级名称',
  `level_points` int DEFAULT '0' COMMENT '当前等级积分',
  `upgraded_at` datetime DEFAULT NULL COMMENT '升级时间',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer` (`customer_id`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户等级';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_payment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '客户收款单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `receipt_no` varchar(64) NOT NULL COMMENT '收款单号',
  `customer_id` bigint unsigned NOT NULL COMMENT '客户ID',
  `customer_name` varchar(64) NOT NULL COMMENT '客户名称快照',
  `amount` decimal(12,2) NOT NULL COMMENT '收款金额',
  `payment_method` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH/BANK/WECHAT/ALIPAY/COLLECTION',
  `source_type` varchar(32) DEFAULT NULL COMMENT '来源类型：SALE_BILL/STATEMENT',
  `source_no` varchar(64) DEFAULT NULL COMMENT '来源单号',
  `voucher_no` varchar(64) DEFAULT NULL COMMENT '凭证号',
  `payment_date` date NOT NULL COMMENT '收款日期',
  `operator_id` bigint unsigned NOT NULL COMMENT '收款人',
  `status` varchar(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED/VOIDED',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_payment_receipt_no` (`receipt_no`),
  KEY `idx_customer_payment_customer` (`customer_id`),
  KEY `idx_customer_payment_source` (`source_type`,`source_no`),
  KEY `idx_customer_payment_created_at` (`created_at`),
  KEY `idx_t_customer_payment_tenant` (`tenant_id`),
  KEY `idx_customer_payment_status` (`status`),
  KEY `idx_customer_payment_payment_date` (`payment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户收款单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_points` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `total_points` int DEFAULT '0' COMMENT '累计积分',
  `available_points` int DEFAULT '0' COMMENT '可用积分',
  `frozen_points` int DEFAULT '0' COMMENT '冻结积分',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer` (`customer_id`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户积分';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_price`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_price` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `custom_price` decimal(12,2) NOT NULL COMMENT '客户专属价格',
  `effective_start` date DEFAULT NULL COMMENT '生效开始日期',
  `effective_end` date DEFAULT NULL COMMENT '生效结束日期',
  `status` tinyint DEFAULT '1' COMMENT '状态 1=启用 0=停用',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_sku` (`customer_id`,`sku_id`,`tenant_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户专属价格';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_price_binding`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_price_binding` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `customer_id` int NOT NULL COMMENT '客户ID',
  `price_level_id` int NOT NULL COMMENT '价格等级ID',
  `apply_reason` varchar(255) DEFAULT '' COMMENT '申请原因',
  `status` enum('PENDING','APPROVED','REJECTED','EXPIRED') DEFAULT 'PENDING',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `expire_at` datetime DEFAULT NULL COMMENT '到期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `price` decimal(12,2) DEFAULT NULL COMMENT '协议价(结算取价)',
  `sku_id` bigint DEFAULT NULL COMMENT 'SKU ID(协议价按SKU直绑)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer` (`customer_id`),
  KEY `idx_customer_price_binding_level` (`price_level_id`),
  KEY `idx_t_customer_price_binding_tenant` (`tenant_id`),
  KEY `idx_cpb_sku` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户价格等级绑定表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `age_group` varchar(20) DEFAULT NULL COMMENT '年龄段',
  `gender` varchar(10) DEFAULT NULL COMMENT '性别',
  `prefer_category` varchar(500) DEFAULT NULL COMMENT '偏好品类',
  `prefer_brand` varchar(500) DEFAULT NULL COMMENT '偏好品牌',
  `avg_order_amount` decimal(12,2) DEFAULT '0.00' COMMENT '平均客单价',
  `total_order_count` int DEFAULT '0' COMMENT '累计消费次数',
  `last_order_at` datetime DEFAULT NULL COMMENT '最近消费时间',
  `total_points` int DEFAULT '0' COMMENT '累计积分',
  `member_level` varchar(20) DEFAULT NULL COMMENT '会员等级',
  `lifecycle_stage` varchar(20) DEFAULT 'PROSPECT' COMMENT '生命周期阶段',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer` (`customer_id`,`tenant_id`),
  KEY `idx_stage` (`lifecycle_stage`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户画像';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_quote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_quote` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '报价单ID',
  `quote_no` varchar(32) NOT NULL COMMENT '报价单号',
  `title` varchar(200) NOT NULL COMMENT '报价单标题',
  `customer_id` bigint unsigned NOT NULL COMMENT '客户ID',
  `customer_name` varchar(100) NOT NULL COMMENT '客户名称（冗余）',
  `customer_phone` varchar(20) DEFAULT NULL COMMENT '客户电话（冗余）',
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE有效/CANCELLED已取消/EXPIRED已过期',
  `valid_days` int NOT NULL DEFAULT '7' COMMENT '有效期(天)',
  `expire_at` datetime NOT NULL COMMENT '过期时间',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '总金额',
  `total_sku` int NOT NULL DEFAULT '0' COMMENT 'SKU数量',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '浏览次数',
  `created_by` bigint unsigned NOT NULL COMMENT '创建人ID',
  `share_token` varchar(64) DEFAULT NULL COMMENT '分享令牌',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quote_no` (`quote_no`,`tenant_id`),
  UNIQUE KEY `uk_share_token` (`share_token`),
  KEY `idx_customer_id` (`customer_id`,`tenant_id`),
  KEY `idx_status` (`status`,`tenant_id`),
  KEY `idx_created_at` (`created_at`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户报价单';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_quote_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_quote_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `quote_id` bigint unsigned NOT NULL COMMENT '报价单ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(200) NOT NULL COMMENT 'SKU名称（冗余）',
  `quote_price` decimal(12,2) NOT NULL COMMENT '报价',
  `min_qty` int NOT NULL DEFAULT '1' COMMENT '最小起订量',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quote_id` (`quote_id`,`tenant_id`),
  KEY `idx_sku_id` (`sku_id`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='报价单明细';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_quote_push_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_quote_push_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `quote_id` bigint unsigned NOT NULL COMMENT '报价单ID',
  `channel` varchar(20) NOT NULL COMMENT '推送渠道：sms/miniapp/email',
  `content` varchar(500) DEFAULT NULL COMMENT '推送内容',
  `target` varchar(100) DEFAULT NULL COMMENT '推送目标（手机号/OpenID/邮箱）',
  `status` varchar(20) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS成功/FAILED失败',
  `error_msg` varchar(500) DEFAULT NULL COMMENT '错误信息',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quote_id` (`quote_id`,`tenant_id`),
  KEY `idx_created_at` (`created_at`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='报价推送日志';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_segment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_segment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `segment_name` varchar(100) NOT NULL COMMENT '分群名称',
  `conditions` json NOT NULL COMMENT '分群条件',
  `member_count` int DEFAULT '0' COMMENT '成员数',
  `auto_refresh` tinyint DEFAULT '0' COMMENT '是否自动刷新',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户分群';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_segment_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_segment_member` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `segment_id` bigint NOT NULL COMMENT '分群ID',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_segment_customer` (`segment_id`,`customer_id`,`tenant_id`),
  KEY `idx_segment` (`segment_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户分群成员';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_statement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_statement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '对账单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `statement_no` varchar(64) NOT NULL COMMENT '对账单号',
  `customer_id` bigint unsigned NOT NULL COMMENT '客户ID',
  `customer_name` varchar(64) NOT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号快照',
  `statement_type` varchar(32) NOT NULL DEFAULT 'MONTHLY' COMMENT '对账类型：MONTHLY/QUARTERLY/CUSTOM',
  `start_date` date NOT NULL COMMENT '对账开始日期',
  `end_date` date NOT NULL COMMENT '对账结束日期',
  `opening_balance` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '期初余额',
  `total_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '本期销售',
  `total_returns` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '本期退货',
  `total_payments` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '本期收款',
  `closing_balance` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '期末余额',
  `status` varchar(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/CONFIRMED/PAID',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `operator_id` bigint unsigned NOT NULL COMMENT '制单人',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_statement_no` (`statement_no`),
  KEY `idx_customer_statement_customer` (`customer_id`),
  KEY `idx_customer_statement_period` (`start_date`,`end_date`),
  KEY `idx_t_customer_statement_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户对账单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_tag`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_tag` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tag_name` varchar(50) NOT NULL COMMENT '标签名称',
  `tag_type` varchar(20) NOT NULL DEFAULT 'MANUAL' COMMENT '类型: MANUAL/AUTO',
  `tag_group` varchar(50) DEFAULT NULL COMMENT '标签分组',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tag_name` (`tag_name`,`tenant_id`),
  KEY `idx_type` (`tag_type`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户标签';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_tag_relation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_tag_relation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `tag_id` bigint NOT NULL COMMENT '标签ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_tag` (`customer_id`,`tag_id`,`tenant_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_tag` (`tag_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户标签关联';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_type` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '类型ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `name` varchar(50) NOT NULL COMMENT '类型名称',
  `code` varchar(32) NOT NULL COMMENT '类型编码',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态 1=启用 0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_tenant` (`code`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户类型配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_customer_visit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_customer_visit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '拜访记录ID',
  `visit_no` varchar(64) NOT NULL COMMENT '拜访单号',
  `customer_id` bigint unsigned NOT NULL COMMENT '客户ID',
  `customer_name` varchar(64) NOT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号',
  `store_id` bigint unsigned NOT NULL COMMENT '所属门店ID',
  `visitor_id` bigint unsigned NOT NULL COMMENT '拜访人(员工ID)',
  `visitor_name` varchar(64) NOT NULL COMMENT '拜访人姓名',
  `visit_type` varchar(32) NOT NULL DEFAULT 'ONSITE' COMMENT '拜访类型：ONSITE(现场拜访)/PHONE(电话拜访)/ONLINE(线上拜访)',
  `visit_purpose` varchar(32) NOT NULL DEFAULT 'ROUTINE' COMMENT '拜访目的：ROUTINE(常规拜访)/ORDER(下单)/COLLECTION(催收)/COMPLAINT(投诉处理)/PROMOTION(推广)/AFTER_SALE(售后)',
  `visit_date` date NOT NULL COMMENT '拜访日期',
  `start_time` datetime DEFAULT NULL COMMENT '拜访开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '拜访结束时间',
  `duration_minutes` int DEFAULT NULL COMMENT '拜访时长(分钟)',
  `address` varchar(255) DEFAULT NULL COMMENT '拜访地址',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT '纬度',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT '经度',
  `contact_person` varchar(64) DEFAULT NULL COMMENT '联系人',
  `contact_position` varchar(64) DEFAULT NULL COMMENT '联系人职位',
  `contact_mobile` varchar(20) DEFAULT NULL COMMENT '联系人电话',
  `visit_summary` text COMMENT '拜访总结',
  `follow_up_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否需要跟进：0否 1是',
  `follow_up_date` date DEFAULT NULL COMMENT '下次跟进日期',
  `follow_up_content` varchar(255) DEFAULT NULL COMMENT '跟进内容说明',
  `next_action` varchar(255) DEFAULT NULL COMMENT '下一步行动计划',
  `status` varchar(32) NOT NULL DEFAULT 'PLANNED' COMMENT '状态：PLANNED(计划中)/VISITED(已拜访)/COMPLETED(已完成)/CANCELLED(已取消)',
  `related_order_no` varchar(64) DEFAULT NULL COMMENT '关联订单号',
  `images` json DEFAULT NULL COMMENT '拜访照片(JSON数组)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_visit_no` (`visit_no`),
  KEY `idx_customer_visit_customer` (`customer_id`),
  KEY `idx_customer_visit_visitor` (`visitor_id`),
  KEY `idx_customer_visit_date` (`visit_date`),
  KEY `idx_customer_visit_status` (`status`),
  KEY `idx_customer_visit_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户拜访记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_daily_settlement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_daily_settlement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '结算ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `settle_date` date NOT NULL COMMENT '结算日期',
  `shift_no` varchar(64) DEFAULT NULL COMMENT '交接班编号',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `total_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '销售总额',
  `total_received` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '实收总额',
  `total_refund` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '退款总额',
  `cash_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '现金金额',
  `wechat_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '微信金额',
  `alipay_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '支付宝金额',
  `transfer_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '转账金额',
  `other_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '其他金额',
  `status` varchar(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_daily_settlement_date` (`settle_date`,`store_id`,`tenant_id`),
  KEY `idx_daily_settlement_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每日结算表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_data_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_data_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `permission_name` varchar(128) NOT NULL COMMENT '权限名称',
  `permission_code` varchar(64) NOT NULL COMMENT '权限编码（如 STORE_DATA/DEPARTMENT_DATA）',
  `permission_type` varchar(32) NOT NULL COMMENT '权限类型：DEPARTMENT(按部门)/STORE(按门店)/CUSTOMER(按客户)/ALL(全部数据)',
  `description` varchar(255) DEFAULT NULL COMMENT '权限描述',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0禁用',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_tenant` (`permission_code`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据权限配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_delivery_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_delivery_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_name` varchar(64) NOT NULL COMMENT '配置名称',
  `delivery_type` varchar(16) NOT NULL COMMENT '配送类型（SELF/PLATFORM/THIRD_PARTY）',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '配送费',
  `free_delivery_amount` decimal(10,2) DEFAULT NULL COMMENT '免配送费金额',
  `delivery_radius` int DEFAULT NULL COMMENT '配送半径（公里）',
  `estimated_time` varchar(50) DEFAULT NULL COMMENT '预计配送时间',
  `contact_phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='配送配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_delivery_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_delivery_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `delivery_no` varchar(32) DEFAULT NULL COMMENT '配送单号',
  `delivery_type` varchar(16) NOT NULL COMMENT '配送类型',
  `rider_name` varchar(64) DEFAULT NULL COMMENT '骑手姓名',
  `rider_phone` varchar(20) DEFAULT NULL COMMENT '骑手电话',
  `rider_id` bigint DEFAULT NULL COMMENT '骑手ID',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态（PENDING/ASSIGNED/PICKED_UP/DELIVERING/COMPLETED）',
  `picked_up_at` datetime DEFAULT NULL COMMENT '取货时间',
  `delivered_at` datetime DEFAULT NULL COMMENT '送达时间',
  `delivery_latitude` decimal(10,6) DEFAULT NULL COMMENT '骑手纬度',
  `delivery_longitude` decimal(10,6) DEFAULT NULL COMMENT '骑手经度',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_delivery_no` (`delivery_no`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_delivery_record_rider_id` (`rider_id`),
  CONSTRAINT `t_delivery_record_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `t_retail_order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='配送记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_error_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_error_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '错误日志ID',
  `error_type` varchar(64) NOT NULL COMMENT '错误类型',
  `severity` varchar(16) NOT NULL DEFAULT 'ERROR' COMMENT '严重级别: WARN/ERROR/FATAL',
  `message` text NOT NULL COMMENT '错误消息',
  `stack` text COMMENT '堆栈信息',
  `request_url` varchar(500) DEFAULT NULL COMMENT '请求URL',
  `request_method` varchar(10) DEFAULT NULL COMMENT '请求方法',
  `status_code` int DEFAULT NULL COMMENT 'HTTP状态码',
  `user_id` bigint unsigned DEFAULT NULL COMMENT '用户ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `source` varchar(16) NOT NULL DEFAULT 'backend' COMMENT '来源: backend/frontend',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_error_logs_type` (`error_type`),
  KEY `idx_error_logs_severity` (`severity`),
  KEY `idx_error_logs_source` (`source`),
  KEY `idx_error_logs_tenant` (`tenant_id`),
  KEY `idx_error_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='错误日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_expense`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_expense` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expense_no` varchar(32) NOT NULL COMMENT '费用编号',
  `expense_type` varchar(20) NOT NULL DEFAULT 'DAILY' COMMENT '类型: DAILY/RENT/UTILITY/SALARY/TAX/OTHER',
  `category` varchar(50) DEFAULT NULL COMMENT '费用分类',
  `amount` decimal(12,2) NOT NULL COMMENT '金额',
  `payee` varchar(100) DEFAULT NULL COMMENT '收款方',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '付款方式',
  `bank_account_id` bigint DEFAULT NULL COMMENT '付款账户',
  `invoice_no` varchar(50) DEFAULT NULL COMMENT '发票号',
  `expense_date` date DEFAULT NULL COMMENT '费用日期',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/APPROVED/PAID/VOIDED',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_expense_no` (`expense_no`,`tenant_id`),
  KEY `idx_type` (`expense_type`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='费用';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_expiry_alert_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_expiry_alert_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `alert_level` tinyint NOT NULL COMMENT '预警级别(1/2/3)',
  `level_name` varchar(20) NOT NULL COMMENT '级别名称(如"三级预警")',
  `days_before_expiry` int NOT NULL COMMENT '提前天数',
  `action` varchar(20) NOT NULL COMMENT '动作: REMIND/RESTRICT/BLOCK',
  `color` varchar(20) NOT NULL COMMENT '颜色值: #10B981/#F59E0B/#EF4444',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `description` varchar(255) DEFAULT '' COMMENT '描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_t_expiry_alert_config_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='效期预警配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_expiry_alert_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_expiry_alert_record` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `batch_id` int NOT NULL COMMENT '批次ID',
  `store_id` int NOT NULL COMMENT '门店ID',
  `sku_id` int NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) DEFAULT '' COMMENT '商品名称',
  `batch_no` varchar(64) DEFAULT '' COMMENT '批次号',
  `production_date` date DEFAULT NULL COMMENT '生产日期',
  `expiry_date` date DEFAULT NULL COMMENT '过期日期',
  `days_remaining` int NOT NULL COMMENT '剩余天数',
  `alert_level` tinyint NOT NULL COMMENT '预警级别',
  `action_taken` varchar(20) NOT NULL COMMENT '执行动作: REMIND/RESTRICT/BLOCK',
  `status` enum('PENDING','HANDLED','EXPIRED') NOT NULL DEFAULT 'PENDING' COMMENT '状态',
  `handled_by` int DEFAULT NULL COMMENT '处理人ID',
  `handled_at` datetime DEFAULT NULL COMMENT '处理时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_expiry_alert_record_batch_level` (`batch_id`,`alert_level`),
  KEY `idx_expiry_alert_record_batch` (`batch_id`),
  KEY `idx_expiry_alert_record_store` (`store_id`),
  KEY `idx_expiry_alert_record_status` (`status`),
  KEY `idx_expiry_alert_record_alert_level` (`alert_level`),
  KEY `idx_t_expiry_alert_record_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='效期预警记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_flash_sale`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_flash_sale` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '活动ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `name` varchar(128) NOT NULL COMMENT '活动名称',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `flash_price` decimal(12,2) NOT NULL COMMENT '秒杀价',
  `original_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '原价',
  `price` decimal(12,2) DEFAULT NULL COMMENT '价格',
  `quantity` int NOT NULL DEFAULT '0' COMMENT '数量',
  `total_stock` int NOT NULL DEFAULT '0' COMMENT '总库存',
  `sold_count` int NOT NULL DEFAULT '0' COMMENT '已售数量',
  `limit_per_user` int NOT NULL DEFAULT '1' COMMENT '每人限购',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE/EXPIRED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flash_sale_tenant` (`tenant_id`),
  KEY `idx_flash_sale_status` (`status`),
  KEY `idx_flash_sale_sku` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='限时秒杀活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_flash_sale_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_flash_sale_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `flash_sale_id` bigint NOT NULL COMMENT '秒杀活动ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `name` varchar(128) DEFAULT NULL COMMENT '活动名称快照',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '购买数量',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成交价',
  `flash_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '秒杀价快照',
  `original_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '原价快照',
  `total_stock` int DEFAULT NULL COMMENT '总库存快照',
  `sold_count` int DEFAULT NULL COMMENT '已售快照',
  `status` varchar(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS/FAILED/CANCELLED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flash_sale_record_sale` (`flash_sale_id`),
  KEY `idx_flash_sale_record_user` (`user_id`),
  KEY `idx_flash_sale_record_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='秒杀参与记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_full_reduction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_full_reduction` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '活动ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `name` varchar(128) NOT NULL COMMENT '活动名称',
  `rules` json DEFAULT NULL COMMENT '满减规则（JSON）',
  `applicable_scope` varchar(32) DEFAULT 'ALL' COMMENT '适用范围：ALL/CATEGORY/PRODUCT',
  `applicable_ids` text COMMENT '适用ID列表',
  `description` varchar(500) DEFAULT NULL COMMENT '活动说明',
  `priority` int NOT NULL DEFAULT '0' COMMENT '优先级',
  `stackable` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可叠加',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE/EXPIRED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_full_reduction_tenant` (`tenant_id`),
  KEY `idx_full_reduction_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='满减活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_full_reduction_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_full_reduction_rule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL COMMENT '活动ID',
  `threshold_amount` decimal(10,2) NOT NULL COMMENT '满足金额阈值',
  `reduction_amount` decimal(10,2) NOT NULL COMMENT '减免金额',
  `is_continuous` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否连续满减（每满X减Y）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`),
  CONSTRAINT `t_full_reduction_rule_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `t_promotion_activity` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='满减规则表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_gift_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_gift_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则编码',
  `rule_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规则名称',
  `rule_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '规则描述',
  `threshold_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AMOUNT' COMMENT '门槛类型: AMOUNT/QUANTITY/BOTH',
  `threshold_amount` decimal(10,2) DEFAULT NULL COMMENT '满X元',
  `threshold_quantity` int DEFAULT NULL COMMENT '满X件',
  `applicable_scope` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL' COMMENT '适用范围: ALL/CATEGORY/PRODUCT',
  `applicable_ids` json DEFAULT NULL COMMENT '适用范围ID列表',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `gift_stock_limit` int DEFAULT NULL COMMENT '赠品库存上限',
  `remain_gift_stock` int DEFAULT '0' COMMENT '剩余赠品库存',
  `is_stock_synced` tinyint(1) DEFAULT '0' COMMENT '是否与商品库存联动',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/ACTIVE/PAUSED/ENDED/DEPLETED',
  `participant_count` int NOT NULL DEFAULT '0' COMMENT '参与人数',
  `gift_sent_count` int NOT NULL DEFAULT '0' COMMENT '赠送件数',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_time_range` (`start_time`,`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='满赠规则';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_gift_rule_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_gift_rule_level` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_id` bigint NOT NULL COMMENT '规则ID',
  `threshold_amount` decimal(10,2) DEFAULT NULL COMMENT '门槛金额',
  `gift_product_id` bigint NOT NULL COMMENT '赠品商品ID',
  `gift_sku_id` bigint DEFAULT NULL COMMENT '赠品SKU ID',
  `gift_quantity` int NOT NULL DEFAULT '1' COMMENT '赠送数量',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_id` (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='满赠规则层级';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '拼团ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `activity_id` bigint DEFAULT NULL COMMENT '关联活动ID',
  `name` varchar(128) NOT NULL COMMENT '活动名称',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `group_price` decimal(12,2) NOT NULL COMMENT '拼团价',
  `original_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '原价',
  `min_group_size` int NOT NULL DEFAULT '2' COMMENT '最小成团人数',
  `max_group_size` int NOT NULL DEFAULT '2' COMMENT '最大成团人数',
  `target_size` int NOT NULL DEFAULT '2' COMMENT '成团目标人数',
  `current_size` int NOT NULL DEFAULT '0' COMMENT '当前参团人数',
  `leader_id` bigint DEFAULT NULL COMMENT '团长用户ID',
  `leader_order_id` bigint DEFAULT NULL COMMENT '团长订单ID',
  `sold_count` int NOT NULL DEFAULT '0' COMMENT '已售数量',
  `total_stock` int NOT NULL DEFAULT '0' COMMENT '总库存',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `time_limit_hours` int NOT NULL DEFAULT '24' COMMENT '成团时限（小时）',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/SUCCESS/FAILED/CANCELLED',
  `completed_at` datetime DEFAULT NULL COMMENT '成团时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_group_buy_tenant` (`tenant_id`),
  KEY `idx_group_buy_status` (`status`),
  KEY `idx_group_buy_sku` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL COMMENT '活动ID',
  `group_size` int NOT NULL COMMENT '成团人数',
  `group_price` decimal(10,2) NOT NULL COMMENT '拼团价格',
  `original_price` decimal(10,2) NOT NULL COMMENT '原价',
  `time_limit_hours` int NOT NULL DEFAULT '24' COMMENT '成团时限（小时）',
  `auto_cancel` tinyint(1) NOT NULL DEFAULT '1' COMMENT '未成团是否自动取消',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`),
  CONSTRAINT `t_group_buy_activity_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `t_promotion_activity` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy_member` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '成员ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `team_id` bigint NOT NULL COMMENT '拼团组ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `is_leader` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否团长',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '购买数量',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单ID',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参团时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_buy_member_team_user` (`team_id`,`user_id`),
  KEY `idx_group_buy_member_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团成员表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy_participant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy_participant` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL COMMENT '拼团记录ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `order_no` varchar(64) DEFAULT NULL COMMENT '关联订单号',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参与时间',
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `t_group_buy_participant_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `t_group_buy_record` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团参与记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_no` varchar(32) NOT NULL COMMENT '团号',
  `activity_id` int NOT NULL COMMENT '活动ID',
  `product_id` int NOT NULL COMMENT '商品ID',
  `leader_user_id` int NOT NULL COMMENT '团长用户ID',
  `group_size` int NOT NULL COMMENT '成团人数',
  `current_size` int NOT NULL DEFAULT '1' COMMENT '当前人数',
  `group_price` decimal(10,2) NOT NULL COMMENT '拼团价格',
  `status` varchar(16) NOT NULL DEFAULT 'FORMING' COMMENT '状态（FORMING/SUCCESS/FAILED/CANCELLED）',
  `expire_at` datetime NOT NULL COMMENT '过期时间',
  `success_at` datetime DEFAULT NULL COMMENT '成团时间',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_no` (`group_no`),
  KEY `idx_group_no` (`group_no`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_leader` (`leader_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_group_buy_team`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_group_buy_team` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '拼团组ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `activity_id` bigint NOT NULL COMMENT '拼团活动ID',
  `name` varchar(128) DEFAULT NULL COMMENT '活动名称快照',
  `leader_id` bigint DEFAULT NULL COMMENT '团长用户ID',
  `leader_order_id` bigint DEFAULT NULL COMMENT '团长订单ID',
  `current_size` int NOT NULL DEFAULT '1' COMMENT '当前人数',
  `target_size` int NOT NULL DEFAULT '2' COMMENT '目标人数',
  `max_group_size` int NOT NULL DEFAULT '2' COMMENT '最大人数',
  `group_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '拼团价快照',
  `original_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '原价快照',
  `sku_id` bigint DEFAULT NULL COMMENT 'SKU ID',
  `sold_count` int NOT NULL DEFAULT '0' COMMENT '已售数量',
  `total_stock` int NOT NULL DEFAULT '0' COMMENT '总库存快照',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/SUCCESS/FAILED/CANCELLED',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `completed_at` datetime DEFAULT NULL COMMENT '成团时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_group_buy_team_activity` (`activity_id`),
  KEY `idx_group_buy_team_tenant` (`tenant_id`),
  KEY `idx_group_buy_team_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='拼团组表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_growth_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_growth_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `member_id` bigint unsigned NOT NULL COMMENT '会员ID',
  `type` varchar(16) NOT NULL COMMENT '类型：EARN获得/DEDUCT扣减',
  `change_growth` int NOT NULL COMMENT '变动成长值（正=获得，负=扣减）',
  `balance_growth` int NOT NULL COMMENT '变动后余额',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型：ORDER/CONSUME/SIGNUP/ACTIVITY',
  `source_id` varchar(64) DEFAULT NULL COMMENT '来源ID',
  `remark` varchar(256) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_type` (`type`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成长值明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_hardware_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_hardware_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL,
  `category` varchar(32) NOT NULL COMMENT 'customer_display/scale/cloud_speaker/unionpay',
  `config_json` text NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_category` (`tenant_id`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收银硬件配置(租户级)';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_hold_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_hold_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '挂单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `hold_no` varchar(64) NOT NULL COMMENT '挂单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户姓名',
  `customer_mobile` varchar(32) DEFAULT NULL COMMENT '客户手机号',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '挂单金额',
  `payload` json NOT NULL COMMENT '挂单草稿内容',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `status` varchar(32) NOT NULL DEFAULT 'HELD' COMMENT '状态：HELD/DELETED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hold_order_no` (`hold_no`),
  KEY `idx_hold_order_store_status` (`store_id`,`status`),
  KEY `idx_hold_order_created_at` (`created_at`),
  KEY `idx_t_hold_order_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='门店挂单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_hot_search`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_hot_search` (
  `id` int NOT NULL AUTO_INCREMENT,
  `keyword` varchar(64) NOT NULL COMMENT '热搜词',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用 0停用',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hot_search_tenant` (`tenant_id`),
  KEY `idx_hot_search_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序热搜词表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_balance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_balance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '库存余额ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `stock_type` varchar(32) NOT NULL DEFAULT 'OFFLINE' COMMENT '库存类型：ONLINE/OFFLINE',
  `physical_qty` int NOT NULL DEFAULT '0' COMMENT '物理库存',
  `locked_qty` int NOT NULL DEFAULT '0' COMMENT '锁定库存',
  `available_qty` int NOT NULL DEFAULT '0' COMMENT '可售库存',
  `version` bigint unsigned NOT NULL DEFAULT '0' COMMENT '乐观锁版本',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sku_name` varchar(128) DEFAULT NULL COMMENT 'SKU名称快照',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inventory_balance_store_sku_type` (`store_id`,`sku_id`,`stock_type`),
  KEY `idx_inventory_balance_sku_id` (`sku_id`),
  KEY `idx_inventory_balance_available_qty` (`available_qty`),
  KEY `idx_t_inventory_balance_tenant` (`tenant_id`),
  KEY `idx_tenant_ib` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存余额表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_batch` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `store_id` int NOT NULL COMMENT '门店ID',
  `sku_id` int NOT NULL COMMENT 'SKU ID',
  `batch_no` varchar(64) NOT NULL COMMENT '批次号',
  `quantity` int NOT NULL DEFAULT '0' COMMENT '批次数量',
  `locked_quantity` int NOT NULL DEFAULT '0' COMMENT '锁定数量',
  `production_date` date DEFAULT NULL COMMENT '生产日期',
  `expiry_date` date DEFAULT NULL COMMENT '过期日期',
  `cost_price` decimal(10,2) DEFAULT NULL COMMENT '成本价',
  `supplier_id` int DEFAULT NULL COMMENT '供应商ID',
  `inbound_order_id` int DEFAULT NULL COMMENT '入库单ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_batch_store_sku` (`store_id`,`sku_id`),
  KEY `idx_inventory_batch_batch_no` (`batch_no`),
  KEY `idx_inventory_batch_expiry_date` (`expiry_date`),
  KEY `idx_t_inventory_batch_tenant` (`tenant_id`),
  KEY `idx_tenant_ibat` (`tenant_id`),
  KEY `idx_inventory_batch_sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存批次表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_ledger` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '库存流水ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `ledger_no` varchar(64) NOT NULL COMMENT '库存流水号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `stock_type` varchar(32) NOT NULL COMMENT '库存类型：ONLINE/OFFLINE',
  `biz_type` varchar(64) NOT NULL COMMENT '业务类型：ORDER_LOCK/ORDER_PAY/ORDER_CANCEL/SALE/ADJUST',
  `biz_no` varchar(64) NOT NULL COMMENT '关联业务单号',
  `change_qty` int NOT NULL COMMENT '变动数量，增加为正，减少为负',
  `before_qty` int NOT NULL COMMENT '变动前物理库存',
  `after_qty` int NOT NULL COMMENT '变动后物理库存',
  `before_locked_qty` int NOT NULL DEFAULT '0' COMMENT '变动前锁定库存',
  `after_locked_qty` int NOT NULL DEFAULT '0' COMMENT '变动后锁定库存',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '操作人',
  `idempotency_key` varchar(128) NOT NULL COMMENT '幂等键',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inventory_ledger_no` (`ledger_no`),
  UNIQUE KEY `uk_inventory_ledger_idempotency` (`idempotency_key`),
  KEY `idx_inventory_ledger_store_sku` (`store_id`,`sku_id`),
  KEY `idx_inventory_ledger_biz_no` (`biz_no`),
  KEY `idx_inventory_ledger_created_at` (`created_at`),
  KEY `idx_t_inventory_ledger_tenant` (`tenant_id`),
  KEY `idx_tenant_il` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存流水表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_loss_gain`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_loss_gain` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `lg_no` varchar(32) NOT NULL COMMENT '损益编号',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `type` varchar(10) NOT NULL COMMENT '类型: LOSS/GAIN',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `qty` int NOT NULL COMMENT '数量',
  `cost_price` decimal(12,2) DEFAULT '0.00' COMMENT '成本价',
  `amount` decimal(12,2) DEFAULT '0.00' COMMENT '损益金额',
  `reason` varchar(200) DEFAULT NULL COMMENT '原因',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lg_no` (`lg_no`,`tenant_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_type` (`type`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存损益';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_loss_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_loss_order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loss_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报损单号',
  `store_id` int NOT NULL COMMENT '仓库/门店ID',
  `store_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '仓库/门店名称',
  `loss_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL' COMMENT '报损类型：NORMAL=正常报损 DAMAGE=破损 EXPIRED=过期 OTHER=其他',
  `total_qty` int NOT NULL DEFAULT '0' COMMENT '报损总数量',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '报损总金额',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 REJECTED=已驳回',
  `reason` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报损原因',
  `reject_reason` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '驳回原因',
  `operator_id` int DEFAULT NULL COMMENT '制单人ID',
  `operator_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '制单人姓名',
  `auditor_id` int DEFAULT NULL COMMENT '审核人ID',
  `auditor_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审核人姓名',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_loss_no_tenant` (`loss_no`,`tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报损单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_loss_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_loss_order_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loss_order_id` int NOT NULL COMMENT '报损单ID',
  `loss_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报损单号',
  `sku_id` int NOT NULL COMMENT '商品SKU ID',
  `sku_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU名称',
  `barcode` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '条码',
  `specification` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '规格',
  `unit_name` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '单位',
  `qty` int NOT NULL DEFAULT '0' COMMENT '报损数量',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成本单价',
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '小计金额',
  `loss_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报损原因明细',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_loss_order_id` (`loss_order_id`),
  KEY `idx_loss_no` (`loss_no`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报损单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_profit_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_profit_order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profit_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报溢单号',
  `store_id` int NOT NULL COMMENT '仓库/门店ID',
  `store_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '仓库/门店名称',
  `profit_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL' COMMENT '报溢类型：NORMAL=正常报溢 COUNT_DIFF=盘点差异 OTHER=其他',
  `total_qty` int NOT NULL DEFAULT '0' COMMENT '报溢总数量',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '报溢总金额',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 REJECTED=已驳回',
  `reason` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报溢原因',
  `reject_reason` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '驳回原因',
  `operator_id` int DEFAULT NULL COMMENT '制单人ID',
  `operator_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '制单人姓名',
  `auditor_id` int DEFAULT NULL COMMENT '审核人ID',
  `auditor_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审核人姓名',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_profit_no_tenant` (`profit_no`,`tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报溢单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_profit_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_profit_order_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profit_order_id` int NOT NULL COMMENT '报溢单ID',
  `profit_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '报溢单号',
  `sku_id` int NOT NULL COMMENT '商品SKU ID',
  `sku_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU名称',
  `barcode` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '条码',
  `specification` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '规格',
  `unit_name` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '单位',
  `qty` int NOT NULL DEFAULT '0' COMMENT '报溢数量',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成本单价',
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '小计金额',
  `profit_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报溢原因明细',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_profit_order_id` (`profit_order_id`),
  KEY `idx_profit_no` (`profit_no`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报溢单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_share_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_share_product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `spu_id` int NOT NULL COMMENT 'SPU ID',
  `spu_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SPU名称',
  `sku_id` int DEFAULT NULL COMMENT 'SKU ID（NULL表示全规格共享）',
  `sku_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SKU名称',
  `barcode` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '条码',
  `share_qty` int NOT NULL DEFAULT '0' COMMENT '共享数量',
  `min_keep_qty` int NOT NULL DEFAULT '0' COMMENT '最低保留数量',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：0=停用 1=启用',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_sku` (`tenant_id`,`spu_id`,`sku_id`),
  KEY `idx_spu_id` (`spu_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存共享商品表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_inventory_share_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_inventory_share_setting` (
  `id` int NOT NULL AUTO_INCREMENT,
  `share_enabled` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否启用库存共享：0=否 1=是',
  `auto_transfer` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否自动调拨：0=否 1=是',
  `auto_transfer_threshold` int NOT NULL DEFAULT '0' COMMENT '自动调拨阈值（低于此数量触发）',
  `share_scope` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL' COMMENT '共享范围：ALL=全部门店 指定门店=SPECIFIED',
  `specified_store_ids` text COLLATE utf8mb4_unicode_ci COMMENT '指定门店ID列表（JSON数组）',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存共享设置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_invoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_invoice` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(50) NOT NULL COMMENT '发票号',
  `invoice_type` varchar(10) NOT NULL COMMENT '类型: IN/OUT',
  `related_type` varchar(20) DEFAULT NULL COMMENT '关联业务类型',
  `related_no` varchar(32) DEFAULT NULL COMMENT '关联业务单号',
  `amount` decimal(12,2) NOT NULL COMMENT '金额',
  `tax_rate` decimal(4,2) DEFAULT '0.00' COMMENT '税率',
  `tax_amount` decimal(12,2) DEFAULT '0.00' COMMENT '税额',
  `issue_date` date DEFAULT NULL COMMENT '开票日期',
  `issuer` varchar(100) DEFAULT NULL COMMENT '开票方',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/ISSUED/VERIFIED',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_no` (`invoice_no`,`invoice_type`,`tenant_id`),
  KEY `idx_type` (`invoice_type`),
  KEY `idx_related` (`related_no`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='票据';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_level_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_level_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `level_name` varchar(20) NOT NULL COMMENT '等级名称',
  `min_points` int NOT NULL DEFAULT '0' COMMENT '最低积分',
  `max_points` int NOT NULL DEFAULT '0' COMMENT '最高积分',
  `discount_rate` decimal(4,2) DEFAULT '1.00' COMMENT '折扣率',
  `status` varchar(16) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled',
  `benefits` json DEFAULT NULL COMMENT '权益配置',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_level_name` (`level_name`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='等级配置';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_api_key`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_api_key` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `app_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '应用名称（如"某某ERP对接"）',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default' COMMENT '租户ID（隔离键）',
  `api_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'API Key（如 zk_live_XXXXXX）',
  `api_secret` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API Secret（bcrypt 加密存储）',
  `allowed_ips` json DEFAULT NULL COMMENT 'IP 白名单（JSON数组，空=不限）',
  `daily_limit` int NOT NULL DEFAULT '10000' COMMENT '每日调用次数限制',
  `qps` int NOT NULL DEFAULT '10' COMMENT 'QPS 限流档位（次/秒，档位 10/30/50）',
  `scopes` json DEFAULT NULL COMMENT '权限范围（JSON 数组，元素形如 domain+rw；空=最小权限）',
  `today_count` int NOT NULL DEFAULT '0' COMMENT '今日已调用次数（每日0点重置）',
  `last_called_at` datetime DEFAULT NULL COMMENT '最后调用时间',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=启用 0=禁用',
  `remark` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `prev_api_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '轮换并行期旧 AppKey（保留 7 天）',
  `prev_api_secret` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '轮换并行期旧 AppSecret（bcrypt 存储）',
  `rotate_expire_at` datetime DEFAULT NULL COMMENT '轮换并行期截止时间（到期旧密钥失效；非空且未过期=轮换中）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_key` (`api_key`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Open API 密钥表（外部平台对接用）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_brand`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_brand` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '品牌名称（如"茅台集团"）',
  `logo` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌 LOGO URL',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌简介',
  `origin_country` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌所属国家/地区',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序值（越小越靠前）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=启用 0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `auth_letter_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌授权书文件 URL（NULL=未上传）',
  `auth_expired_at` datetime DEFAULT NULL COMMENT '授权有效期截止（NULL=未设置，不造默认值）',
  `auth_status` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '授权状态 AUTHORIZED/EXPIRED/NONE（NULL=未设置）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_status_sort` (`status`,`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库品牌表（平台级）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_call_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_call_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '发起调取的租户ID（逻辑引用 t_tenant.id，不建物理外键）',
  `library_spu_id` bigint unsigned NOT NULL COMMENT '被调取的平台商品库SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  `library_spu_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台编码快照（t_library_spu.spu_code，主数据删除后流水仍可读）',
  `library_spu_name` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '商品名称快照（t_library_spu.name，主数据删除后流水仍可读）',
  `spu_id` bigint unsigned NOT NULL COMMENT '本次生成的租户私有SPU ID（逻辑引用 t_product_spu.id，不建物理外键）',
  `sku_count` int NOT NULL DEFAULT '0' COMMENT '本次复制的SKU条数',
  `call_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'COPY' COMMENT '调取类型：COPY-单条调取/BATCH_COPY-批量调取（取值由后端常量定义，不用数据库枚举）',
  `operator_id` int unsigned DEFAULT NULL COMMENT '操作人ID（逻辑引用 t_sys_user.id，不建物理外键；NULL=未记录）',
  `operator_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '操作人名称快照（NULL=未记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '调取时间（成功写流水的时间点）',
  PRIMARY KEY (`id`),
  KEY `idx_call_created_tenant` (`created_at`,`tenant_id`),
  KEY `idx_call_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_call_spu_tenant` (`library_spu_id`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品库调取流水（COPY 复制式调取，一次成功调取一行；SCAN/API 查询不计入本表）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_sku`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_sku` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spu_id` bigint unsigned NOT NULL COMMENT '所属 SPU ID（关联 t_library_spu）',
  `sku_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU 编码',
  `barcode` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '条码（EAN-13/UPC），扫码入口',
  `sku_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU 名称（如"500ml 光瓶装"）',
  `volume` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '净含量（如"500ml"）',
  `packaging` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '包装类型（光瓶/礼盒/罐装/桶装）',
  `base_unit` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '基础单位（瓶/罐）',
  `box_unit` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '组合单位（箱）',
  `box_ratio` int DEFAULT NULL COMMENT '箱瓶比（1箱=N瓶）',
  `sku_image` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SKU 实物图 URL',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_barcode` (`barcode`),
  UNIQUE KEY `uk_sku_code` (`sku_code`),
  KEY `idx_spu_id` (`spu_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库 SKU 表（条码为扫码唯一入口）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_spu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_spu` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spu_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SPU 编码（如 SPU20260728001）',
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名称（如"茅台 飞天 53度"）',
  `brand_id` bigint NOT NULL COMMENT '品牌 ID（关联 t_library_brand）',
  `specs` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '规格（如"500ml×6瓶/箱"）',
  `unit` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '基本计量单位（瓶/箱/罐）',
  `main_image` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主图 URL',
  `image_urls` json DEFAULT NULL COMMENT '轮播图 URL 数组',
  `properties` json DEFAULT NULL COMMENT '扩展属性（酒精度/产地/香型/等级/年份/原料）',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品简介',
  `detail` text COLLATE utf8mb4_unicode_ci COMMENT '商品详情（富文本 HTML）',
  `suggested_retail_price` decimal(10,2) DEFAULT NULL COMMENT '建议零售价（仅参考）',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED/OFFLINE',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OFFICIAL' COMMENT '数据来源：OFFICIAL/BARCODE_API/ECOMMERCE/MERCHANT/SUPPLIER',
  `submit_count` int NOT NULL DEFAULT '0' COMMENT '被商户提交次数',
  `hit_count` int NOT NULL DEFAULT '0' COMMENT '被扫码命中次数',
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人 ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_spu_code` (`spu_code`),
  UNIQUE KEY `uk_name_brand_specs` (`name`,`brand_id`,`specs`),
  KEY `idx_brand_id` (`brand_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库 SPU 表（平台级，不含 tenant_id，不含 category_id）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_library_spu_review_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_library_spu_review_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spu_id` bigint unsigned NOT NULL COMMENT 'SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  `action` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '动作：SUBMIT-提交审核/APPROVE-审核通过/REJECT-审核驳回/OFFLINE-下架',
  `from_status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '流转前状态（NULL=无前置状态）',
  `to_status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '流转后状态',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  `operator_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '操作人名称（NULL=未记录）',
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '操作原因或驳回理由（NULL=未填写）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_spu_created` (`spu_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品库SPU审核流水（C6-2-T5，纯 DDL 零预置数据）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_limited_discount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_limited_discount` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `activity_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动编码',
  `activity_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动名称',
  `activity_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '活动描述',
  `discount_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERCENT' COMMENT '折扣类型: PERCENT/FIXED',
  `discount_value` decimal(10,2) NOT NULL COMMENT '折扣值(百分比/固定金额)',
  `min_purchase` decimal(10,2) DEFAULT '0.00' COMMENT '最低购买金额',
  `applicable_scope` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL' COMMENT '适用范围: ALL/CATEGORY/PRODUCT',
  `applicable_ids` json DEFAULT NULL COMMENT '适用范围ID列表',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `total_stock` int NOT NULL DEFAULT '0' COMMENT '活动总库存',
  `available_stock` int NOT NULL DEFAULT '0' COMMENT '剩余可用库存',
  `limit_per_user` int DEFAULT NULL COMMENT '每人限购',
  `per_order_limit` int DEFAULT NULL COMMENT '每单限购',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PENDING/ACTIVE/PAUSED/ENDED/SOLD_OUT',
  `participant_count` int NOT NULL DEFAULT '0' COMMENT '参与人数',
  `total_sales_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '销售总额',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_by` bigint DEFAULT NULL COMMENT '创建人',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_time_range` (`start_time`,`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限时折扣活动';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_limited_discount_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_limited_discount_product` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `discount_id` bigint NOT NULL COMMENT '活动ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `sku_id` bigint DEFAULT NULL COMMENT 'SKU ID',
  `original_price` decimal(10,2) NOT NULL COMMENT '原价',
  `discount_price` decimal(10,2) NOT NULL COMMENT '折扣价',
  `stock` int NOT NULL DEFAULT '0' COMMENT '活动库存',
  `sold_count` int NOT NULL DEFAULT '0' COMMENT '已售数量',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_discount_id` (`discount_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限时折扣参与商品';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_marketing_asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_marketing_asset` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL COMMENT '素材名称',
  `type` varchar(32) NOT NULL COMMENT '类型：IMAGE/VIDEO/COPYWRITING',
  `url` varchar(500) DEFAULT NULL COMMENT '素材URL',
  `thumbnail_url` varchar(500) DEFAULT NULL COMMENT '缩略图URL',
  `content` text COMMENT '文案内容',
  `category` varchar(64) DEFAULT NULL COMMENT '分类',
  `tags` json DEFAULT NULL COMMENT '标签',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小(字节)',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='营销素材表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_marketing_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_marketing_material` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `material_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材编码',
  `material_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材名称',
  `material_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '素材描述',
  `material_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材类型: IMAGE/VIDEO/DOCUMENT/HTML',
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件URL',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小(字节)',
  `file_format` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件格式',
  `image_width` int DEFAULT NULL COMMENT '图片宽度',
  `image_height` int DEFAULT NULL COMMENT '图片高度',
  `category_id` bigint DEFAULT NULL COMMENT '分类ID',
  `tags` json DEFAULT NULL COMMENT '标签',
  `usage_scene` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '使用场景: POSTER/COUPON_BG/SECKILL_BG/WECHAT_ARTICLE/OTHER',
  `related_activity_id` bigint DEFAULT NULL COMMENT '关联活动ID',
  `related_activity_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关联活动类型',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PUBLISHED/ARCHIVED',
  `download_count` int NOT NULL DEFAULT '0' COMMENT '下载次数',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '查看次数',
  `use_count` int NOT NULL DEFAULT '0' COMMENT '使用次数',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_type` (`material_type`),
  KEY `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销素材';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_marketing_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_marketing_operation_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module` varchar(32) NOT NULL COMMENT '模块（coupon/promotion/seckill/group_buy）',
  `action` varchar(32) NOT NULL COMMENT '操作类型',
  `target_id` varchar(64) NOT NULL COMMENT '目标ID',
  `target_type` varchar(32) NOT NULL COMMENT '目标类型',
  `user_id` int DEFAULT NULL COMMENT '操作人ID',
  `user_name` varchar(64) DEFAULT NULL COMMENT '操作人姓名',
  `detail` varchar(500) DEFAULT NULL COMMENT '操作详情',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_module` (`module`),
  KEY `idx_target` (`target_id`,`target_type`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='营销操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_material_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_material_category` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `parent_id` bigint DEFAULT NULL COMMENT '父分类ID',
  `sort_order` int NOT NULL DEFAULT '0',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材分类';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_member` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '会员ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `openid` varchar(128) DEFAULT NULL COMMENT '微信openid',
  `unionid` varchar(128) DEFAULT NULL COMMENT '微信unionid',
  `mobile` varchar(20) NOT NULL COMMENT '手机号',
  `address` varchar(255) DEFAULT NULL COMMENT '客户地址',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `name` varchar(64) DEFAULT NULL COMMENT '客户名称',
  `contact` varchar(64) DEFAULT NULL COMMENT '联系人',
  `avatar` varchar(512) DEFAULT NULL COMMENT '头像URL',
  `nickname` varchar(64) DEFAULT NULL COMMENT '昵称',
  `gender` tinyint DEFAULT '0' COMMENT '性别：0未知 1男 2女',
  `birthday` date DEFAULT NULL COMMENT '生日',
  `customer_type` varchar(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份：RETAIL/WHOLESALE',
  `settlement_type` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  `staff_id` bigint unsigned DEFAULT NULL COMMENT '归属销售员ID',
  `points` int NOT NULL DEFAULT '0' COMMENT '积分',
  `growth_value` int NOT NULL DEFAULT '0' COMMENT '成长值',
  `level_code` varchar(32) DEFAULT NULL COMMENT '会员等级',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1正常，0禁用',
  `last_order_at` datetime DEFAULT NULL COMMENT '最近下单时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `password_hash` varchar(255) DEFAULT NULL COMMENT '密码哈希（自助注册会员）',
  `register_source` varchar(32) DEFAULT 'ADMIN' COMMENT '注册来源（ADMIN/SELF_REGISTER/INVITATION）',
  `card_no` varchar(32) DEFAULT NULL COMMENT '会员卡号',
  `province` varchar(32) DEFAULT NULL COMMENT '省份',
  `city` varchar(32) DEFAULT NULL COMMENT '城市',
  `district` varchar(32) DEFAULT NULL COMMENT '区/县',
  `tags` varchar(255) DEFAULT NULL COMMENT '标签,逗号分隔',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_mobile` (`mobile`),
  UNIQUE KEY `uk_member_openid` (`openid`),
  KEY `idx_member_customer_type` (`customer_type`,`status`),
  KEY `idx_member_staff_id` (`staff_id`),
  KEY `idx_t_member_tenant` (`tenant_id`),
  KEY `idx_member_address` (`address`(50)),
  KEY `idx_member_status` (`status`),
  KEY `idx_member_type_status` (`customer_type`,`status`),
  KEY `idx_member_mobile` (`mobile`),
  KEY `idx_member_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会员客户表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_member_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_member_level` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '等级ID',
  `level_code` varchar(32) NOT NULL COMMENT '等级编码',
  `level_name` varchar(64) NOT NULL COMMENT '等级名称',
  `level_icon` varchar(256) DEFAULT NULL COMMENT '等级图标',
  `min_points` int NOT NULL DEFAULT '0' COMMENT '最低积分',
  `min_growth` int NOT NULL DEFAULT '0' COMMENT '最低成长值',
  `discount_rate` decimal(5,2) NOT NULL DEFAULT '100.00' COMMENT '折扣率（%）',
  `birthday_gift` decimal(10,2) DEFAULT '0.00' COMMENT '生日礼金额',
  `free_shipping_amount` decimal(10,2) DEFAULT '0.00' COMMENT '免邮门槛',
  `point_ratio` int NOT NULL DEFAULT '1' COMMENT '积分倍率（消费1元获得积分）',
  `description` varchar(500) DEFAULT NULL COMMENT '等级权益描述',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用 0禁用',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `level_code` (`level_code`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会员等级配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_member_sms_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_member_sms_code` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mobile` varchar(20) NOT NULL COMMENT '手机号',
  `code` varchar(8) NOT NULL COMMENT '验证码',
  `purpose` varchar(32) NOT NULL DEFAULT 'REGISTER' COMMENT '用途（REGISTER/RESET_PASSWORD）',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `used` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已使用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mobile_code` (`mobile`,`code`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会员短信验证码表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL,
  `platform` varchar(20) NOT NULL COMMENT 'WECHAT/ALIPAY/DOUYIN/KUAISHOU',
  `app_id` varchar(64) NOT NULL DEFAULT '' COMMENT '小程序 AppID（来自公众平台/开放平台）',
  `app_secret` varchar(512) NOT NULL DEFAULT '' COMMENT 'AppSecret（加密存储）',
  `app_name` varchar(64) NOT NULL DEFAULT '' COMMENT '小程序名称',
  `app_description` varchar(255) NOT NULL DEFAULT '' COMMENT '小程序描述',
  `app_icon` varchar(512) NOT NULL DEFAULT '' COMMENT '小程序图标URL',
  `app_version` varchar(20) NOT NULL DEFAULT '' COMMENT '应用版本号',
  `template_id` int DEFAULT NULL COMMENT '关联 miniapp_template.id',
  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'draft/published',
  `audit_status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/submitted/approved/rejected',
  `audit_reason` varchar(512) NOT NULL DEFAULT '' COMMENT '审核原因/备注',
  `publish_version` varchar(20) NOT NULL DEFAULT '' COMMENT '发布版本号',
  `published_at` datetime DEFAULT NULL,
  `contact_name` varchar(64) NOT NULL DEFAULT '' COMMENT '联系人姓名',
  `contact_email` varchar(128) NOT NULL DEFAULT '' COMMENT '联系人邮箱',
  `contact_phone` varchar(32) NOT NULL DEFAULT '' COMMENT '联系人电话',
  `domain_whitelist` json DEFAULT NULL COMMENT '域名白名单 ["url1","url2"]',
  `business_domain` json DEFAULT NULL COMMENT '业务域名',
  `webview_domain` json DEFAULT NULL COMMENT 'webview域名',
  `qrcode_url` varchar(512) NOT NULL DEFAULT '' COMMENT '小程序码URL',
  `privacy_url` varchar(512) NOT NULL DEFAULT '' COMMENT '隐私协议URL',
  `service_agreement_url` varchar(512) NOT NULL DEFAULT '' COMMENT '服务协议URL',
  `required_privacy_setting` tinyint NOT NULL DEFAULT '0' COMMENT '是否强制隐私设置',
  `allow_guest` tinyint NOT NULL DEFAULT '1' COMMENT '允许游客访问',
  `allow_location` tinyint NOT NULL DEFAULT '1' COMMENT '允许获取位置',
  `allow_phone` tinyint NOT NULL DEFAULT '1' COMMENT '允许获取手机号',
  `allow_share` tinyint NOT NULL DEFAULT '1' COMMENT '允许分享',
  `allow_subscribe` tinyint NOT NULL DEFAULT '1' COMMENT '允许订阅消息',
  `allow_payment` tinyint NOT NULL DEFAULT '1' COMMENT '允许支付',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_platform` (`tenant_id`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序平台配置';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '订单号',
  `member_id` bigint unsigned NOT NULL COMMENT '会员ID',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_type` varchar(32) NOT NULL COMMENT '下单时客户身份：RETAIL/WHOLESALE',
  `fulfillment_type` varchar(32) NOT NULL COMMENT '履约方式：DELIVERY/PICKUP',
  `order_status` varchar(32) NOT NULL DEFAULT 'PENDING_PAYMENT' COMMENT '订单状态',
  `pay_status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态',
  `settlement_type` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  `delivery_status` varchar(32) NOT NULL DEFAULT 'WAITING' COMMENT '配送状态：WAITING/DELIVERING/COMPLETED/REJECTED/CANCELLED',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应付金额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已付金额',
  `receiver_name` varchar(64) DEFAULT NULL COMMENT '收货人',
  `receiver_mobile` varchar(20) DEFAULT NULL COMMENT '收货手机号',
  `receiver_address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `remark` varchar(255) DEFAULT NULL COMMENT '用户备注',
  `internal_remark` varchar(255) DEFAULT NULL COMMENT '门店内部备注',
  `expire_at` datetime DEFAULT NULL COMMENT '支付过期时间',
  `paid_at` datetime DEFAULT NULL COMMENT '支付完成时间',
  `completed_at` datetime DEFAULT NULL COMMENT '订单完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `shipping_fee` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '运费',
  `deleted_at` datetime DEFAULT NULL COMMENT '删除时间（软删，列表过滤）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_miniapp_order_no` (`order_no`),
  KEY `idx_miniapp_order_member_id` (`member_id`),
  KEY `idx_miniapp_order_store_status` (`store_id`,`order_status`),
  KEY `idx_miniapp_order_created_at` (`created_at`),
  KEY `idx_t_miniapp_order_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_order_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '订单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT '下单时SKU名称',
  `qty` int NOT NULL COMMENT '数量，单位瓶',
  `reserved_qty` int NOT NULL DEFAULT '0' COMMENT '已占用库存数量，单位瓶',
  `unreserved_qty` int NOT NULL DEFAULT '0' COMMENT '未占用数量，单位瓶',
  `unit_price` decimal(12,2) NOT NULL COMMENT '成交单价',
  `price_type` varchar(32) NOT NULL COMMENT '价格类型：RETAIL/WHOLESALE/MINIAPP/STORE',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计',
  `trace_required` tinyint NOT NULL DEFAULT '0' COMMENT '是否需要追溯',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_miniapp_order_item_order_no` (`order_no`),
  KEY `idx_miniapp_order_item_sku_id` (`sku_id`),
  KEY `idx_t_miniapp_order_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序订单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_order_sync_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_order_sync_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '订单号',
  `platform_order_no` varchar(64) DEFAULT NULL COMMENT '平台订单号',
  `platform` varchar(32) NOT NULL COMMENT '平台',
  `sync_type` varchar(32) NOT NULL COMMENT '同步类型：STATUS/SKU/PRICE/STOCK',
  `sync_direction` varchar(32) NOT NULL COMMENT '方向：PUSH_TO_PLATFORM/PULL_FROM_PLATFORM',
  `request_data` json DEFAULT NULL COMMENT '请求数据',
  `response_data` json DEFAULT NULL COMMENT '响应数据',
  `response` text COMMENT '同步响应内容',
  `status` varchar(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  `error_msg` varchar(512) DEFAULT NULL COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_platform` (`platform`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`),
  KEY `idx_sync_log_tenant` (`tenant_id`),
  KEY `idx_sync_log_platform_order_no` (`platform_order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序订单同步日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_publish_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_publish_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL,
  `platform` varchar(20) NOT NULL DEFAULT 'WECHAT',
  `template_id` int DEFAULT NULL,
  `action` varchar(20) NOT NULL COMMENT 'publish/update/offline',
  `version` varchar(20) NOT NULL DEFAULT '',
  `result` varchar(20) NOT NULL COMMENT 'success/failed',
  `remark` varchar(512) NOT NULL DEFAULT '' COMMENT '发布备注',
  `status` varchar(20) NOT NULL DEFAULT '' COMMENT '状态: published/rollback/audit_submitted',
  `error_msg` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_platform` (`tenant_id`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序发布日志';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_miniapp_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_miniapp_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL DEFAULT 'DEFAULT' COMMENT '租户ID（DEFAULT=全局模板）',
  `name` varchar(64) NOT NULL COMMENT '模板名称',
  `description` varchar(255) NOT NULL DEFAULT '' COMMENT '模板描述',
  `thumbnail` varchar(512) NOT NULL DEFAULT '' COMMENT '缩略图URL',
  `preview_urls` json DEFAULT NULL COMMENT '预览截图URL列表 ["url1","url2"]',
  `style_config` json NOT NULL COMMENT '样式配置: {primaryColor, backgroundColor, ...}',
  `page_config` json NOT NULL COMMENT '页面配置: {homeLayout, productCardStyle, ...}',
  `version` varchar(20) NOT NULL DEFAULT '1.0.0',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active/inactive',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序模板';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_notification` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `recipient_id` bigint unsigned NOT NULL COMMENT '接收人ID',
  `recipient_type` enum('ADMIN','MERCHANT','CONSUMER') NOT NULL DEFAULT 'ADMIN' COMMENT '接收人类型',
  `title` varchar(200) NOT NULL COMMENT '通知标题',
  `content` text COMMENT '通知内容',
  `type` enum('SYSTEM','ORDER','PAYMENT','ALERT','CREDIT','RECALL') NOT NULL DEFAULT 'SYSTEM' COMMENT '通知类型',
  `related_id` bigint DEFAULT NULL COMMENT '关联业务ID',
  `related_type` varchar(50) DEFAULT NULL COMMENT '关联业务类型',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已读',
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `read_at` datetime DEFAULT NULL COMMENT '阅读时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_recipient` (`recipient_id`,`recipient_type`),
  KEY `idx_notification_type` (`type`),
  KEY `idx_notification_is_read` (`is_read`),
  KEY `idx_notification_sent_at` (`sent_at`),
  KEY `idx_t_notification_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统通知表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_open_api_call_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_open_api_call_daily` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `api_key_id` bigint unsigned NOT NULL COMMENT '密钥ID（t_library_api_key.id，不建外键）',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default' COMMENT '租户ID（冗余，便于隔离查询）',
  `stat_date` date NOT NULL COMMENT '统计日期（天粒度）',
  `call_count` int NOT NULL DEFAULT '0' COMMENT '当日调用次数',
  `error_count` int NOT NULL DEFAULT '0' COMMENT '当日错误次数（非 2xx）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_key_date` (`api_key_id`,`stat_date`),
  KEY `idx_tenant_date` (`tenant_id`,`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 API 调用量日聚合';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_open_webhook`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_open_webhook` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default' COMMENT '租户ID（隔离键）',
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '事件类型码（对齐开放平台事件目录，如 order.created）',
  `callback_url` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '回调地址（https，禁内网段）',
  `sign_secret` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '签名密钥（bcrypt 存储，创建时一次性下发明文）',
  `retry_policy` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1m/5m/30m x3' COMMENT '重试策略（指数退避 1/5/30 分钟，共 3 次）',
  `pause_threshold` int NOT NULL DEFAULT '10' COMMENT '连续失败自动暂停阈值（次）',
  `paused` tinyint NOT NULL DEFAULT '0' COMMENT '是否暂停：1=已暂停 0=生效中',
  `last_trigger_at` datetime DEFAULT NULL COMMENT '最近触发时间',
  `last_status` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '最近触发状态：OK/FAIL',
  `last_error` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '最近失败原因（超时/连接失败/非 2xx）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_event` (`tenant_id`,`event_type`),
  KEY `idx_paused` (`paused`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 Webhook 事件订阅';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_open_webhook_delivery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_open_webhook_delivery` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `subscription_id` bigint unsigned NOT NULL COMMENT '订阅ID（t_open_webhook.id，不建外键）',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default' COMMENT '租户ID（冗余，便于隔离查询）',
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '事件类型码',
  `payload` json DEFAULT NULL COMMENT '推送报文',
  `attempt` tinyint NOT NULL DEFAULT '1' COMMENT '第几次尝试（自动 ≤3，手动重推递增）',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '投递结果：OK/FAIL',
  `http_status` int DEFAULT NULL COMMENT '对端 HTTP 状态码',
  `error` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '失败原因',
  `triggered_by` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AUTO' COMMENT '触发方式：AUTO/MANUAL/TEST',
  `duration_ms` int DEFAULT NULL COMMENT '耗时（毫秒）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '投递时间',
  PRIMARY KEY (`id`),
  KEY `idx_sub_created` (`subscription_id`,`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 Webhook 投递记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_operation_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(64) DEFAULT NULL COMMENT '操作人名称',
  `module` varchar(64) NOT NULL COMMENT '模块',
  `action` varchar(64) NOT NULL COMMENT '动作',
  `biz_no` varchar(64) DEFAULT NULL COMMENT '业务单号',
  `before_data` json DEFAULT NULL COMMENT '变更前数据',
  `after_data` json DEFAULT NULL COMMENT '变更后数据',
  `ip` varchar(64) DEFAULT NULL COMMENT 'IP',
  `user_agent` varchar(512) DEFAULT NULL COMMENT '用户代理',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `log_no` varchar(64) DEFAULT NULL COMMENT '日志编号',
  `user_id` bigint unsigned DEFAULT NULL COMMENT '操作人ID(与operator_id同义,多服务写入)',
  `user_name` varchar(64) DEFAULT NULL COMMENT '操作人姓名(与operator_name同义)',
  `target_id` varchar(64) DEFAULT NULL COMMENT '业务对象ID',
  `target_type` varchar(32) DEFAULT NULL COMMENT '业务对象类型',
  `detail` varchar(500) DEFAULT NULL COMMENT '操作详情',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `target` varchar(255) DEFAULT NULL COMMENT '目标(价格越权审计)',
  `category` varchar(32) DEFAULT NULL COMMENT '类别(价格越权审计)',
  PRIMARY KEY (`id`),
  KEY `idx_operation_log_operator_id` (`operator_id`),
  KEY `idx_operation_log_module_action` (`module`,`action`),
  KEY `idx_operation_log_biz_no` (`biz_no`),
  KEY `idx_operation_log_created_at` (`created_at`),
  KEY `idx_t_operation_log_tenant` (`tenant_id`),
  KEY `idx_operation_log_user_id` (`user_id`),
  KEY `idx_operation_log_target` (`target_type`,`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_coupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_coupon` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `coupon_id` bigint NOT NULL COMMENT '优惠券ID（t_user_coupon.id）',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `order_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '订单金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_coupon` (`coupon_id`,`order_id`),
  KEY `idx_order_coupon_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单优惠券关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_exception`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_exception` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '异常ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `exception_no` varchar(64) NOT NULL COMMENT '异常编号',
  `exception_level` varchar(16) NOT NULL DEFAULT 'WARNING' COMMENT '级别：WARNING/ERROR/CRITICAL',
  `channel_order_no` varchar(64) DEFAULT NULL COMMENT '渠道订单号',
  `channel_type` varchar(32) DEFAULT NULL COMMENT '渠道类型',
  `exception_type` varchar(32) NOT NULL DEFAULT 'OTHER' COMMENT '异常类型',
  `exception_detail` varchar(1000) DEFAULT NULL COMMENT '异常详情',
  `handle_status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/RESOLVED/CLOSED',
  `handler_id` bigint DEFAULT NULL COMMENT '处理人ID',
  `handler_name` varchar(64) DEFAULT NULL COMMENT '处理人姓名',
  `handle_result` varchar(1000) DEFAULT NULL COMMENT '处理结果',
  `handled_at` datetime DEFAULT NULL COMMENT '处理时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exception_no` (`exception_no`,`tenant_id`),
  KEY `idx_exception_status` (`tenant_id`,`handle_status`),
  KEY `idx_exception_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单异常记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_exception_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_exception_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `exception_id` bigint NOT NULL COMMENT '异常ID',
  `handler_name` varchar(64) DEFAULT NULL COMMENT '处理人',
  `action` varchar(64) NOT NULL COMMENT '动作',
  `result` varchar(500) DEFAULT NULL COMMENT '结果',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exception_log` (`exception_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单异常处理日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_routing_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_routing_rule` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `rule_name` varchar(128) NOT NULL COMMENT '规则名称',
  `channel_type` varchar(32) NOT NULL COMMENT '渠道类型',
  `store_id` bigint DEFAULT NULL COMMENT '目标门店ID',
  `store_name` varchar(128) DEFAULT NULL COMMENT '目标门店名称',
  `priority` int NOT NULL DEFAULT '0' COMMENT '优先级',
  `condition_summary` varchar(500) DEFAULT NULL COMMENT '条件摘要',
  `action_type` varchar(32) NOT NULL DEFAULT 'ASSIGN_STORE' COMMENT '动作类型',
  `is_enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_tenant_channel` (`tenant_id`,`channel_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单路由规则表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_timeout_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_timeout_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单类型：SALE=销售单 PURCHASE=采购单',
  `timeout_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '超时类型：WAIT_PAY=待付款 WAIT_ACCEPT=待接单 WAIT_SIGN=待签收 WAIT_CONFIRM=待确认',
  `timeout_minutes` int NOT NULL COMMENT '超时分钟数',
  `action` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '超时动作：CANCEL=自动取消 AUTO_ACCEPT=自动接单 AUTO_SIGN=自动签收',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1=启用 0=禁用',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置说明',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_enabled` (`tenant_id`,`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单超时配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_order_timeout_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_timeout_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL COMMENT '订单ID',
  `order_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单类型',
  `timeout_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '超时类型',
  `action_taken` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '执行动作',
  `triggered_at` datetime NOT NULL COMMENT '触发时间',
  `handled_at` datetime NOT NULL COMMENT '处理时间',
  `result` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '处理结果：SUCCESS=成功 FAILED=失败',
  `remark` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_timeout` (`order_id`,`timeout_type`),
  KEY `idx_tenant_triggered` (`tenant_id`,`triggered_at`),
  KEY `idx_result` (`result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单超时处理日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payable` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(100) DEFAULT NULL COMMENT '供应商名称',
  `source_type` varchar(20) NOT NULL COMMENT '来源类型: PURCHASE_ORDER/EXPENSE/OTHER',
  `source_no` varchar(32) NOT NULL COMMENT '来源单号',
  `payable_amount` decimal(12,2) NOT NULL COMMENT '应付金额',
  `paid_amount` decimal(12,2) DEFAULT '0.00' COMMENT '已付金额',
  `balance` decimal(12,2) DEFAULT '0.00' COMMENT '余额',
  `due_date` date DEFAULT NULL COMMENT '到期日',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PARTIAL/PAID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_supplier` (`supplier_id`),
  KEY `idx_source` (`source_no`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应付记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `payment_no` varchar(32) NOT NULL COMMENT '付款单号',
  `supplier_id` bigint NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(100) DEFAULT NULL COMMENT '供应商名称',
  `payment_type` varchar(20) NOT NULL DEFAULT 'PURCHASE' COMMENT '类型: PURCHASE/EXPENSE/OTHER',
  `amount` decimal(12,2) NOT NULL COMMENT '付款金额',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '付款方式',
  `bank_account_id` bigint DEFAULT NULL COMMENT '银行账户ID',
  `paid_date` date DEFAULT NULL COMMENT '付款日期',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/VOIDED',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_no` (`payment_no`,`tenant_id`),
  KEY `idx_supplier` (`supplier_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='付款单';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payment_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) NOT NULL,
  `provider` varchar(20) NOT NULL COMMENT 'wechat/alipay/unionpay',
  `config_key` varchar(64) NOT NULL DEFAULT '' COMMENT '兼容 key-value 旧结构，扁平结构下恒为空',
  `config_value` text COMMENT '兼容 key-value 旧结构，扁平结构下恒为 NULL',
  `is_encrypted` tinyint NOT NULL DEFAULT '0' COMMENT '是否加密存储',
  `description` varchar(255) NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `api_key` varchar(128) NOT NULL DEFAULT '' COMMENT '微信支付 APIv2 密钥（付款码反扫支付）',
  `box_config` text COMMENT '收款盒子配置(JSON：服务商/激活码/串口参数)',
  `app_id` varchar(128) NOT NULL DEFAULT '' COMMENT '支付 AppID',
  `mch_id` varchar(64) NOT NULL DEFAULT '' COMMENT '商户号',
  `api_v3_key` varchar(256) NOT NULL DEFAULT '' COMMENT 'API v3 密钥',
  `serial_no` varchar(64) NOT NULL DEFAULT '' COMMENT '证书序列号',
  `private_key` text COMMENT '商户私钥(PEM)',
  `notify_url` varchar(512) NOT NULL DEFAULT '' COMMENT '支付回调地址',
  `alipay_public_key` text COMMENT '支付宝公钥',
  `enabled` tinyint NOT NULL DEFAULT '0' COMMENT '是否启用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_provider_key` (`tenant_id`,`provider`,`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付渠道配置';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment_method` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `method_code` varchar(32) NOT NULL COMMENT '支付方式编码：CASH/WECHAT/ALIPAY/TRANSFER',
  `method_name` varchar(64) NOT NULL COMMENT '支付方式名称',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_method_tenant_code` (`tenant_id`,`method_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付方式表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payment_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '支付单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `pay_no` varchar(64) NOT NULL COMMENT '支付单号',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL/COLLECTION_LINK',
  `source_no` varchar(64) NOT NULL COMMENT '来源单号',
  `channel` varchar(32) NOT NULL DEFAULT 'WECHAT' COMMENT '支付渠道',
  `amount` decimal(12,2) NOT NULL COMMENT '支付金额',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '支付状态：PENDING/SUCCESS/FAILED/CLOSED/REFUNDED',
  `wx_prepay_id` varchar(128) DEFAULT NULL COMMENT '微信预支付ID',
  `wx_transaction_id` varchar(128) DEFAULT NULL COMMENT '微信交易号',
  `callback_raw` json DEFAULT NULL COMMENT '回调原文',
  `paid_at` datetime DEFAULT NULL COMMENT '支付成功时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `auth_code` varchar(64) NOT NULL DEFAULT '' COMMENT '付款码/授权码（反扫留痕，脱敏展示）',
  `payment_method` varchar(32) NOT NULL DEFAULT '' COMMENT '支付方式',
  `processing` tinyint NOT NULL DEFAULT '0' COMMENT '处理中标记',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '实付金额',
  `transaction_id` varchar(128) NOT NULL DEFAULT '' COMMENT '渠道交易号',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_order_pay_no` (`pay_no`),
  UNIQUE KEY `uk_payment_order_wx_transaction_id` (`wx_transaction_id`),
  KEY `idx_payment_order_source` (`source_type`,`source_no`),
  KEY `idx_payment_order_status` (`status`),
  KEY `idx_t_payment_order_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_payment_writeoff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment_writeoff` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `payment_id` bigint NOT NULL COMMENT '付款单ID',
  `payable_id` bigint NOT NULL COMMENT '应付记录ID',
  `writeoff_amount` decimal(12,2) NOT NULL COMMENT '核销金额',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment` (`payment_id`),
  KEY `idx_payable` (`payable_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='付款核销';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_addon_charge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_addon_charge` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `charge_no` varchar(64) NOT NULL COMMENT '扣费单号（shared/id.makeBizNo）',
  `item` varchar(32) NOT NULL COMMENT '增值项：STORAGE/API/SMS',
  `quantity` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT '超出用量（口径随 item：STORAGE=GB、API=次、SMS=条）',
  `unit_price` decimal(12,4) DEFAULT NULL COMMENT '单价快照（元/4位小数，来自 billing:addon_price；NULL=单价未配置）',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '扣费金额（元/2位小数；单价未配置时为 NULL，不出账）',
  `period_start` date DEFAULT NULL COMMENT '计费周期开始',
  `period_end` date DEFAULT NULL COMMENT '计费周期结束',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/CHARGED/CANCELLED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_addon_charge_no` (`charge_no`),
  KEY `idx_addon_tenant` (`tenant_id`),
  KEY `idx_addon_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台增值扣费流水';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL COMMENT '登录账号',
  `password_hash` varchar(255) NOT NULL COMMENT 'bcrypt 密码哈希',
  `mfa_secret` varchar(128) DEFAULT NULL COMMENT 'TOTP 双因素认证 Secret(Base32)',
  `mfa_enabled` tinyint NOT NULL DEFAULT '0' COMMENT '双因素认证是否启用：1启用 0未启用',
  `real_name` varchar(64) NOT NULL COMMENT '真实姓名',
  `email` varchar(128) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(32) DEFAULT NULL COMMENT '手机号',
  `role` varchar(32) NOT NULL DEFAULT 'PLATFORM_ADMIN' COMMENT '角色: PLATFORM_ADMIN / PLATFORM_SUPER_ADMIN',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=启用 0=禁用',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_by` varchar(64) DEFAULT 'system' COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台管理员';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_ai_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_ai_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `default_provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deepseek' COMMENT '默认AI服务商: deepseek/qwen/zhipu/ollama',
  `default_model` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deepseek-chat' COMMENT '默认模型名称',
  `default_api_key` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '默认API Key（AES-256-GCM加密存储）',
  `default_endpoint` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '默认自定义Endpoint（留空则用服务商默认地址）',
  `default_temperature` decimal(2,1) NOT NULL DEFAULT '0.3' COMMENT '默认温度参数 0.0-2.0',
  `default_max_tokens` int NOT NULL DEFAULT '2048' COMMENT '默认最大Token数',
  `default_system_prompt` text COLLATE utf8mb4_unicode_ci COMMENT '默认系统提示词',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台级AI全局配置（全平台仅1条）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_announcement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_announcement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL COMMENT '公告标题',
  `content` text NOT NULL COMMENT '公告内容',
  `type` varchar(32) NOT NULL DEFAULT 'NOTICE' COMMENT '公告类型：NOTICE/UPDATE/MAINTENANCE/URGENT',
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/PUBLISHED/OFFLINE',
  `top_flag` tinyint NOT NULL DEFAULT '0' COMMENT '是否置顶：1是 0否',
  `publish_at` datetime DEFAULT NULL COMMENT '发布时间',
  `offline_at` datetime DEFAULT NULL COMMENT '下线时间',
  `created_by` bigint DEFAULT NULL COMMENT '创建人（平台管理员ID）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_top` tinyint NOT NULL DEFAULT '0' COMMENT '是否置顶(与top_flag同义)',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_at` (`publish_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台公告表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL COMMENT '操作人ID',
  `admin_name` varchar(64) NOT NULL COMMENT '操作人姓名',
  `action` varchar(64) NOT NULL COMMENT '操作类型',
  `target_type` varchar(64) NOT NULL COMMENT '操作对象类型',
  `target_id` varchar(64) DEFAULT NULL COMMENT '操作对象ID',
  `detail` json DEFAULT NULL COMMENT '操作详情',
  `ip` varchar(45) DEFAULT NULL COMMENT '操作IP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(64) DEFAULT NULL COMMENT 'IP地址(与ip同义)',
  `module` varchar(32) DEFAULT NULL COMMENT '模块(操作审计筛选)',
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台操作日志';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` bigint DEFAULT NULL COMMENT '门店ID',
  `app_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '应用Key',
  `app_secret` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '应用密钥',
  `merchant_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商家ID',
  `access_token` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '访问令牌',
  `refresh_token` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '刷新令牌',
  `token_expire_at` datetime DEFAULT NULL COMMENT '令牌过期时间',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `config_json` json DEFAULT NULL COMMENT '扩展配置JSON',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置分类',
  `config_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置键',
  `config_value` text COLLATE utf8mb4_unicode_ci COMMENT '配置值',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置说明',
  `updated_by` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_store_tenant` (`platform`,`store_id`,`tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_dict`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_dict` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dict_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型编码（唯一，本批四类：unit 计量单位/category_template 商品分类模板/payment_channel 支付渠道/bill_type 单据类型）',
  `dict_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型名称',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_type` (`dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台数据字典类型（四类平台级字典的父表，一行一类）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_dict_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_dict_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `dict_id` bigint unsigned NOT NULL COMMENT '字典类型ID（逻辑引用 t_platform_dict.id，不建物理外键）',
  `item_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典项编码（同一字典类型内唯一）',
  `item_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典项名称',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号（数字越小越靠前）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_item` (`dict_id`,`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台数据字典项（一行一个字典项，整包替换式维护）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_export_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_export_task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务编号（唯一，形如 EXP+yyyyMMddHHmmss+4位随机数）',
  `export_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '导出类型（业务侧取值由前端导出面板给出，如 tenantFinance/resourceCost/planDistribution）',
  `period` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '导出周期（如 thisMonth/lastMonth，NULL=未指定）',
  `format` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'CSV' COMMENT '导出格式：CSV/XLSX（仅此两值，端点层枚举校验）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待生成（创建即此态）/GENERATING-生成中（生成器接入后才会出现）/SUCCESS-成功（仅生成器可置）/FAILED-失败',
  `progress` int NOT NULL DEFAULT '0' COMMENT '进度百分比：0-100（创建即 0，生成器接入后由生成器推进）',
  `file_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '导出文件地址（NULL=尚无文件，只允许未来的生成器写入，本单任何端点都不写此列）',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小（字节，NULL=未知，不做 0 冒充）',
  `error_message` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '失败原因（NULL=无错误，retry 重排后清空）',
  `admin_id` int DEFAULT NULL COMMENT '创建人ID（逻辑引用 t_platform_admin.id，NULL=未记录，不建物理外键）',
  `started_at` datetime DEFAULT NULL COMMENT '开始生成时间（NULL=未开始，本单恒 NULL，由生成器写入）',
  `finished_at` datetime DEFAULT NULL COMMENT '生成结束时间（NULL=未结束，由生成器写入）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_no` (`task_no`),
  KEY `idx_status_created` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台报表导出任务（C6-2-T2，生成器待接入：创建后保持 PENDING）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_export_task_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_export_task_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint unsigned NOT NULL COMMENT '任务ID（逻辑引用 t_platform_export_task.id，不建物理外键）',
  `level` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'INFO' COMMENT '日志级别：INFO-普通/WARN-警告/ERROR-错误',
  `message` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '日志内容',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_task_created` (`task_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台报表导出任务日志（按任务ID与创建时间升序读取）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_feature_switch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_feature_switch` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `feature_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能编码（唯一，如 multi_warehouse / multi_unit / member / miniapp / open_api / report）',
  `feature_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能名称',
  `enabled` tinyint NOT NULL DEFAULT '0' COMMENT '全局启停：1-启用/0-停用',
  `default_for_new_tenant` tinyint NOT NULL DEFAULT '0' COMMENT '新租户初始化默认值：1-默认启用/0-默认停用',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  `updated_by` int DEFAULT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_feature_code` (`feature_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台全局功能开关（平台级"能不能开"，一个功能编码一行）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_io_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_io_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(64) NOT NULL COMMENT '模板名称',
  `direction` varchar(8) NOT NULL COMMENT 'IMPORT / EXPORT',
  `version` varchar(16) NOT NULL DEFAULT 'v1' COMMENT '模板版本',
  `field_count` int NOT NULL DEFAULT '0' COMMENT '字段数',
  `compat` varchar(128) NOT NULL DEFAULT '' COMMENT '兼容说明（旧格式兼容期≥2版本）',
  `field_desc` mediumtext COMMENT '字段校验说明（页签内容）',
  `file_name` varchar(128) DEFAULT NULL COMMENT '文件名',
  `file_content` longtext COMMENT '模板文件内容（≤1MB；超限改走对象存储 + file_url 列）',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_platform_io_direction` (`direction`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台导入导出模板表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_notification` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '通知正文（NULL=无正文）',
  `type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知类型（取值由业务侧约定，本表不限定枚举）',
  `level` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'INFO' COMMENT '级别：INFO-提示/WARN-警告/URGENT-紧急',
  `target_admin_id` int DEFAULT NULL COMMENT '定向管理员ID（逻辑引用 t_platform_admin.id，类型对齐 int；NULL=全员通知）',
  `link_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '跳转链接（NULL=无跳转）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_target_created` (`target_admin_id`,`created_at`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台通知主表（C6-2-T1）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_notification_read`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_notification_read` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notification_id` bigint unsigned NOT NULL COMMENT '通知ID（逻辑引用 t_platform_notification.id，不建物理外键）',
  `admin_id` int NOT NULL COMMENT '已读管理员ID（逻辑引用 t_platform_admin.id，类型对齐 int）',
  `read_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notif_admin` (`notification_id`,`admin_id`),
  KEY `idx_admin` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台通知已读记录（每管理员每通知至多一行）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_order` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform_order_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台订单号',
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` bigint DEFAULT NULL COMMENT '门店ID',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '订单状态',
  `order_data_json` json DEFAULT NULL COMMENT '平台原始订单数据',
  `tenant_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_order` (`platform_order_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_permission_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_permission_catalog` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `module_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域编码',
  `module_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域名称',
  `perm_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点编码（唯一）',
  `perm_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点名称',
  `perm_level` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点级别：MENU-菜单/BUTTON-页面按钮/DATA-数据范围',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_perm_code` (`perm_code`),
  KEY `idx_module_level` (`module_code`,`perm_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台权限点目录（系统能力枚举，非业务数据）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_print_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_print_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(64) NOT NULL COMMENT '模板名称',
  `bill_type` varchar(32) NOT NULL COMMENT '单据类型：SALE_RECEIPT/SALE_BILL/SALE_RETURN/PURCHASE_ORDER/REPORT/LABEL/SHIFT/DAILY_SETTLE',
  `paper_type` varchar(32) NOT NULL DEFAULT 'RECEIPT_80' COMMENT '纸张类型：RECEIPT_58/RECEIPT_80/RECEIPT_110/A4/DOT_1UP/DOT_2UP/DOT_3UP/LABEL_60X40/LABEL_CUSTOM',
  `content` mediumtext COMMENT '模板内容（JSON 可视化模板结构）',
  `spec` varchar(255) NOT NULL DEFAULT '' COMMENT '规格说明（列表展示）',
  `is_public` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否平台公共模板：1是 0否',
  `version` int NOT NULL DEFAULT '1' COMMENT '模板版本',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1启用 0停用',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ppp_scope` (`bill_type`,`paper_type`,`name`),
  KEY `idx_ppp_public` (`is_public`,`bill_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台公共打印模板表（与租户表 t_print_template 解耦）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_product_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_product_map` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `local_sku_id` bigint NOT NULL COMMENT '本地SKU ID',
  `platform_sku_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '平台SKU ID',
  `platform_spu_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '平台SPU ID',
  `sync_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNSYNCED' COMMENT '同步状态: UNSYNCED/PENDING/SYNCED/FAILED',
  `sync_msg` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '同步消息',
  `synced_at` datetime DEFAULT NULL COMMENT '同步时间',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_local_sku` (`platform`,`store_id`,`local_sku_id`,`tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_sync_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台商品映射表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_reconciliation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_reconciliation` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` varchar(32) NOT NULL COMMENT '平台',
  `reconciliation_date` date NOT NULL COMMENT '对账日期',
  `platform_order_count` int NOT NULL DEFAULT '0' COMMENT '平台订单数',
  `platform_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '平台金额',
  `system_order_count` int NOT NULL DEFAULT '0' COMMENT '系统订单数',
  `system_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '系统金额',
  `diff_count` int NOT NULL DEFAULT '0' COMMENT '差异单数',
  `diff_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '差异金额',
  `commission_amount` decimal(12,2) DEFAULT NULL COMMENT '佣金金额',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/MATCHED/DIFF/ADJUSTED',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '对账人',
  `adjusted_at` datetime DEFAULT NULL COMMENT '调整时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `platform_no` varchar(64) DEFAULT NULL COMMENT '平台流水号',
  `platform_name` varchar(64) DEFAULT NULL COMMENT '平台名称',
  `reconciliation_no` varchar(64) DEFAULT NULL COMMENT '对账编号',
  `type` varchar(32) DEFAULT NULL COMMENT '对账类型',
  `amount` decimal(12,2) DEFAULT '0.00' COMMENT '对账金额',
  `recorded_at` datetime DEFAULT NULL COMMENT '记录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_date` (`platform`,`reconciliation_date`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台对账表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_review` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` varchar(32) NOT NULL COMMENT '平台',
  `platform_review_id` varchar(128) DEFAULT NULL COMMENT '平台评价ID',
  `order_no` varchar(64) NOT NULL COMMENT '关联订单号',
  `rating` tinyint NOT NULL COMMENT '评分：1-5',
  `content` text COMMENT '评价内容',
  `reply_content` varchar(500) DEFAULT NULL COMMENT '回复内容',
  `replied_at` datetime DEFAULT NULL COMMENT '回复时间',
  `synced_at` datetime DEFAULT NULL COMMENT '同步时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_platform` (`platform`),
  KEY `idx_rating` (`rating`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台评价表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_role` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
  `code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色编码（唯一，小写字母开头 2-32 位）',
  `type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'custom' COMMENT '角色类型：builtin-内置/custom-自定义（仅此两值）',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写）',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用/0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台角色';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_role_permission` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id` int NOT NULL COMMENT '角色ID（t_platform_role.id）',
  `module_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域编码（取值以后端常量 PERMISSION_CATALOG 的 moduleCode 为准）',
  `can_menu` tinyint NOT NULL DEFAULT '0' COMMENT '菜单级权限：1-有/0-无',
  `can_page_btn` tinyint NOT NULL DEFAULT '0' COMMENT '页面按钮级权限：1-有/0-无',
  `data_scope` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '数据范围（取值=后端常量 PERMISSION_CATALOG 中 permLevel=DATA 的 permCode，NULL=未设置）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_module` (`role_id`,`module_code`),
  KEY `idx_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台角色权限矩阵（每角色每功能域一行）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_settlement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_settlement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '结算ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `tenant_name` varchar(128) DEFAULT NULL COMMENT '租户名称快照',
  `settlement_no` varchar(64) NOT NULL COMMENT '结算单号',
  `period_start` date NOT NULL COMMENT '结算周期开始',
  `period_end` date NOT NULL COMMENT '结算周期结束',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '结算总额',
  `pending_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '待结算金额',
  `settled_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已结算金额',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/SETTLED/CANCELLED',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_by` bigint DEFAULT NULL COMMENT '创建人ID',
  `settled_at` datetime DEFAULT NULL COMMENT '结算时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_settlement_no` (`settlement_no`),
  KEY `idx_platform_settlement_tenant` (`tenant_id`),
  KEY `idx_platform_settlement_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台结算表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_subscription_apply`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_subscription_apply` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `openid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '微信 openid（MVP 先用设备标识，R98-02 换真实 openid）',
  `plan_id` bigint NOT NULL COMMENT '订阅套餐ID',
  `plan_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '套餐名称快照',
  `company` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '公司名称',
  `contact` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '联系人',
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手机号',
  `remark` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '申请备注',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING待审核/APPROVED已通过/REJECTED已驳回',
  `audit_remark` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '审核备注',
  `audited_by` bigint DEFAULT NULL COMMENT '审核人ID（平台管理员）',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_psa_openid` (`openid`),
  KEY `idx_psa_mobile` (`mobile`),
  KEY `idx_psa_status` (`status`),
  KEY `idx_psa_plan` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台小程序订阅申请表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code` varchar(64) NOT NULL COMMENT '模板编码（开户套用入参 templateCode，唯一）',
  `name` varchar(64) NOT NULL COMMENT '模板名称',
  `applicable` varchar(64) NOT NULL DEFAULT '' COMMENT '适用对象/规模（卡片第二行）',
  `code_rule` varchar(128) NOT NULL DEFAULT '' COMMENT '段1 编号规则配置摘要',
  `convert_rule` varchar(128) NOT NULL DEFAULT '' COMMENT '段2 换算规则配置摘要',
  `print_ref` varchar(64) NOT NULL DEFAULT '' COMMENT '段3 打印模板引用（t_print_template.id 列表）',
  `default_wh_account` varchar(128) NOT NULL DEFAULT '' COMMENT '段4 默认仓库与账户体系摘要',
  `config_json` json DEFAULT NULL COMMENT '四段式完整配置（开户套用的值复制来源）',
  `free_available` tinyint(1) NOT NULL DEFAULT '0' COMMENT '免费版可用：1是 0否',
  `recommended` tinyint(1) NOT NULL DEFAULT '0' COMMENT '推荐标记：1是 0否',
  `version` int NOT NULL DEFAULT '1' COMMENT '当前版本号',
  `ref_count` int NOT NULL DEFAULT '0' COMMENT '被引用租户数（开户套用累加）',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_template_code` (`code`),
  KEY `idx_platform_template_status` (`status`,`recommended`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台初始化模板主表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_platform_template_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_template_version` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `template_id` bigint unsigned NOT NULL COMMENT '关联 t_platform_template.id（不建 FK，同平台表口径）',
  `version` int NOT NULL COMMENT '版本号',
  `config_json` json DEFAULT NULL COMMENT '该版本四段式配置快照',
  `change_note` varchar(255) DEFAULT NULL COMMENT '变更说明',
  `created_by` varchar(64) DEFAULT NULL COMMENT '操作人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_template_version` (`template_id`,`version`),
  KEY `idx_platform_template_version_tpl` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台初始化模板版本表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_exchange_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_exchange_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '兑换编号',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `points_used` int NOT NULL COMMENT '消耗积分',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '兑换数量',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/CANCELLED',
  `delivery_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'SELF_PICKUP' COMMENT '配送方式: SELF_PICKUP/DELIVERY',
  `delivery_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配送状态',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_record_no` (`record_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分兑换记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_mall_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_mall_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL COMMENT '商品名称',
  `image` varchar(255) DEFAULT NULL COMMENT '商品图片',
  `points` int NOT NULL COMMENT '所需积分',
  `stock` int NOT NULL DEFAULT '0' COMMENT '库存',
  `limit_per_user` int NOT NULL DEFAULT '1' COMMENT '每人限兑',
  `valid_start` date DEFAULT NULL COMMENT '有效期开始',
  `valid_end` date DEFAULT NULL COMMENT '有效期结束',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分商城商品表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_mall_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_mall_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_no` varchar(64) NOT NULL COMMENT '订单号',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `item_id` bigint unsigned NOT NULL COMMENT '商品ID',
  `item_name` varchar(128) NOT NULL COMMENT '商品名称',
  `points` int NOT NULL COMMENT '消耗积分',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '兑换数量',
  `receiver_name` varchar(64) DEFAULT NULL COMMENT '收货人',
  `receiver_mobile` varchar(20) DEFAULT NULL COMMENT '收货电话',
  `receiver_address` varchar(255) DEFAULT NULL COMMENT '收货地址',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/DELIVERED/CANCELLED',
  `delivered_at` datetime DEFAULT NULL COMMENT '发货时间',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分商城订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_product` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品编码',
  `product_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名称',
  `product_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品图片',
  `product_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品描述',
  `points_required` int NOT NULL COMMENT '所需积分',
  `stock_total` int NOT NULL DEFAULT '0' COMMENT '总库存',
  `stock_available` int NOT NULL DEFAULT '0' COMMENT '可用库存',
  `exchange_limit_per_user` int DEFAULT NULL COMMENT '每人限兑次数',
  `exchange_limit_total` int DEFAULT NULL COMMENT '总限兑次数',
  `market_price` decimal(10,2) DEFAULT NULL COMMENT '参考市场价',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ON' COMMENT '状态: ON/OFF',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分商城商品';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL COMMENT '用户ID(营销积分明细)',
  `member_id` bigint unsigned DEFAULT NULL COMMENT '会员ID(小程序会员积分明细)',
  `record_no` varchar(32) NOT NULL COMMENT '记录编号',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `type` varchar(20) NOT NULL COMMENT '类型: EARN/REDEEM/EXPIRE/ADJUST',
  `amount` int DEFAULT NULL COMMENT '积分变动数(营销积分设计)',
  `balance` int DEFAULT NULL COMMENT '变动后余额(营销积分设计)',
  `change_points` int DEFAULT NULL COMMENT '变动积分(正=获得,负=消耗,小程序设计)',
  `balance_points` int DEFAULT NULL COMMENT '变动后余额(小程序设计)',
  `points` int NOT NULL COMMENT '积分变动数',
  `balance_after` int NOT NULL COMMENT '变动后余额',
  `source_type` varchar(32) DEFAULT NULL COMMENT '来源类型',
  `source_id` varchar(64) DEFAULT NULL COMMENT '来源ID(小程序/营销积分设计)',
  `source_no` varchar(32) DEFAULT NULL COMMENT '来源单号',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_type` (`type`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_points_record_user` (`user_id`),
  KEY `idx_points_record_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分变动记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_points_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_points_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `earn_type` varchar(20) NOT NULL COMMENT '获取方式: PURCHASE/SIGN_IN/BIRTHDAY/REFERRAL',
  `earn_rate` decimal(6,4) DEFAULT '0.0000' COMMENT '积分比例',
  `earn_ratio` decimal(6,4) DEFAULT '0.0000' COMMENT '消费积分比例(营销积分设计)',
  `redeem_ratio` decimal(10,2) DEFAULT '100.00' COMMENT '积分兑换比例(1积分可抵金额,营销积分设计)',
  `min_redeem_amount` decimal(10,2) DEFAULT '0.00' COMMENT '最低兑换金额(营销积分设计)',
  `max_redeem_ratio` decimal(6,4) DEFAULT '0.5000' COMMENT '最高抵扣比例(营销积分设计)',
  `expire_days` int NOT NULL DEFAULT '365' COMMENT '积分有效天数(营销积分设计)',
  `daily_limit` int DEFAULT '0' COMMENT '每日上限',
  `enabled` tinyint DEFAULT '1' COMMENT '是否启用',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_type` (`earn_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分规则';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_price_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_price_change_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `sku_id` int NOT NULL COMMENT 'SKU ID',
  `price_level_id` int NOT NULL COMMENT '价格等级ID',
  `old_price` decimal(12,2) DEFAULT NULL COMMENT '原价格',
  `new_price` decimal(12,2) DEFAULT NULL COMMENT '新价格',
  `change_reason` varchar(255) DEFAULT '' COMMENT '变更原因',
  `changed_by` int NOT NULL COMMENT '变更人',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_price_change_log_sku` (`sku_id`),
  KEY `idx_t_price_change_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='价格变更历史表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_price_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_price_level` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `level_code` varchar(32) NOT NULL COMMENT '等级编码如RETAIL/WHOLESALE_L1/WHOLESALE_L2/AGREEMENT',
  `level_name` varchar(64) NOT NULL COMMENT '等级名称',
  `discount_rate` decimal(5,4) DEFAULT '1.0000' COMMENT '折扣率，1.0000=无折扣',
  `min_order_amount` decimal(12,2) DEFAULT '0.00' COMMENT '最低订单金额门槛',
  `description` varchar(255) DEFAULT '' COMMENT '等级说明',
  `sort_order` int DEFAULT '0',
  `status` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `level_code` (`level_code`),
  KEY `idx_t_price_level_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='价格等级表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_price_review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_price_review` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '核价单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `review_no` varchar(64) NOT NULL COMMENT '核价单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `spu_id` bigint unsigned NOT NULL COMMENT '商品ID',
  `product_name` varchar(128) NOT NULL COMMENT '商品名称',
  `sku_name` varchar(128) DEFAULT NULL COMMENT 'SKU名称',
  `spec` varchar(256) DEFAULT NULL COMMENT '规格',
  `current_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '当前售价',
  `suggested_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '建议售价',
  `reason` varchar(500) DEFAULT NULL COMMENT '核价原因',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  `created_by` bigint DEFAULT NULL COMMENT '提交人ID',
  `created_by_name` varchar(64) DEFAULT NULL COMMENT '提交人姓名',
  `reviewed_by` bigint DEFAULT NULL COMMENT '核价人ID',
  `reviewed_by_name` varchar(64) DEFAULT NULL COMMENT '核价人姓名',
  `reviewed_at` datetime DEFAULT NULL COMMENT '核价时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `price_type` varchar(16) NOT NULL DEFAULT 'RETAIL' COMMENT '价格档位：COST成本/RETAIL零售/WHOLESALE批发/MINIAPP小程序/STORE门店',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_price_review_no` (`review_no`,`tenant_id`),
  KEY `idx_price_review_status` (`tenant_id`,`status`),
  KEY `idx_price_review_sku` (`sku_id`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='建议核价单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_print_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_print_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(64) NOT NULL COMMENT '租户ID（多租户隔离）',
  `store_id` bigint unsigned DEFAULT NULL COMMENT '门店ID',
  `bill_type` varchar(32) NOT NULL COMMENT '单据类型：SALE_BILL/SALE_RETURN/SHIFT/DAILY_SETTLE/REPRINT',
  `bill_no` varchar(64) NOT NULL COMMENT '关联单据编号',
  `printer_mac` varchar(32) DEFAULT NULL COMMENT '打印机蓝牙MAC地址',
  `print_content` text COMMENT '打印内容JSON',
  `copies` int NOT NULL DEFAULT '1' COMMENT '打印份数',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '操作员ID',
  `status` varchar(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS/FAILED/PENDING',
  `error_msg` text COMMENT '错误信息（status=FAILED 时填充）',
  `original_id` bigint unsigned DEFAULT NULL COMMENT '原打印记录ID（重打时关联原记录）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_print_record_tenant` (`tenant_id`) COMMENT '租户索引（多租户隔离）',
  KEY `idx_print_record_tenant_bill` (`tenant_id`,`bill_no`) COMMENT '租户+单据号联合索引（按单查询）',
  KEY `idx_print_record_tenant_type` (`tenant_id`,`bill_type`) COMMENT '租户+单据类型联合索引（按类型筛选）',
  KEY `idx_print_record_original` (`original_id`) COMMENT '原记录ID索引（重打追溯）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='打印记录表（App 蓝牙打印小票留痕）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_print_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_print_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `store_id` bigint unsigned DEFAULT NULL COMMENT '门店ID（NULL=全门店通用）',
  `bill_type` varchar(32) NOT NULL COMMENT '单据类型：SALE_RECEIPT/SALE_BILL/SALE_RETURN/PURCHASE_ORDER/REPORT/LABEL/SHIFT/DAILY_SETTLE',
  `paper_type` varchar(32) NOT NULL DEFAULT 'RECEIPT_80' COMMENT '纸张类型：RECEIPT_58/RECEIPT_80/RECEIPT_110/A4/DOT_1UP/DOT_2UP/DOT_3UP/LABEL_60X40/LABEL_CUSTOM',
  `template_name` varchar(64) NOT NULL DEFAULT '' COMMENT '模板名称',
  `content` mediumtext COMMENT '模板内容（HTML + {{变量}} 占位符）',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否系统默认模板',
  `version` int NOT NULL DEFAULT '1' COMMENT '模板版本',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1启用/0停用',
  `updated_by` bigint unsigned DEFAULT NULL COMMENT '最后修改人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_print_template_scope` (`tenant_id`,`store_id`,`bill_type`,`paper_type`) COMMENT '同租户同门店同类型同纸张唯一模板',
  KEY `idx_print_template_tenant_type` (`tenant_id`,`bill_type`) COMMENT '租户+单据类型索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='打印模板表（小票/针式/A4/标签，模板可自定义）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_bundle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_bundle` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bundle_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套装编号',
  `bundle_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套装名称',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '套装描述',
  `original_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '原价（各商品原价之和）',
  `bundle_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '套装价格',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成本价',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '状态：0=下架 1=上架',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `sales_count` int NOT NULL DEFAULT '0' COMMENT '销量',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bundle_no_tenant` (`bundle_no`,`tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品套装表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_bundle_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_bundle_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bundle_id` int NOT NULL COMMENT '套装ID',
  `sku_id` int NOT NULL COMMENT '商品SKU ID',
  `sku_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SKU名称',
  `barcode` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '条码',
  `qty` int NOT NULL DEFAULT '1' COMMENT '数量',
  `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '单品价格',
  `subtotal_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '小计价格',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成本价',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_bundle_id` (`bundle_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='套装商品明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_category` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父分类ID，仅支持两级',
  `name` varchar(64) NOT NULL COMMENT '分类名称',
  `icon` varchar(256) DEFAULT NULL COMMENT '分类图标',
  `code` varchar(64) DEFAULT NULL COMMENT '分类编码',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `allow_online_sale` tinyint NOT NULL DEFAULT '1' COMMENT '是否允许线上销售：1允许 0禁止',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_category_parent_id` (`parent_id`),
  KEY `idx_product_category_status` (`status`,`sort_no`),
  KEY `idx_t_product_category_tenant` (`tenant_id`),
  KEY `idx_product_category_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品分类表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_marketing_tag`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_marketing_tag` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tag_code` varchar(32) NOT NULL COMMENT '标签编码（如 NEW/HOT/RECOMMEND）',
  `tag_name` varchar(64) NOT NULL COMMENT '标签名称（如 新品/爆款/推荐）',
  `color` varchar(16) NOT NULL DEFAULT '#409EFF' COMMENT '标签颜色（十六进制）',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `tenant_id` varchar(64) NOT NULL DEFAULT '' COMMENT '租户ID（空表示平台通用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_tenant` (`tag_code`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品营销标签字典表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_price`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_price` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '价格ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成本价',
  `retail_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '统一零售价',
  `wholesale_price` decimal(12,2) DEFAULT NULL COMMENT '批发价，普通客户接口不得返回',
  `miniapp_price` decimal(12,2) DEFAULT NULL COMMENT '小程序渠道价',
  `store_price` decimal(12,2) DEFAULT NULL COMMENT '线下门店售价',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_price_sku_id` (`sku_id`),
  KEY `idx_t_product_price_tenant` (`tenant_id`),
  KEY `idx_product_price_sku_id` (`sku_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品价格表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_price_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_price_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `operator_id` bigint unsigned NOT NULL COMMENT '操作人ID',
  `price_type` varchar(32) NOT NULL COMMENT '价格类型：COST/RETAIL/WHOLESALE/MINIAPP/STORE',
  `old_price` decimal(12,2) DEFAULT NULL COMMENT '原价格',
  `new_price` decimal(12,2) DEFAULT NULL COMMENT '新价格',
  `action_type` varchar(32) NOT NULL COMMENT '操作类型：CREATE/UPDATE/CLEAR',
  `source` varchar(16) NOT NULL DEFAULT 'admin' COMMENT '价格来源：admin=后台改价(工作台/移动端/批量)，ai=AI 底座改价',
  `change_reason` varchar(255) DEFAULT NULL COMMENT '变更原因',
  `batch_no` varchar(32) DEFAULT NULL COMMENT '批量调整批次号',
  `ip` varchar(64) DEFAULT NULL COMMENT 'IP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_price_log_sku_id` (`sku_id`),
  KEY `idx_product_price_log_operator_id` (`operator_id`),
  KEY `idx_product_price_log_created_at` (`created_at`),
  KEY `idx_t_product_price_log_tenant` (`tenant_id`),
  KEY `idx_batch_no` (`batch_no`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='价格修改日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_review` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `review_no` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '审核单号',
  `product_id` bigint NOT NULL COMMENT '商品SPU ID',
  `product_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名称',
  `submitter_id` bigint NOT NULL COMMENT '提交人ID',
  `submitter_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '提交人姓名',
  `review_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATE' COMMENT '审核类型：CREATE/UPDATE/DELETE',
  `change_content` json DEFAULT NULL COMMENT '变更内容',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT '审核状态：PENDING/APPROVED/REJECTED',
  `reviewer_id` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewer_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审核人姓名',
  `review_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审核意见',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `review_no` (`review_no`),
  UNIQUE KEY `uk_review_no` (`review_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_submitter` (`submitter_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品审核表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_sku`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_sku` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'SKU ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `spu_id` bigint unsigned NOT NULL COMMENT '商品ID',
  `sku_code` varchar(64) NOT NULL COMMENT 'SKU编码',
  `barcode` varchar(128) DEFAULT NULL COMMENT '商品条码',
  `box_barcode` varchar(128) DEFAULT NULL COMMENT '组合单位条码（箱码，一品多码）',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称',
  `alcohol_degree` decimal(5,2) DEFAULT NULL COMMENT '酒精度(%)',
  `origin` varchar(128) DEFAULT NULL COMMENT '产地',
  `volume` varchar(32) DEFAULT NULL COMMENT '净含量（500ml/1L）',
  `packaging` varchar(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）',
  `base_unit` varchar(16) NOT NULL DEFAULT '瓶' COMMENT '基础单位',
  `box_unit` varchar(16) NOT NULL DEFAULT '箱' COMMENT '组合单位',
  `box_ratio` int NOT NULL DEFAULT '1' COMMENT '箱瓶换算比例',
  `temperature` varchar(32) NOT NULL DEFAULT 'NORMAL' COMMENT '温度属性：NORMAL/CHILLED',
  `trace_enabled` tinyint NOT NULL DEFAULT '0' COMMENT '是否启用追溯',
  `warning_threshold` int NOT NULL DEFAULT '0' COMMENT '库存预警阈值，单位瓶',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cost_price` decimal(12,2) DEFAULT '0.00' COMMENT '成本价(加权平均)',
  `safety_stock` int NOT NULL DEFAULT '0' COMMENT '安全库存(预警)',
  `name` varchar(128) DEFAULT NULL COMMENT 'SKU名称(与sku_name同义)',
  `image` varchar(512) DEFAULT NULL COMMENT 'SKU图片(冗余)',
  `unit` varchar(32) DEFAULT NULL COMMENT '单位(与base_unit同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_sku_code` (`sku_code`),
  UNIQUE KEY `uk_product_sku_tenant_barcode` (`tenant_id`,`barcode`),
  KEY `idx_product_sku_spu_id` (`spu_id`),
  KEY `idx_product_sku_trace_enabled` (`trace_enabled`),
  KEY `idx_t_product_sku_tenant` (`tenant_id`),
  KEY `idx_product_sku_origin` (`origin`),
  KEY `idx_product_sku_volume` (`volume`),
  KEY `idx_product_sku_packaging` (`packaging`),
  KEY `idx_product_sku_barcode` (`barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品SKU表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_sku_unit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_sku_unit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `unit_name` varchar(16) NOT NULL COMMENT '单位名称（瓶/箱/件/提等）',
  `ratio` decimal(10,2) NOT NULL DEFAULT '1.00' COMMENT '换算比例：1单位=ratio个基础单位',
  `barcode` varchar(128) DEFAULT NULL COMMENT '该单位条码（一品多码）',
  `retail_price` decimal(12,2) DEFAULT NULL COMMENT '该单位零售价',
  `wholesale_price` decimal(12,2) DEFAULT NULL COMMENT '该单位批发价',
  `store_price` decimal(12,2) DEFAULT NULL COMMENT '该单位门店价',
  `miniapp_price` decimal(12,2) DEFAULT NULL COMMENT '该单位小程序价',
  `is_base` tinyint NOT NULL DEFAULT '0' COMMENT '是否基础单位（库存单位）',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku_unit_name` (`sku_id`,`unit_name`,`tenant_id`),
  KEY `idx_sku_unit_sku` (`sku_id`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='SKU多单位与单位价格';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_spu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_spu` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `spu_code` varchar(64) NOT NULL COMMENT '商品编码',
  `name` varchar(128) NOT NULL COMMENT '商品名称',
  `category_id` bigint unsigned NOT NULL COMMENT '分类ID',
  `brand` varchar(128) DEFAULT NULL COMMENT '品牌',
  `unit` varchar(32) DEFAULT NULL COMMENT '单位',
  `specs` varchar(256) DEFAULT NULL COMMENT '规格',
  `main_image` varchar(512) DEFAULT NULL COMMENT '商品主图',
  `image_urls` json DEFAULT NULL COMMENT '轮播图',
  `detail` text COMMENT '商品详情',
  `sale_channels` json NOT NULL COMMENT '可售渠道：MINIAPP/STORE',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `is_new` tinyint NOT NULL DEFAULT '0' COMMENT '新品标记',
  `is_recommend` tinyint NOT NULL DEFAULT '0' COMMENT '推荐标记',
  `description` varchar(512) DEFAULT NULL COMMENT '商品简介',
  `status` varchar(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/ON_SALE/OFF_SALE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `brand_id` bigint unsigned DEFAULT NULL COMMENT '品牌ID（商品JOIN t_brand）',
  `alcohol_content` varchar(32) DEFAULT NULL COMMENT '酒精度数',
  `origin` varchar(128) DEFAULT NULL COMMENT '产地',
  `marketing_tags` json DEFAULT NULL COMMENT '营销标签(JSON)',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '商品启用 1=启用 0=停用（停用后开单/采购不可选）',
  `shelf_life_on` tinyint NOT NULL DEFAULT '1' COMMENT '保质期开关 1=开单需录入生产日期与保质期',
  `batch_on` tinyint NOT NULL DEFAULT '0' COMMENT '批次开关 1=开单需选择商品批次',
  `store_id` bigint DEFAULT NULL COMMENT '门店ID(商品同步)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_spu_code` (`spu_code`),
  KEY `idx_product_spu_category_status` (`category_id`,`status`),
  KEY `idx_t_product_spu_tenant` (`tenant_id`),
  KEY `idx_product_spu_brand_id` (`brand_id`),
  KEY `idx_product_spu_brand` (`brand`),
  KEY `idx_product_spu_sort_no` (`sort_no`),
  KEY `idx_product_spu_is_new` (`is_new`),
  KEY `idx_product_spu_is_recommend` (`is_recommend`),
  KEY `idx_product_spu_status_sort` (`status`,`sort_no`),
  KEY `idx_product_spu_status_category` (`status`,`category_id`),
  KEY `idx_product_spu_status_brand` (`status`,`brand`),
  KEY `idx_product_spu_tenant_status` (`tenant_id`,`status`),
  FULLTEXT KEY `ft_product_spu_name` (`name`),
  CONSTRAINT `fk_product_spu_brand` FOREIGN KEY (`brand_id`) REFERENCES `t_brand` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品主档案表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_tag`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_tag` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL COMMENT '标签组ID',
  `name` varchar(64) NOT NULL COMMENT '标签名称',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `t_product_tag_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `t_product_tag_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品标签值表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_tag_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_tag_group` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL COMMENT '标签组名称',
  `code` varchar(64) NOT NULL COMMENT '标签组编码',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `is_multiple` tinyint NOT NULL DEFAULT '1' COMMENT '是否多选：1多选 0单选',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品标签组表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_product_tag_relation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_product_tag_relation` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `spu_id` bigint unsigned NOT NULL COMMENT '商品ID',
  `tag_id` bigint unsigned NOT NULL COMMENT '标签ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_spu_tag` (`spu_id`,`tag_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `t_product_tag_relation_ibfk_1` FOREIGN KEY (`spu_id`) REFERENCES `t_product_spu` (`id`),
  CONSTRAINT `t_product_tag_relation_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `t_product_tag` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品标签关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_promo_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_promo_code` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `promo_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '推广码（唯一，规则 PC + 8 位大写字母数字去易混字符）',
  `channel_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '来源渠道类型（市场渠道/异业合作/地推/其他，本表不限定枚举，由业务侧约定）',
  `channel_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '渠道名称',
  `owner_admin_id` int DEFAULT NULL COMMENT '渠道负责人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未指派）',
  `expire_at` datetime DEFAULT NULL COMMENT '有效期截止（NULL=长期有效，不得用远期时间冒充）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_promo_code` (`promo_code`),
  KEY `idx_promo_channel_type` (`channel_type`),
  KEY `idx_promo_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台渠道推广码档案（C6-3-2a：只存码档案与渠道归属，无任何金额列）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_promo_stack_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_promo_stack_rule` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `name` varchar(128) NOT NULL COMMENT '规则名称',
  `type_combination` json NOT NULL COMMENT '可叠加活动类型组合',
  `max_total_discount_rate` decimal(5,2) NOT NULL DEFAULT '100.00' COMMENT '最大总折扣率',
  `priority` int NOT NULL DEFAULT '0' COMMENT '优先级',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_promo_stack_rule_tenant` (`tenant_id`),
  KEY `idx_promo_stack_rule_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='活动叠加规则表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_promotion_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_promotion_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_code` varchar(32) NOT NULL COMMENT '活动编码',
  `activity_name` varchar(128) NOT NULL COMMENT '活动名称',
  `activity_type` varchar(32) NOT NULL COMMENT '活动类型（FULL_REDUCTION/SECKILL/GROUP_BUY/GIFT）',
  `activity_desc` varchar(500) DEFAULT NULL COMMENT '活动描述',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `applicable_scope` varchar(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围（ALL/CATEGORY/PRODUCT/STORE）',
  `applicable_ids` json DEFAULT NULL COMMENT '适用范围ID列表',
  `rules` json NOT NULL COMMENT '活动规则（JSON格式）',
  `max_participants` int DEFAULT '0' COMMENT '最大参与人数（0表示不限制）',
  `participant_count` int NOT NULL DEFAULT '0' COMMENT '已参与人数',
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态（DRAFT/ACTIVE/PAUSED/ENDED）',
  `priority` int NOT NULL DEFAULT '0' COMMENT '优先级（数字越大优先级越高）',
  `stackable` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可与其他活动叠加',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_by` int DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_code` (`activity_code`),
  KEY `idx_activity_code` (`activity_code`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_activity_status` (`status`),
  KEY `idx_activity_time` (`start_time`,`end_time`),
  KEY `idx_activity_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='促销活动表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_promotion_stack_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_promotion_stack_rule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(128) NOT NULL COMMENT '规则名称',
  `priority` int NOT NULL DEFAULT '0' COMMENT '优先级',
  `stack_types` json NOT NULL COMMENT '可叠加的活动类型列表',
  `max_discount` decimal(10,2) DEFAULT NULL COMMENT '最大优惠金额限制',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='活动叠加规则表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_contract`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_contract` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `contract_no` varchar(32) NOT NULL COMMENT '合同编号',
  `supplier_id` bigint NOT NULL COMMENT '供应商ID',
  `contract_name` varchar(200) NOT NULL COMMENT '合同名称',
  `contract_type` varchar(20) NOT NULL DEFAULT 'PURCHASE' COMMENT '类型: PURCHASE/FRAMEWORK',
  `total_amount` decimal(12,2) DEFAULT '0.00' COMMENT '合同总金额',
  `paid_amount` decimal(12,2) DEFAULT '0.00' COMMENT '已付金额',
  `sign_date` date DEFAULT NULL COMMENT '签订日期',
  `start_date` date DEFAULT NULL COMMENT '开始日期',
  `end_date` date DEFAULT NULL COMMENT '结束日期',
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/SIGNED/EXECUTING/COMPLETED/TERMINATED',
  `file_url` varchar(500) DEFAULT NULL COMMENT '合同文件URL',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contract_no` (`contract_no`,`tenant_id`),
  KEY `idx_supplier` (`supplier_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购合同';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_in_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_in_stock` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '采购入库单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `stock_no` varchar(64) NOT NULL COMMENT '入库单号',
  `order_no` varchar(64) DEFAULT NULL COMMENT '关联采购订单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称快照',
  `store_id` bigint unsigned NOT NULL COMMENT '入库门店ID',
  `stock_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '合计金额',
  `operator_id` bigint unsigned NOT NULL COMMENT '入库人',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_in_stock_no` (`stock_no`),
  KEY `idx_purchase_in_stock_order` (`order_no`),
  KEY `idx_purchase_in_stock_supplier` (`supplier_id`),
  KEY `idx_purchase_in_stock_created_at` (`created_at`),
  KEY `idx_t_purchase_in_stock_tenant` (`tenant_id`),
  KEY `idx_purchase_in_stock_order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购入库单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_in_stock_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_in_stock_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `stock_no` varchar(64) NOT NULL COMMENT '入库单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '入库单价（瓶）',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '税率',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL COMMENT '含税小计',
  `batch_no` varchar(64) DEFAULT NULL COMMENT '批次号',
  `production_date` date DEFAULT NULL COMMENT '生产日期',
  `expiry_date` date DEFAULT NULL COMMENT '有效期至',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_in_stock_item_stock_no` (`stock_no`),
  KEY `idx_purchase_in_stock_item_sku_id` (`sku_id`),
  KEY `idx_t_purchase_in_stock_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购入库单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '采购订单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '采购订单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称快照',
  `store_id` bigint unsigned NOT NULL COMMENT '入库门店ID',
  `order_status` varchar(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态：DRAFT/PENDING/APPROVED/PARTIAL/COMPLETED/CANCELLED',
  `approval_instance_no` varchar(64) DEFAULT NULL COMMENT '关联审批实例号',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应付金额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已付金额',
  `unpaid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未付金额',
  `expected_date` date DEFAULT NULL COMMENT '预计到货日期',
  `actual_date` date DEFAULT NULL COMMENT '实际到货日期',
  `operator_id` bigint unsigned NOT NULL COMMENT '制单人',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `warehouse_status` varchar(32) DEFAULT NULL COMMENT '入库状态',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_order_no` (`order_no`),
  KEY `idx_purchase_order_supplier` (`supplier_id`),
  KEY `idx_purchase_order_status` (`order_status`),
  KEY `idx_purchase_order_created_at` (`created_at`),
  KEY `idx_t_purchase_order_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_order_archive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_order_archive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '采购订单ID（归档）',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '采购订单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称快照',
  `store_id` bigint unsigned NOT NULL COMMENT '入库门店ID',
  `order_status` varchar(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应付金额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已付金额',
  `unpaid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未付金额',
  `expected_date` date DEFAULT NULL COMMENT '预计到货日期',
  `actual_date` date DEFAULT NULL COMMENT '实际到货日期',
  `operator_id` bigint unsigned NOT NULL COMMENT '制单人',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_order_archive_no` (`order_no`),
  KEY `idx_purchase_order_archive_tenant` (`tenant_id`),
  KEY `idx_purchase_order_archive_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购订单归档表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_order_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '采购订单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `barcode` varchar(128) DEFAULT NULL COMMENT '条码快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '采购单价（瓶）',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '税率',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL COMMENT '含税小计',
  `in_stocked_qty` int NOT NULL DEFAULT '0' COMMENT '已入库数量',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `amount` decimal(12,2) DEFAULT '0.00' COMMENT '金额(与subtotal_amount同义)',
  `order_qty` int DEFAULT '0' COMMENT '订购数量(与total_bottle_qty同义)',
  PRIMARY KEY (`id`),
  KEY `idx_purchase_order_item_order_no` (`order_no`),
  KEY `idx_purchase_order_item_sku_id` (`sku_id`),
  KEY `idx_t_purchase_order_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购订单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_order_item_archive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_order_item_archive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `order_no` varchar(64) NOT NULL COMMENT '采购订单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `barcode` varchar(128) DEFAULT NULL COMMENT '条码快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '采购单价',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '税率',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL COMMENT '含税小计',
  `in_stocked_qty` int NOT NULL DEFAULT '0' COMMENT '已入库数量',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_order_item_archive_order` (`order_no`),
  KEY `idx_purchase_order_item_archive_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购订单明细归档表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_payment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '采购付款单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `payment_no` varchar(64) NOT NULL COMMENT '付款单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称快照',
  `payment_type` varchar(32) NOT NULL DEFAULT 'ORDER' COMMENT '付款类型：ORDER/RETURN/ADVANCE',
  `source_type` varchar(32) DEFAULT NULL COMMENT '来源类型：PURCHASE_ORDER/PURCHASE_RETURN',
  `source_no` varchar(64) DEFAULT NULL COMMENT '来源单号',
  `amount` decimal(12,2) NOT NULL COMMENT '付款金额',
  `payment_method` varchar(32) NOT NULL DEFAULT 'BANK' COMMENT '付款方式：BANK/CASH/WECHAT/ALIPAY',
  `bank_account` varchar(64) DEFAULT NULL COMMENT '收款账号',
  `bank_account_name` varchar(64) DEFAULT NULL COMMENT '收款人',
  `bank_name` varchar(128) DEFAULT NULL COMMENT '收款银行',
  `voucher_no` varchar(64) DEFAULT NULL COMMENT '凭证号',
  `payment_date` date NOT NULL COMMENT '付款日期',
  `operator_id` bigint unsigned NOT NULL COMMENT '付款人',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_payment_no` (`payment_no`),
  KEY `idx_purchase_payment_supplier` (`supplier_id`),
  KEY `idx_purchase_payment_source` (`source_type`,`source_no`),
  KEY `idx_purchase_payment_created_at` (`created_at`),
  KEY `idx_t_purchase_payment_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购付款单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_plan` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `plan_no` varchar(32) NOT NULL COMMENT '计划编号',
  `supplier_id` bigint NOT NULL COMMENT '供应商ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `plan_status` varchar(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/CONFIRMED/CONVERTED',
  `goods_amount` decimal(12,2) DEFAULT '0.00' COMMENT '计划采购金额',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_plan_no` (`plan_no`,`tenant_id`),
  KEY `idx_supplier` (`supplier_id`),
  KEY `idx_status` (`plan_status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购计划';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_plan_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_plan_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `plan_no` varchar(32) NOT NULL COMMENT '计划编号',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `suggest_qty` int NOT NULL DEFAULT '0' COMMENT '建议采购量',
  `current_stock` int NOT NULL DEFAULT '0' COMMENT '当前库存',
  `safety_stock` int NOT NULL DEFAULT '0' COMMENT '安全库存',
  `monthly_avg_sales` decimal(10,2) DEFAULT '0.00' COMMENT '月均销量',
  `in_transit_qty` int DEFAULT '0' COMMENT '在途采购量',
  `reason` varchar(200) DEFAULT NULL COMMENT '补货原因',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_plan_no` (`plan_no`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购计划明细';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_return`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_return` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '采购退货单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `return_no` varchar(64) NOT NULL COMMENT '退货单号',
  `order_no` varchar(64) DEFAULT NULL COMMENT '关联采购订单号',
  `stock_no` varchar(64) DEFAULT NULL COMMENT '关联入库单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称快照',
  `store_id` bigint unsigned NOT NULL COMMENT '退货门店ID',
  `return_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '合计金额',
  `refund_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应退金额',
  `refunded_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已退金额',
  `operator_id` bigint unsigned NOT NULL COMMENT '退货人',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `return_amount` decimal(12,2) DEFAULT '0.00' COMMENT '退货金额(与refund_amount同义)',
  `status` varchar(32) DEFAULT NULL COMMENT '状态(与return_status同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_return_no` (`return_no`),
  KEY `idx_purchase_return_supplier` (`supplier_id`),
  KEY `idx_purchase_return_created_at` (`created_at`),
  KEY `idx_t_purchase_return_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购退货单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_purchase_return_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_purchase_return_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `return_no` varchar(64) NOT NULL COMMENT '退货单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '退货单价（瓶）',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '税率',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计金额',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '税额',
  `total_amount` decimal(12,2) NOT NULL COMMENT '含税小计',
  `reason` varchar(255) DEFAULT NULL COMMENT '退货原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_return_item_return_no` (`return_no`),
  KEY `idx_purchase_return_item_sku_id` (`sku_id`),
  KEY `idx_t_purchase_return_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采购退货单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_push_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_push_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `push_type` varchar(32) NOT NULL COMMENT '推送类型：ORDER/COLLECTION/MARKETING/SYSTEM',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `quiet_start` time DEFAULT NULL COMMENT '免打扰开始',
  `quiet_end` time DEFAULT NULL COMMENT '免打扰结束',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_type` (`user_id`,`push_type`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='推送配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_push_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_push_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `template_id` bigint unsigned DEFAULT NULL COMMENT '模板ID',
  `push_type` varchar(32) NOT NULL COMMENT '推送类型',
  `channel` varchar(32) NOT NULL COMMENT '渠道',
  `title` varchar(255) NOT NULL COMMENT '推送标题',
  `content` text NOT NULL COMMENT '推送内容',
  `status` varchar(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  `error_msg` varchar(512) DEFAULT NULL COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='推送日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_push_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_push_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL COMMENT '模板编码',
  `name` varchar(128) NOT NULL COMMENT '模板名称',
  `push_type` varchar(32) NOT NULL COMMENT '推送类型：ORDER/COLLECTION/MARKETING/SYSTEM',
  `channel` varchar(32) NOT NULL COMMENT '渠道：WECHAT_MP/SMS/APP_PUSH',
  `title_template` varchar(255) NOT NULL COMMENT '标题模板',
  `content_template` text NOT NULL COMMENT '内容模板',
  `wechat_template_id` varchar(128) DEFAULT NULL COMMENT '微信模板ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_type` (`push_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='推送模板表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_push_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_push_token` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(64) NOT NULL COMMENT '租户ID（多租户隔离）',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `device_id` varchar(128) NOT NULL COMMENT '设备唯一标识',
  `push_token` text NOT NULL COMMENT '推送Token（极光registration_id/FCM token/HMS token）',
  `provider` varchar(32) NOT NULL DEFAULT 'jpush' COMMENT '推送服务商：jpush/fcm/hms',
  `app_platform` varchar(16) NOT NULL COMMENT '平台：android/ios/harmony',
  `app_version` varchar(32) DEFAULT NULL COMMENT 'App版本号',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1=有效，0=失效',
  `last_active_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_push_token_device_provider` (`device_id`,`provider`) COMMENT '设备+服务商唯一键（同一设备同一服务商只能注册一个Token）',
  KEY `idx_push_token_tenant_user` (`tenant_id`,`user_id`) COMMENT '租户+用户联合索引（按用户查询Token）',
  KEY `idx_push_token_device` (`device_id`) COMMENT '设备ID索引（按设备查询/注销）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='推送Token表（App 端推送注册/查询/注销）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_quick_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_quick_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '入口名称',
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标URL或CSS类名',
  `route` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '前端路由路径',
  `group_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分组名称',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1=启用 0=禁用',
  `visible_roles` json DEFAULT NULL COMMENT '可见角色列表（JSON数组），NULL表示所有角色可见',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序值（越小越靠前）',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_sort` (`tenant_id`,`sort_order`),
  KEY `idx_tenant_enabled` (`tenant_id`,`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快捷入口配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_recall_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_recall_record` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `recall_no` varchar(32) NOT NULL COMMENT '召回编号',
  `recall_type` enum('BATCH','CATEGORY','SKU','SUPPLIER','GLOBAL') NOT NULL COMMENT '召回类型',
  `target_value` varchar(128) NOT NULL COMMENT '目标值',
  `target_name` varchar(128) DEFAULT '' COMMENT '目标名称',
  `reason` varchar(255) NOT NULL COMMENT '召回原因',
  `total_affected` int DEFAULT '0' COMMENT '影响总数',
  `total_notified` int DEFAULT '0' COMMENT '已通知数',
  `total_returned` int DEFAULT '0' COMMENT '已退回数',
  `status` enum('CREATED','NOTIFYING','IN_PROGRESS','COMPLETED','CANCELLED') DEFAULT 'CREATED' COMMENT '状态',
  `notify_content` text COMMENT '通知内容',
  `started_at` datetime DEFAULT NULL COMMENT '开始时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `operator_id` int NOT NULL COMMENT '操作人',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recall_no` (`recall_no`),
  KEY `idx_recall_record_status` (`status`),
  KEY `idx_t_recall_record_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='召回记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_receipt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_receipt` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `receipt_no` varchar(32) NOT NULL COMMENT '收款单号',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户名称',
  `receipt_type` varchar(20) NOT NULL DEFAULT 'SALE' COMMENT '类型: SALE/OTHER',
  `amount` decimal(12,2) NOT NULL COMMENT '收款金额',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '付款方式',
  `bank_account_id` bigint DEFAULT NULL COMMENT '银行账户ID',
  `received_date` date DEFAULT NULL COMMENT '收款日期',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/VOIDED',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_receipt_no` (`receipt_no`,`tenant_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收款单';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_receipt_writeoff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_receipt_writeoff` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `receipt_id` bigint NOT NULL COMMENT '收款单ID',
  `receivable_id` bigint NOT NULL COMMENT '应收记录ID',
  `writeoff_amount` decimal(12,2) NOT NULL COMMENT '核销金额',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_receipt` (`receipt_id`),
  KEY `idx_receivable` (`receivable_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收款核销';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_receivable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_receivable` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户名称',
  `source_type` varchar(20) NOT NULL COMMENT '来源类型: SALE_BILL/OTHER',
  `source_no` varchar(32) NOT NULL COMMENT '来源单号',
  `receivable_amount` decimal(12,2) NOT NULL COMMENT '应收金额',
  `received_amount` decimal(12,2) DEFAULT '0.00' COMMENT '已收金额',
  `balance` decimal(12,2) DEFAULT '0.00' COMMENT '余额',
  `due_date` date DEFAULT NULL COMMENT '到期日',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PARTIAL/PAID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_source` (`source_no`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_receivable_customer_id` (`customer_id`),
  KEY `idx_receivable_status` (`status`),
  KEY `idx_receivable_due_date` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应收记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_receivable_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_receivable_account` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '应收ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `receivable_no` varchar(64) NOT NULL COMMENT '应收单号',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL',
  `source_no` varchar(64) NOT NULL COMMENT '来源单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号快照',
  `receivable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应收金额',
  `received_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已收金额',
  `unreceived_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未收金额',
  `status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '状态：UNPAID/PARTIAL/PAID/CLOSED',
  `last_payment_time` datetime DEFAULT NULL COMMENT '最近收款时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_receivable_no` (`receivable_no`),
  UNIQUE KEY `uk_receivable_source` (`source_type`,`source_no`),
  KEY `idx_receivable_store_status` (`store_id`,`status`),
  KEY `idx_receivable_customer_id` (`customer_id`),
  KEY `idx_t_receivable_account_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应收账款表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_referral_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_referral_ledger` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `inviter_tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '邀请人租户ID（逻辑引用 t_tenant.id，类型对齐 varchar(36)，不建物理外键）',
  `invitee_tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '被邀请人租户ID（逻辑引用 t_tenant.id，同型对齐，不建物理外键）',
  `invitee_tenant_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '被邀请人租户编码快照（NULL=未填写，不得用空串冒充未填写）',
  `reward_points` int NOT NULL DEFAULT '0' COMMENT '本条奖励积分（按 20% 口径计算，且受年度上限 60000 截断；0=本年度额度已满本条不累计）',
  `reward_basis` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '计奖基数口径（如 subscribe_amount＝订阅实收口径；只存口径名，不存金额）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待发放/GRANTED-已发放/REVOKED-已冲回',
  `granted_at` datetime DEFAULT NULL COMMENT '发放时间（status=GRANTED 时填写；NULL=尚未发放）',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注（NULL=未填写，不得用空串冒充；年度上限截断原因写在此列）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（同时是年度上限的计年依据）',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invitee` (`invitee_tenant_id`),
  KEY `idx_referral_inviter_created` (`inviter_tenant_id`,`created_at`),
  KEY `idx_referral_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='老带新台账（C6-3-2b：一被邀请租户一条，只记奖励积分口径，无任何金额列）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_refund_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_refund_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '退款单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `refund_no` varchar(64) NOT NULL COMMENT '退款单号',
  `pay_no` varchar(64) NOT NULL COMMENT '支付单号',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型',
  `source_no` varchar(64) NOT NULL COMMENT '来源单号',
  `amount` decimal(12,2) NOT NULL COMMENT '退款金额',
  `reason` varchar(255) DEFAULT NULL COMMENT '退款原因',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/SUCCESS/FAILED',
  `wx_refund_id` varchar(128) DEFAULT NULL COMMENT '微信退款单号',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '操作人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_order_no` (`refund_no`),
  KEY `idx_refund_order_pay_no` (`pay_no`),
  KEY `idx_refund_order_source` (`source_type`,`source_no`),
  KEY `idx_refund_order_status` (`status`),
  KEY `idx_t_refund_order_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='退款单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_collection_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_collection_stats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `report_date` date NOT NULL COMMENT '报表日期',
  `total_links` int NOT NULL DEFAULT '0' COMMENT '生成链接数',
  `paid_links` int NOT NULL DEFAULT '0' COMMENT '已付链接数',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '链接总金额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已付金额',
  `wechat_links` int NOT NULL DEFAULT '0' COMMENT '微信渠道链接数',
  `alipay_links` int NOT NULL DEFAULT '0' COMMENT '支付宝渠道链接数',
  `other_channel_links` int NOT NULL DEFAULT '0' COMMENT '其他渠道链接数',
  `avg_pay_cycle_hours` decimal(8,2) DEFAULT NULL COMMENT '平均付款周期(小时)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`,`store_id`,`report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收款统计汇总';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_customer_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_customer_stats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `report_date` date NOT NULL COMMENT '报表日期',
  `total_customers` int NOT NULL DEFAULT '0' COMMENT '累计客户数',
  `new_customers` int NOT NULL DEFAULT '0' COMMENT '新增客户数',
  `active_customers` int NOT NULL DEFAULT '0' COMMENT '活跃客户数(当月有下单)',
  `repurchase_customers` int NOT NULL DEFAULT '0' COMMENT '复购客户数',
  `lost_customers` int NOT NULL DEFAULT '0' COMMENT '流失客户数(90天未下单)',
  `avg_order_value` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '平均客单价',
  `total_revenue` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '总营收',
  `repurchase_rate` decimal(5,2) DEFAULT NULL COMMENT '复购率(%)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`,`store_id`,`report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户统计汇总';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_inventory_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_inventory_daily` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `report_date` date NOT NULL COMMENT '报表日期',
  `total_sku_count` int NOT NULL DEFAULT '0' COMMENT 'SKU品种数',
  `total_physical_qty` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '实物库存总量',
  `total_available_qty` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '可用库存总量',
  `total_locked_qty` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '锁定库存总量',
  `total_value` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '库存总价值',
  `low_stock_sku_count` int NOT NULL DEFAULT '0' COMMENT '低库存SKU数',
  `zero_stock_sku_count` int NOT NULL DEFAULT '0' COMMENT '零库存SKU数',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`,`store_id`,`report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存日报汇总';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_permission_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_permission_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作人姓名',
  `action` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型：GRANT=授权 REVOKE=撤销 UPDATE=更新',
  `target_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '目标类型：ROLE=角色 USER=用户',
  `target_id` bigint NOT NULL COMMENT '目标ID（角色ID或用户ID）',
  `target_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '目标名称',
  `report_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报表编码',
  `before_value` text COLLATE utf8mb4_unicode_ci COMMENT '变更前值（JSON）',
  `after_value` text COLLATE utf8mb4_unicode_ci COMMENT '变更后值（JSON）',
  `remark` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_operator` (`operator_id`),
  KEY `idx_target` (`target_type`,`target_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报表权限审计日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_permission_matrix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_permission_matrix` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL COMMENT '角色ID',
  `report_code` varchar(64) NOT NULL COMMENT '报表编码',
  `store_scope` varchar(32) NOT NULL DEFAULT 'SELF' COMMENT '门店范围：SELF/CHILDREN/ALL',
  `can_view` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否可查看：0=否 1=是',
  `can_export` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可导出：0=否 1=是',
  `tenant_id` varchar(64) NOT NULL DEFAULT '' COMMENT '租户ID',
  `store_ids` text COMMENT '指定门店ID列表（JSON数组，store_scope=SPECIFIED时使用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_report` (`role_id`,`report_code`),
  KEY `idx_role` (`role_id`),
  KEY `idx_report` (`report_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='报表权限矩阵表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_product_sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_product_sales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `report_date` date NOT NULL COMMENT '报表日期',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SKU名称',
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品分类',
  `sale_bottle_qty` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '销售瓶数',
  `sale_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '销售金额',
  `order_count` int NOT NULL DEFAULT '0' COMMENT '订单数(含此SKU)',
  `rank_in_store` int DEFAULT NULL COMMENT '门店内排名',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_store_date_sku` (`tenant_id`,`store_id`,`report_date`,`sku_id`),
  KEY `idx_report_date` (`report_date`),
  KEY `idx_sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品销售汇总';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_report_sales_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_report_sales_daily` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `report_date` date NOT NULL COMMENT '报表日期',
  `order_count` int NOT NULL DEFAULT '0' COMMENT '订单数',
  `customer_count` int NOT NULL DEFAULT '0' COMMENT '下单客户数',
  `new_customer_count` int NOT NULL DEFAULT '0' COMMENT '新客户数',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `receivable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应收金额',
  `received_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已收金额',
  `unreceived_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未收金额',
  `refund_count` int NOT NULL DEFAULT '0' COMMENT '退款笔数',
  `refund_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '退款金额',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`,`store_id`,`report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='销售日报汇总';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_announcement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_announcement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `title` varchar(128) NOT NULL COMMENT '公告标题',
  `content` text NOT NULL COMMENT '公告内容',
  `is_top` tinyint NOT NULL DEFAULT '0' COMMENT '是否置顶',
  `start_time` datetime DEFAULT NULL COMMENT '开始展示时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束展示时间',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_status_time` (`status`,`start_time`,`end_time`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小程序公告表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_banner`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_banner` (
  `id` int NOT NULL AUTO_INCREMENT,
  `banner_title` varchar(128) NOT NULL COMMENT '轮播图标题',
  `banner_image` varchar(255) NOT NULL COMMENT '轮播图URL',
  `link_type` varchar(32) DEFAULT NULL COMMENT '链接类型（PRODUCT/CATEGORY/URL）',
  `link_value` varchar(255) DEFAULT NULL COMMENT '链接值（商品ID/分类ID/URL）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售轮播图表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_cart` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `checked` tinyint NOT NULL DEFAULT '1' COMMENT '是否选中',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_store_sku` (`user_id`,`store_id`,`sku_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_retail_cart_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='购物车表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_category` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category_name` varchar(64) NOT NULL COMMENT '分类名称',
  `category_icon` varchar(255) DEFAULT NULL COMMENT '分类图标',
  `parent_id` bigint DEFAULT '0' COMMENT '父分类ID（0为一级分类）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `tenant_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售分类表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_consumer_address`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_consumer_address` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `name` varchar(64) NOT NULL COMMENT '收货人姓名',
  `mobile` varchar(20) NOT NULL COMMENT '收货人手机',
  `province` varchar(64) NOT NULL COMMENT '省',
  `city` varchar(64) NOT NULL COMMENT '市',
  `district` varchar(64) NOT NULL COMMENT '区',
  `detail` varchar(255) NOT NULL COMMENT '详细地址',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认地址',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_default` (`user_id`,`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消费者收货地址表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_operation_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module` varchar(32) NOT NULL COMMENT '模块（shop/category/product/order/delivery）',
  `action` varchar(32) NOT NULL COMMENT '操作类型',
  `target_id` varchar(64) NOT NULL COMMENT '目标ID',
  `target_type` varchar(32) NOT NULL COMMENT '目标类型',
  `user_id` int DEFAULT NULL COMMENT '操作人ID',
  `user_name` varchar(64) DEFAULT NULL COMMENT '操作人姓名',
  `detail` varchar(500) DEFAULT NULL COMMENT '操作详情',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_module` (`module`),
  KEY `idx_target` (`target_id`,`target_type`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_order` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_no` varchar(32) NOT NULL COMMENT '订单编号',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `user_name` varchar(64) DEFAULT NULL COMMENT '用户姓名',
  `user_phone` varchar(20) DEFAULT NULL COMMENT '用户电话',
  `total_amount` decimal(10,2) NOT NULL COMMENT '订单总金额',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '配送费',
  `pay_amount` decimal(10,2) NOT NULL COMMENT '实付金额',
  `delivery_type` varchar(16) NOT NULL COMMENT '配送方式（DELIVERY/PICKUP）',
  `delivery_address` varchar(255) DEFAULT NULL COMMENT '配送地址',
  `delivery_time` datetime DEFAULT NULL COMMENT '配送时间',
  `receiver_name` varchar(64) DEFAULT NULL COMMENT '收货人姓名',
  `receiver_phone` varchar(20) DEFAULT NULL COMMENT '收货人电话',
  `receiver_latitude` decimal(10,6) DEFAULT NULL COMMENT '收货人纬度',
  `receiver_longitude` decimal(10,6) DEFAULT NULL COMMENT '收货人经度',
  `remark` varchar(500) DEFAULT NULL COMMENT '订单备注',
  `payment_status` varchar(16) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态（UNPAID/PAID/REFUNDED）',
  `payment_method` varchar(32) DEFAULT NULL COMMENT '支付方式（WECHAT/ALIPAY）',
  `payment_time` datetime DEFAULT NULL COMMENT '支付时间',
  `transaction_no` varchar(128) DEFAULT NULL COMMENT '交易流水号',
  `order_status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态（PENDING/CONFIRMED/PREPARING/DELIVERING/COMPLETED/CANCELLED）',
  `cancel_reason` varchar(255) DEFAULT NULL COMMENT '取消原因',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_no` (`order_no`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_order_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `sku_id` bigint DEFAULT NULL COMMENT 'SKU ID',
  `product_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名称',
  `product_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品图片',
  `price` decimal(10,2) NOT NULL COMMENT '单价',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '数量',
  `subtotal` decimal(10,2) NOT NULL COMMENT '小计',
  `tenant_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  CONSTRAINT `fk_retail_order_item_order` FOREIGN KEY (`order_id`) REFERENCES `t_retail_order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售订单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_product` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT '关联商品ID（product_sku表）',
  `category_id` bigint DEFAULT NULL COMMENT '分类ID',
  `retail_price` decimal(10,2) NOT NULL COMMENT '零售价',
  `original_price` decimal(10,2) DEFAULT NULL COMMENT '原价',
  `stock` int NOT NULL DEFAULT '0' COMMENT '库存',
  `sales_count` int NOT NULL DEFAULT '0' COMMENT '销量',
  `is_recommended` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否推荐',
  `is_hot` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否热销',
  `is_new` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否新品',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE/SOLD_OUT）',
  `tenant_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_tenant` (`product_id`,`tenant_id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_recommended` (`is_recommended`),
  KEY `idx_hot` (`is_hot`),
  KEY `idx_new` (`is_new`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售商品表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_review` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `product_id` bigint DEFAULT NULL COMMENT '商品ID',
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源平台',
  `platform_review_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '平台评价ID',
  `rating` decimal(2,1) NOT NULL COMMENT '评分',
  `review_content` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '评价内容',
  `review_images` json DEFAULT NULL COMMENT '评价图片',
  `review_tags` json DEFAULT NULL COMMENT '评价标签',
  `reply` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商家回复',
  `reply_at` datetime DEFAULT NULL COMMENT '回复时间',
  `is_anonymous` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否匿名',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态',
  `tenant_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_platform_review` (`platform_review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售评价表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_retail_shop_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_retail_shop_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `shop_name` varchar(128) NOT NULL COMMENT '店铺名称',
  `shop_logo` varchar(255) DEFAULT NULL COMMENT '店铺Logo',
  `shop_description` varchar(500) DEFAULT NULL COMMENT '店铺描述',
  `contact_phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `business_hours` varchar(100) DEFAULT NULL COMMENT '营业时间（如：09:00-22:00）',
  `delivery_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用配送',
  `pickup_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用自提',
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '最低起送金额',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '配送费',
  `free_delivery_amount` decimal(10,2) DEFAULT NULL COMMENT '免配送费金额',
  `delivery_radius` decimal(10,2) DEFAULT NULL COMMENT '配送半径（公里）',
  `estimated_delivery_time` varchar(50) DEFAULT NULL COMMENT '预计配送时间（如：30-45分钟）',
  `announcement` varchar(500) DEFAULT NULL COMMENT '店铺公告',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `tenant_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='即时零售店铺配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_role_data_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_role_data_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `role_id` bigint unsigned NOT NULL COMMENT '角色ID',
  `data_permission_id` bigint unsigned NOT NULL COMMENT '数据权限ID',
  `scope_values` json DEFAULT NULL COMMENT '数据范围值（如部门ID列表、门店ID列表、客户ID列表）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_data_permission` (`role_id`,`data_permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_data_permission_id` (`data_permission_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色数据权限关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_bill`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_bill` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '销售单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `bill_no` varchar(64) NOT NULL COMMENT '销售单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID，可为空',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号快照',
  `customer_type` varchar(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份快照',
  `sale_type` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型：CASH(现销)/CREDIT(赊销)',
  `business_status` varchar(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态：DRAFT/CREATED/COMPLETED/VOIDED/RETURNED',
  `collection_status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态：UNPAID/PENDING/SHARED/PARTIAL/PAID/OVERDUE/CLOSED',
  `due_date` date DEFAULT NULL COMMENT '应收截止日期（赊销时）',
  `statement_id` bigint unsigned DEFAULT NULL COMMENT '关联对账单ID',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `rounding_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '抹零金额',
  `receivable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应收金额',
  `received_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已收金额',
  `unreceived_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未收金额',
  `share_collection_count` int NOT NULL DEFAULT '0' COMMENT '分享收款次数',
  `last_share_time` datetime DEFAULT NULL COMMENT '最近分享时间',
  `last_payment_time` datetime DEFAULT NULL COMMENT '最近收款时间',
  `locked_amount_flag` tinyint NOT NULL DEFAULT '0' COMMENT '金额是否锁定',
  `operator_id` bigint unsigned NOT NULL COMMENT '开单人',
  `operator_name` varchar(64) DEFAULT NULL COMMENT '制单人快照',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人ID',
  `auditor_name` varchar(64) DEFAULT NULL COMMENT '审核人快照',
  `salesman_id` bigint unsigned DEFAULT NULL COMMENT '业务员ID',
  `salesman_name` varchar(64) DEFAULT NULL COMMENT '业务员快照',
  `remark` varchar(255) DEFAULT NULL COMMENT '客户可见备注',
  `internal_remark` varchar(255) DEFAULT NULL COMMENT '内部备注',
  `void_reason` varchar(255) DEFAULT NULL COMMENT '作废原因',
  `void_source` varchar(16) NOT NULL DEFAULT 'admin' COMMENT '取消来源：admin=工作台/移动端人工取消，ai=AI 底座取消',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `store_name` varchar(128) DEFAULT NULL COMMENT '门店名称快照',
  `store_address` varchar(255) DEFAULT NULL COMMENT '门店地址快照',
  `store_contact` varchar(64) DEFAULT NULL COMMENT '门店联系方式快照',
  `status` varchar(32) DEFAULT NULL COMMENT '状态冗余(payment服务写入PAID)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_bill_no` (`bill_no`),
  KEY `idx_sale_bill_store_status` (`store_id`,`business_status`,`collection_status`),
  KEY `idx_sale_bill_customer_id` (`customer_id`),
  KEY `idx_sale_bill_created_at` (`created_at`),
  KEY `idx_t_sale_bill_tenant` (`tenant_id`),
  KEY `idx_sale_bill_credit_overdue` (`sale_type`,`due_date`,`collection_status`),
  KEY `idx_sale_bill_date_range` (`created_at`,`tenant_id`),
  KEY `idx_sale_bill_receivable_status` (`collection_status`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='线下销售单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_bill_archive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_bill_archive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '销售单ID（归档）',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `bill_no` varchar(64) NOT NULL COMMENT '销售单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号快照',
  `customer_type` varchar(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份快照',
  `sale_type` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型',
  `business_status` varchar(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态',
  `collection_status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态',
  `due_date` date DEFAULT NULL COMMENT '应收截止日期',
  `statement_id` bigint unsigned DEFAULT NULL COMMENT '关联对账单ID',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `rounding_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '抹零金额',
  `receivable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应收金额',
  `received_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已收金额',
  `unreceived_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '未收金额',
  `share_collection_count` int NOT NULL DEFAULT '0' COMMENT '分享收款次数',
  `last_share_time` datetime DEFAULT NULL COMMENT '最近分享时间',
  `last_payment_time` datetime DEFAULT NULL COMMENT '最近收款时间',
  `locked_amount_flag` tinyint NOT NULL DEFAULT '0' COMMENT '金额锁定',
  `operator_id` bigint unsigned NOT NULL COMMENT '开单人',
  `remark` varchar(255) DEFAULT NULL COMMENT '客户可见备注',
  `internal_remark` varchar(255) DEFAULT NULL COMMENT '内部备注',
  `void_reason` varchar(255) DEFAULT NULL COMMENT '作废原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_bill_archive_no` (`bill_no`),
  KEY `idx_sale_bill_archive_tenant` (`tenant_id`),
  KEY `idx_sale_bill_archive_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售单归档表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_bill_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_bill_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `bill_no` varchar(64) NOT NULL COMMENT '销售单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `sku_spec` varchar(128) DEFAULT NULL COMMENT '规格快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '成交单价，按瓶',
  `price_type` varchar(32) NOT NULL COMMENT '价格类型：RETAIL/WHOLESALE/STORE',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计',
  `item_remark` varchar(255) DEFAULT NULL COMMENT '行备注',
  `item_discount` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '行折扣率%',
  `trace_codes` json DEFAULT NULL COMMENT '追溯码列表',
  `trace_required` tinyint NOT NULL DEFAULT '0' COMMENT '是否需要追溯',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unit` varchar(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照（瓶/箱）',
  `barcode` varchar(128) DEFAULT NULL COMMENT '条形码快照',
  `spec` varchar(128) DEFAULT NULL COMMENT '规格描述快照（如：500ml/瓶）',
  PRIMARY KEY (`id`),
  KEY `idx_sale_bill_item_bill_no` (`bill_no`),
  KEY `idx_sale_bill_item_sku_id` (`sku_id`),
  KEY `idx_t_sale_bill_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='线下销售单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_bill_item_archive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_bill_item_archive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `bill_no` varchar(64) NOT NULL COMMENT '销售单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '成交单价',
  `price_type` varchar(32) NOT NULL COMMENT '价格类型',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计',
  `trace_required` tinyint NOT NULL DEFAULT '0' COMMENT '是否需要追溯',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale_bill_item_archive_bill` (`bill_no`),
  KEY `idx_sale_bill_item_archive_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售单明细归档表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_payment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '销售收款单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `receipt_no` varchar(64) NOT NULL COMMENT '收款单号',
  `source_type` varchar(32) NOT NULL COMMENT '来源类型：SALE_BILL/SALE_RETURN/STATEMENT',
  `source_no` varchar(64) NOT NULL COMMENT '来源单号',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户名称快照',
  `amount` decimal(12,2) NOT NULL COMMENT '收款金额',
  `payment_method` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH/WECHAT/ALIPAY/BANK/COLLECTION',
  `voucher_no` varchar(64) DEFAULT NULL COMMENT '凭证号',
  `payment_date` date NOT NULL COMMENT '收款日期',
  `operator_id` bigint unsigned NOT NULL COMMENT '收款人',
  `status` varchar(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED/VOIDED',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_payment_receipt_no` (`receipt_no`),
  KEY `idx_sale_payment_source` (`source_type`,`source_no`),
  KEY `idx_sale_payment_customer` (`customer_id`),
  KEY `idx_sale_payment_created_at` (`created_at`),
  KEY `idx_t_sale_payment_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售收款单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_return`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_return` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '销售退货单ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `return_no` varchar(64) NOT NULL COMMENT '退货单号',
  `source_bill_no` varchar(64) DEFAULT NULL COMMENT '关联销售单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT '客户ID',
  `customer_name` varchar(64) DEFAULT NULL COMMENT '客户名称快照',
  `customer_mobile` varchar(20) DEFAULT NULL COMMENT '客户手机号快照',
  `return_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  `approval_instance_no` varchar(64) DEFAULT NULL COMMENT '关联审批实例号',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `refund_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应退金额',
  `refunded_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已退金额',
  `refund_method` varchar(32) DEFAULT NULL COMMENT '退款方式：CASH(现金)/WECHAT(微信原路退回)/BANK(银行转账)',
  `operator_id` bigint unsigned NOT NULL COMMENT '退货人',
  `auditor_id` bigint unsigned DEFAULT NULL COMMENT '审核人',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_return_no` (`return_no`),
  KEY `idx_sale_return_source_bill` (`source_bill_no`),
  KEY `idx_sale_return_customer` (`customer_id`),
  KEY `idx_sale_return_created_at` (`created_at`),
  KEY `idx_t_sale_return_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售退货单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sale_return_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sale_return_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `return_no` varchar(64) NOT NULL COMMENT '退货单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL COMMENT 'SKU名称快照',
  `box_qty` int NOT NULL DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int NOT NULL DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL COMMENT '合计瓶数',
  `unit_price` decimal(12,2) NOT NULL COMMENT '退货单价（瓶）',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计',
  `reason` varchar(255) DEFAULT NULL COMMENT '退货原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale_return_item_return_no` (`return_no`),
  KEY `idx_sale_return_item_sku_id` (`sku_id`),
  KEY `idx_t_sale_return_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售退货单明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sales_commission_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sales_commission_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_no` varchar(32) NOT NULL COMMENT '记录编号',
  `bill_no` varchar(32) NOT NULL COMMENT '销售单号',
  `staff_id` bigint NOT NULL COMMENT '员工ID',
  `rule_id` bigint NOT NULL COMMENT '提成规则ID',
  `commission_amount` decimal(12,2) NOT NULL COMMENT '提成金额',
  `base_amount` decimal(12,2) NOT NULL COMMENT '计算基数',
  `rate` decimal(6,4) DEFAULT NULL COMMENT '提成比例',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SETTLED/CANCELLED',
  `settled_at` datetime DEFAULT NULL COMMENT '结算时间',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_no` (`record_no`,`tenant_id`),
  KEY `idx_bill_no` (`bill_no`),
  KEY `idx_staff` (`staff_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售提成记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sales_commission_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sales_commission_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `rule_type` varchar(20) NOT NULL COMMENT '规则类型: FIXED_AMOUNT/FIXED_RATE/TIERED',
  `config` json NOT NULL COMMENT '规则配置 JSON',
  `effective_start` date DEFAULT NULL COMMENT '生效开始日期',
  `effective_end` date DEFAULT NULL COMMENT '生效结束日期',
  `status` tinyint DEFAULT '1' COMMENT '状态 1=启用 0=停用',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='销售提成规则';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_seckill_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_seckill_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '秒杀订单ID',
  `order_no` varchar(32) NOT NULL COMMENT '秒杀订单号(前缀MK+日期8位+5位随机)',
  `activity_id` int NOT NULL COMMENT '秒杀活动ID(t_seckill_product.id)',
  `product_id` int NOT NULL COMMENT '商品ID',
  `member_id` int NOT NULL COMMENT '下单用户ID(会员ID)',
  `member_name` varchar(64) DEFAULT NULL COMMENT '用户姓名快照',
  `member_mobile` varchar(20) DEFAULT NULL COMMENT '用户手机号快照',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '购买数量',
  `seckill_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '秒杀单价快照',
  `original_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '原价快照',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '订单金额',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING_PAY' COMMENT '状态: PENDING_PAY/PAID/CANCELLED/EXPIRED',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `cancel_reason` varchar(255) DEFAULT NULL COMMENT '取消原因',
  `tenant_id` varchar(36) NOT NULL DEFAULT '' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_seckill_order_no` (`order_no`),
  KEY `idx_seckill_order_activity` (`activity_id`),
  KEY `idx_seckill_order_member` (`member_id`),
  KEY `idx_seckill_order_status` (`status`),
  KEY `idx_seckill_order_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='秒杀订单表(社区营销秒杀参与记录)';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_seckill_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_seckill_product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL COMMENT '活动ID',
  `product_id` int NOT NULL COMMENT '商品ID',
  `seckill_price` decimal(10,2) NOT NULL COMMENT '秒杀价格',
  `seckill_stock` int NOT NULL DEFAULT '0' COMMENT '秒杀总库存(与 total_stock 同义, admin 秒杀管理写入)',
  `original_price` decimal(10,2) NOT NULL COMMENT '原价',
  `total_stock` int NOT NULL COMMENT '秒杀总库存',
  `available_stock` int NOT NULL COMMENT '剩余库存',
  `limit_per_user` int NOT NULL DEFAULT '1' COMMENT '每人限购数量',
  `start_time` datetime DEFAULT NULL COMMENT '秒杀开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '秒杀结束时间',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/ACTIVE/PAUSED/ENDED',
  `tenant_id` varchar(36) NOT NULL DEFAULT '' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_product` (`activity_id`,`product_id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_product` (`product_id`),
  CONSTRAINT `t_seckill_product_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `t_promotion_activity` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='秒杀商品表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_shift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_shift` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '交接班ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `shift_no` varchar(64) NOT NULL COMMENT '交接班单号',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `operator_id` bigint DEFAULT NULL COMMENT '操作员ID',
  `operator_name` varchar(64) DEFAULT NULL COMMENT '操作员姓名',
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `status` varchar(16) NOT NULL DEFAULT 'OPEN' COMMENT '状态：OPEN/CLOSED',
  `opening_cash` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '接班备用金',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `shift_type` varchar(16) NOT NULL DEFAULT '' COMMENT '班次类型：MORNING/AFTERNOON/EVENING（空=按 start_time 派生）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shift_no` (`shift_no`,`tenant_id`),
  KEY `idx_shift_store_status` (`tenant_id`,`store_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='交接班记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_shift_stock_check`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_shift_stock_check` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '盘点明细ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `shift_no` varchar(64) NOT NULL COMMENT '交接班单号',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `expected_qty` decimal(12,3) NOT NULL DEFAULT '0.000' COMMENT '账面数量',
  `actual_qty` decimal(12,3) NOT NULL DEFAULT '0.000' COMMENT '实盘数量',
  `diff_qty` decimal(12,3) NOT NULL DEFAULT '0.000' COMMENT '差异数量',
  `diff_reason` varchar(200) DEFAULT NULL COMMENT '差异原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shift_sku` (`shift_no`,`sku_id`,`tenant_id`),
  KEY `idx_shift_check_sku` (`sku_id`,`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='交接班盘点明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sku_price`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sku_price` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `sku_id` int NOT NULL COMMENT 'SKU ID',
  `price_level_id` int NOT NULL COMMENT '价格等级ID',
  `min_qty` int DEFAULT '1' COMMENT '起订量',
  `price` decimal(12,2) NOT NULL COMMENT '单价',
  `cost_price` decimal(12,2) DEFAULT '0.00' COMMENT '成本价（仅管理员可见）',
  `suggested_retail_price` decimal(12,2) DEFAULT '0.00' COMMENT '建议零售价',
  `effective_start` date DEFAULT NULL COMMENT '生效开始日期',
  `effective_end` date DEFAULT NULL COMMENT '生效结束日期',
  `status` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku_level_qty` (`sku_id`,`price_level_id`,`min_qty`),
  KEY `idx_sku_price_sku_id` (`sku_id`),
  KEY `idx_sku_price_level_id` (`price_level_id`),
  KEY `idx_t_sku_price_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='阶梯价格表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sms_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sms_template` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `name` varchar(64) NOT NULL COMMENT '模板名称',
  `code` varchar(64) NOT NULL COMMENT '模板编码（短信服务商模板CODE）',
  `content` varchar(500) NOT NULL COMMENT '模板内容',
  `purpose` varchar(32) NOT NULL DEFAULT '' COMMENT '用途：REGISTER_LOGIN/ORDER_NOTICE等',
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED' COMMENT '状态：ENABLED/DISABLED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sms_template_code` (`tenant_id`,`code`),
  KEY `idx_sms_template_purpose` (`tenant_id`,`purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='短信模板表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_stock_check`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_stock_check` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `check_no` varchar(32) NOT NULL COMMENT '盘点编号',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `check_status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CHECKING/CHECKED/AUDITED',
  `total_sku` int DEFAULT '0' COMMENT '盘点SKU总数',
  `checked_sku` int DEFAULT '0' COMMENT '已盘点SKU数',
  `profit_qty` int DEFAULT '0' COMMENT '盘盈数量',
  `loss_qty` int DEFAULT '0' COMMENT '盘亏数量',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `auditor_id` bigint DEFAULT NULL COMMENT '审核人ID',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` varchar(32) DEFAULT NULL COMMENT '盘点状态(与check_status同义)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `diff_sku` int DEFAULT '0' COMMENT '差异SKU数',
  `diff_amount` decimal(12,2) DEFAULT '0.00' COMMENT '差异金额',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_check_no` (`check_no`,`tenant_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_status` (`check_status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='盘点单';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_stock_check_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_stock_check_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `check_no` varchar(32) NOT NULL COMMENT '盘点编号',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `book_qty` int NOT NULL DEFAULT '0' COMMENT '账面数量',
  `actual_qty` int DEFAULT NULL COMMENT '实际数量',
  `diff_qty` int DEFAULT '0' COMMENT '差异数量',
  `diff_reason` varchar(200) DEFAULT NULL COMMENT '差异原因',
  `cost_price` decimal(12,2) DEFAULT '0.00' COMMENT '成本价',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `check_id` bigint DEFAULT NULL COMMENT '盘点单ID',
  `sku_name` varchar(128) DEFAULT NULL COMMENT 'SKU名称快照',
  `system_qty` int DEFAULT '0' COMMENT '系统数量(与book_qty同义)',
  `batch_no` varchar(64) DEFAULT NULL COMMENT '批次号',
  `diff_amount` decimal(12,2) DEFAULT '0.00' COMMENT '差异金额',
  PRIMARY KEY (`id`),
  KEY `idx_check_no` (`check_no`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='盘点单明细';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_stock_warning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_stock_warning` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '预警ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `sku_id` bigint unsigned DEFAULT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) DEFAULT NULL COMMENT 'SKU名称',
  `current_stock` int NOT NULL DEFAULT '0' COMMENT '当前库存',
  `warning_threshold` int NOT NULL DEFAULT '0' COMMENT '预警阈值',
  `warning_level` varchar(32) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别: URGENT/WARNING/INFO',
  `store_name` varchar(100) DEFAULT NULL COMMENT '门店名称',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/RESOLVED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_stock_warning_sku` (`sku_id`),
  KEY `idx_stock_warning_level` (`warning_level`),
  KEY `idx_stock_warning_status` (`status`),
  KEY `idx_stock_warning_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存预警表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_stock_warning_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_stock_warning_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `min_qty` int NOT NULL DEFAULT '0' COMMENT '最低库存阈值',
  `max_qty` int NOT NULL DEFAULT '0' COMMENT '最高库存阈值',
  `enabled` tinyint DEFAULT '1' COMMENT '是否启用',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_sku` (`store_id`,`sku_id`,`tenant_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存预警配置';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_store` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '门店ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `store_code` varchar(64) NOT NULL COMMENT '门店编码',
  `name` varchar(128) NOT NULL COMMENT '门店名称',
  `address` varchar(255) NOT NULL COMMENT '详细地址',
  `lng` decimal(10,6) DEFAULT NULL COMMENT '经度',
  `lat` decimal(10,6) DEFAULT NULL COMMENT '纬度',
  `contact` varchar(64) DEFAULT NULL COMMENT '联系人',
  `phone` varchar(32) DEFAULT NULL COMMENT '联系电话',
  `delivery_radius` decimal(6,2) NOT NULL DEFAULT '3.00' COMMENT '配送半径，单位公里',
  `business_status` varchar(32) NOT NULL DEFAULT 'OPEN' COMMENT '营业状态：OPEN/PAUSED/CLOSED',
  `status` varchar(20) NOT NULL DEFAULT 'OPEN' COMMENT '门店状态: OPEN/CLOSED/SUSPENDED',
  `fulfillment_delivery_enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否支持配送',
  `fulfillment_pickup_enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否支持自提',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `miniapp_appid` varchar(128) DEFAULT NULL COMMENT '小程序appid',
  `wx_merchant_name` varchar(128) DEFAULT NULL COMMENT '微信商户名称',
  `wx_service_phone` varchar(32) DEFAULT NULL COMMENT '微信客服电话',
  `wx_head_img` varchar(512) DEFAULT NULL COMMENT '微信头像URL',
  `wx_qrcode_url` varchar(512) DEFAULT NULL COMMENT '微信二维码URL',
  `store_name` varchar(128) DEFAULT NULL COMMENT '门店名称(与name同义,仓库管理写入)',
  `store_type` varchar(32) NOT NULL DEFAULT 'STORE' COMMENT '门店类型: STORE/WAREHOUSE',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认仓库/门店',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_code` (`store_code`),
  KEY `idx_store_business_status` (`business_status`),
  KEY `idx_store_status` (`status`),
  KEY `idx_t_store_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='门店表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_store_control_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_store_control_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `store_id` int NOT NULL COMMENT '门店ID',
  `auto_open_time` varchar(10) DEFAULT NULL COMMENT '自动开门时间（HH:mm）',
  `auto_close_time` varchar(10) DEFAULT NULL COMMENT '自动关门时间（HH:mm）',
  `max_daily_orders` int DEFAULT NULL COMMENT '每日最大订单数',
  `max_order_amount` decimal(10,2) DEFAULT NULL COMMENT '每日最大订单金额',
  `suspended_reason` varchar(500) DEFAULT NULL COMMENT '暂停原因',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `store_id` (`store_id`),
  KEY `idx_t_store_control_config_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='门店管控配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_store_status_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_store_status_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `store_id` int NOT NULL COMMENT '门店ID',
  `from_status` varchar(20) NOT NULL COMMENT '变更前状态',
  `to_status` varchar(20) NOT NULL COMMENT '变更后状态',
  `change_type` enum('MANUAL','SCHEDULED','AUTO') NOT NULL COMMENT '变更类型',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `remark` varchar(255) DEFAULT '' COMMENT '备注',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_status_log_store` (`store_id`),
  KEY `idx_store_status_log_change_type` (`change_type`),
  KEY `idx_t_store_status_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='门店状态变更记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_store_value_card`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_store_value_card` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `card_no` varchar(32) NOT NULL COMMENT '卡号',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '客户姓名',
  `balance` decimal(12,2) DEFAULT '0.00' COMMENT '当前余额',
  `total_recharge` decimal(12,2) DEFAULT '0.00' COMMENT '累计充值',
  `total_consume` decimal(12,2) DEFAULT '0.00' COMMENT '累计消费',
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/FROZEN/CANCELLED',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_card_no` (`card_no`,`tenant_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='储值卡';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_store_value_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_store_value_transaction` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `trans_no` varchar(32) NOT NULL COMMENT '交易编号',
  `card_no` varchar(32) NOT NULL COMMENT '卡号',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `type` varchar(20) NOT NULL COMMENT '类型: RECHARGE/CONSUME/REFUND/ADJUST',
  `amount` decimal(12,2) NOT NULL COMMENT '金额',
  `balance_after` decimal(12,2) NOT NULL COMMENT '交易后余额',
  `pay_method` varchar(20) DEFAULT NULL COMMENT '支付方式',
  `source_no` varchar(32) DEFAULT NULL COMMENT '来源单号',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_card_no` (`card_no`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_type` (`type`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='储值卡交易记录';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_subscription`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_subscription` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subscription_no` varchar(32) NOT NULL COMMENT '订阅编号（如：SUB20260623001）',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `plan_id` int NOT NULL COMMENT '套餐ID',
  `plan_name` varchar(64) NOT NULL COMMENT '套餐名称（冗余）',
  `plan_type` varchar(32) NOT NULL COMMENT '套餐类型',
  `start_date` date NOT NULL COMMENT '开始日期',
  `end_date` date NOT NULL COMMENT '结束日期',
  `duration_days` int NOT NULL COMMENT '有效天数',
  `price` decimal(10,2) NOT NULL COMMENT '订阅价格',
  `payment_status` varchar(16) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态（UNPAID/PAID/PARTIAL/REFUNDED）',
  `payment_method` varchar(32) DEFAULT NULL COMMENT '支付方式（WECHAT/ALIPAY/BANK_TRANSFER/CASH）',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `transaction_no` varchar(128) DEFAULT NULL COMMENT '交易流水号',
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否自动续费',
  `renew_price` decimal(10,2) DEFAULT NULL COMMENT '续费价格',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/EXPIRED/CANCELLED/SUSPENDED）',
  `cancel_reason` varchar(255) DEFAULT NULL COMMENT '取消原因',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `expire_notify_sent` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已发送到期通知',
  `expire_notify_at` datetime DEFAULT NULL COMMENT '到期通知发送时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_no` varchar(64) DEFAULT NULL COMMENT '订单号',
  `plan_code` varchar(32) DEFAULT NULL COMMENT '套餐编码',
  `amount` decimal(12,2) DEFAULT NULL COMMENT '订单金额',
  `created_by` bigint DEFAULT NULL COMMENT '创建人ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription_no` (`subscription_no`),
  KEY `idx_subscription_no` (`subscription_no`),
  KEY `idx_subscription_tenant` (`tenant_id`),
  KEY `idx_subscription_plan` (`plan_id`),
  KEY `idx_subscription_status` (`status`),
  KEY `idx_subscription_end_date` (`end_date`),
  KEY `idx_subscription_payment` (`payment_status`),
  CONSTRAINT `t_subscription_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `t_tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `t_subscription_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `t_subscription_plan` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订阅表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_subscription_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_subscription_operation_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subscription_id` int NOT NULL COMMENT '订阅ID',
  `operation_type` varchar(32) NOT NULL COMMENT '操作类型（CREATE/RENEW/UPGRADE/DOWNGRADE/CANCEL/SUSPEND/RESUME）',
  `old_plan_id` int DEFAULT NULL COMMENT '原套餐ID',
  `new_plan_id` int DEFAULT NULL COMMENT '新套餐ID',
  `old_end_date` date DEFAULT NULL COMMENT '原结束日期',
  `new_end_date` date DEFAULT NULL COMMENT '新结束日期',
  `amount` decimal(10,2) DEFAULT NULL COMMENT '涉及金额',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(64) DEFAULT NULL COMMENT '操作人姓名',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_log_subscription` (`subscription_id`),
  KEY `idx_log_operation` (`operation_type`),
  KEY `idx_log_created` (`created_at`),
  CONSTRAINT `t_subscription_operation_log_ibfk_1` FOREIGN KEY (`subscription_id`) REFERENCES `t_subscription` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订阅操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_subscription_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_subscription_plan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_code` varchar(32) NOT NULL COMMENT '套餐编码（如：BASIC/STANDARD/PROFESSIONAL）',
  `plan_name` varchar(64) NOT NULL COMMENT '套餐名称',
  `plan_type` varchar(32) NOT NULL COMMENT '套餐类型（MONTHLY/YEARLY/PERMANENT）',
  `price` decimal(10,2) NOT NULL COMMENT '价格',
  `original_price` decimal(10,2) DEFAULT NULL COMMENT '原价',
  `duration_days` int NOT NULL COMMENT '有效天数（如：30/365/9999）',
  `max_users` int NOT NULL DEFAULT '5' COMMENT '最大用户数',
  `max_stores` int NOT NULL DEFAULT '1' COMMENT '最大门店数',
  `max_customers` int NOT NULL DEFAULT '1000' COMMENT '最大客户数',
  `max_products` int NOT NULL DEFAULT '500' COMMENT '最大商品数',
  `max_storage_mb` int NOT NULL DEFAULT '1024' COMMENT '最大存储空间（MB）',
  `features` json DEFAULT NULL COMMENT '功能特性列表（JSON格式）',
  `module_access` json DEFAULT NULL COMMENT '可访问模块（JSON格式，如：["sales","purchase","inventory"]）',
  `description` varchar(500) DEFAULT NULL COMMENT '套餐描述',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plan_code` (`plan_code`),
  KEY `idx_plan_code` (`plan_code`),
  KEY `idx_plan_status` (`status`),
  KEY `idx_plan_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订阅套餐表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_supplier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_supplier` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '供应商ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `supplier_code` varchar(64) NOT NULL COMMENT '供应商编码',
  `name` varchar(128) NOT NULL COMMENT '供应商名称',
  `short_name` varchar(64) DEFAULT NULL COMMENT '简称',
  `category` varchar(32) DEFAULT NULL COMMENT '类别：酒厂/经销商/批发商',
  `province` varchar(64) DEFAULT NULL COMMENT '省',
  `city` varchar(64) DEFAULT NULL COMMENT '市',
  `district` varchar(64) DEFAULT NULL COMMENT '区',
  `address` varchar(255) DEFAULT NULL COMMENT '详细地址',
  `credit_level` varchar(16) DEFAULT 'B' COMMENT '信用等级：A/B/C/D',
  `settlement_type` varchar(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH(现结)/MONTHLY(月结)/QUARTERLY(季结)',
  `settlement_day` int DEFAULT NULL COMMENT '结算日（月结时：1-31）',
  `tax_rate` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT '默认税率',
  `bank_name` varchar(128) DEFAULT NULL COMMENT '开户银行',
  `bank_account` varchar(64) DEFAULT NULL COMMENT '银行账号',
  `bank_account_name` varchar(64) DEFAULT NULL COMMENT '开户名',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contact_name` varchar(64) DEFAULT NULL COMMENT '联系人名称(冗余)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_supplier_code` (`supplier_code`),
  KEY `idx_supplier_name` (`name`),
  KEY `idx_supplier_status` (`status`),
  KEY `idx_t_supplier_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='供应商表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_supplier_contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_supplier_contact` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '联系人ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `name` varchar(64) NOT NULL COMMENT '联系人姓名',
  `mobile` varchar(20) DEFAULT NULL COMMENT '手机号',
  `phone` varchar(32) DEFAULT NULL COMMENT '固定电话',
  `email` varchar(128) DEFAULT NULL COMMENT '邮箱',
  `wechat` varchar(64) DEFAULT NULL COMMENT '微信号',
  `is_primary` tinyint NOT NULL DEFAULT '0' COMMENT '是否主联系人：1是，0否',
  `position` varchar(64) DEFAULT NULL COMMENT '职位',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_contact_supplier_id` (`supplier_id`),
  KEY `idx_supplier_contact_mobile` (`mobile`),
  KEY `idx_t_supplier_contact_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='供应商联系人表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_supplier_statement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_supplier_statement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `statement_no` varchar(30) NOT NULL COMMENT '对账单号',
  `supplier_id` bigint unsigned NOT NULL COMMENT '供应商ID',
  `period_start` date NOT NULL COMMENT '对账开始日期',
  `period_end` date NOT NULL COMMENT '对账结束日期',
  `total_purchase_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '采购总额',
  `total_paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已付总额',
  `total_return_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '退货总额',
  `balance_amount` decimal(12,2) GENERATED ALWAYS AS (((`total_purchase_amount` - `total_paid_amount`) - `total_return_amount`)) STORED COMMENT '余额',
  `status` enum('DRAFT','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
  `confirmed_by` bigint DEFAULT NULL COMMENT '确认人',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `start_date` date DEFAULT NULL COMMENT '对账开始日期(与period_start同义)',
  `end_date` date DEFAULT NULL COMMENT '对账结束日期(与period_end同义)',
  `statement_status` varchar(32) DEFAULT NULL COMMENT '对账状态(与status同义)',
  `purchase_amount` decimal(12,2) DEFAULT '0.00' COMMENT '采购金额(与total_purchase_amount同义)',
  `return_amount` decimal(12,2) DEFAULT '0.00' COMMENT '退货金额(与total_return_amount同义)',
  `paid_amount` decimal(12,2) DEFAULT '0.00' COMMENT '已付金额(与total_paid_amount同义)',
  `balance` decimal(12,2) DEFAULT '0.00' COMMENT '余额(与balance_amount同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `statement_no` (`statement_no`),
  KEY `idx_supplier_statement_supplier_id` (`supplier_id`),
  KEY `idx_supplier_statement_status` (`status`),
  KEY `idx_supplier_statement_period` (`period_start`,`period_end`),
  KEY `idx_t_supplier_statement_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='供应商对账单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_supplier_statement_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_supplier_statement_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `statement_id` bigint unsigned NOT NULL COMMENT '对账单ID',
  `purchase_order_id` bigint unsigned NOT NULL COMMENT '采购订单ID',
  `purchase_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '采购金额',
  `payment_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '付款金额',
  `return_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '退货金额',
  `balance` decimal(12,2) GENERATED ALWAYS AS (((`purchase_amount` - `payment_amount`) - `return_amount`)) STORED COMMENT '余额',
  `statement_no` varchar(64) DEFAULT NULL COMMENT '对账单号',
  `item_no` varchar(64) DEFAULT NULL COMMENT '明细单号',
  `item_type` varchar(32) DEFAULT NULL COMMENT '明细类型: PURCHASE/PAYMENT/RETURN',
  `amount` decimal(12,2) DEFAULT '0.00' COMMENT '明细金额',
  `status` varchar(32) DEFAULT NULL COMMENT '明细状态',
  PRIMARY KEY (`id`),
  KEY `idx_supplier_statement_item_statement_id` (`statement_id`),
  KEY `idx_supplier_statement_item_purchase_order_id` (`purchase_order_id`),
  KEY `idx_t_supplier_statement_item_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='供应商对账明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_support_ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_support_ticket` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `ticket_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '工单编号（唯一）',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，逐字对齐 varchar(36)/utf8mb4_0900_ai_ci，按立项卡不建物理外键）',
  `category_id` bigint unsigned NOT NULL COMMENT '工单类型ID（逻辑引用 t_support_ticket_category.id，不建物理外键）',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '工单标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '问题描述（NULL=未填写）',
  `priority` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'NORMAL' COMMENT '优先级：LOW/NORMAL/HIGH/URGENT',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待处理/PROCESSING-处理中/RESOLVED-已解决/CLOSED-已关闭',
  `assignee_id` int DEFAULT NULL COMMENT '受理人ID（逻辑引用 t_platform_admin.id，类型对齐 int；NULL=未分配）',
  `sla_deadline` datetime DEFAULT NULL COMMENT 'SLA 截止时间（SLA 口径未定，本期恒 NULL 不计算，禁止近似值冒充）',
  `resolved_at` datetime DEFAULT NULL COMMENT '解决时间（NULL=未解决）',
  `closed_at` datetime DEFAULT NULL COMMENT '关闭时间（NULL=未关闭）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ticket_no` (`ticket_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_assignee_status` (`assignee_id`,`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单主表（C6-2-T7）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_support_ticket_attachment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_support_ticket_attachment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `ticket_id` bigint unsigned NOT NULL COMMENT '工单ID（逻辑引用 t_support_ticket.id，不建物理外键）',
  `message_id` bigint unsigned DEFAULT NULL COMMENT '消息ID（逻辑引用 t_support_ticket_message.id；NULL=尚未绑定消息）',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文件名',
  `file_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文件地址',
  `file_size` int NOT NULL DEFAULT '0' COMMENT '文件大小（字节，0=未知）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_ticket_id` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单附件';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_support_ticket_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_support_ticket_category` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型名称',
  `slug` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型标识（唯一）',
  `sla_hours` int NOT NULL DEFAULT '24' COMMENT 'SLA 小时数（仅配置字段保留，SLA 口径未定，本期不参与任何计算）',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号（升序，越小越靠前）',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用/0-停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单类型配置（本期零预置数据）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_support_ticket_message`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_support_ticket_message` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `ticket_id` bigint unsigned NOT NULL COMMENT '工单ID（逻辑引用 t_support_ticket.id，不建物理外键）',
  `sender_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '发送方类型：PLATFORM-平台/TENANT-租户/SYSTEM-系统',
  `sender_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '发送方ID（平台侧=管理员ID字符串，租户侧=用户ID字符串，NULL=系统留痕不记名）',
  `sender_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '发送方名称（NULL=未记录）',
  `bubble_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PUBLIC' COMMENT '气泡类型：PUBLIC-公开回复/INTERNAL-内部备注/TENANT-租户消息（内部备注不得出现在租户可见接口）',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '消息内容',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_ticket_created` (`ticket_id`,`created_at`),
  KEY `idx_bubble_type` (`bubble_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单消息（公开回复与内部备注按 bubble_type 区分）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sync_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sync_cache` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `sync_type` varchar(32) NOT NULL COMMENT '同步类型：price/product',
  `entity_id` varchar(64) NOT NULL COMMENT '实体ID',
  `sync_data` text COMMENT '同步数据（JSON）',
  `sync_status` varchar(16) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/synced/failed',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sync_cache` (`tenant_id`,`sync_type`,`entity_id`),
  KEY `idx_sync_cache_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='同步缓存表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `config_key` varchar(128) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值（敏感字段加密存储）',
  `config_group` varchar(64) NOT NULL DEFAULT 'system' COMMENT '配置分组：system/wechat/payment/enterprise',
  `is_encrypted` tinyint NOT NULL DEFAULT '0' COMMENT '是否加密：1是，0否',
  `description` varchar(255) DEFAULT NULL COMMENT '配置说明',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key_tenant` (`config_key`,`tenant_id`),
  KEY `idx_config_group` (`config_group`),
  KEY `idx_t_sys_config_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_data_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_data_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `role_id` bigint unsigned NOT NULL COMMENT '角色ID',
  `table_name` varchar(64) NOT NULL COMMENT '表名',
  `field_name` varchar(64) NOT NULL COMMENT '字段名',
  `condition_type` varchar(16) NOT NULL COMMENT '条件类型：EQ(等于)/IN(在集合中)/LIKE(模糊)/OWN(自己的数据)',
  `condition_value` varchar(512) DEFAULT NULL COMMENT '条件值，JSON格式',
  `description` varchar(255) DEFAULT NULL COMMENT '规则说明',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `filter_type` varchar(32) DEFAULT NULL COMMENT '过滤类型(与condition_type同义)',
  `filter_value` varchar(255) DEFAULT NULL COMMENT '过滤值(与condition_value同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_data_perm` (`role_id`,`table_name`,`field_name`,`tenant_id`),
  KEY `idx_data_perm_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数据权限表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_department`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_department` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父部门ID',
  `name` varchar(64) NOT NULL COMMENT '部门名称',
  `store_id` bigint unsigned DEFAULT NULL COMMENT '所属门店',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`),
  KEY `idx_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='部门表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_field_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_field_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `role_id` bigint unsigned NOT NULL COMMENT '角色ID',
  `table_name` varchar(64) NOT NULL COMMENT '表名',
  `field_name` varchar(64) NOT NULL COMMENT '字段名',
  `permission_type` varchar(16) NOT NULL COMMENT '权限类型：VISIBLE(可见)/HIDDEN(隐藏)/READONLY(只读)/EDITABLE(可编辑)',
  `description` varchar(255) DEFAULT NULL COMMENT '字段说明',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_field_perm` (`role_id`,`table_name`,`field_name`,`tenant_id`),
  KEY `idx_field_perm_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字段权限表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_menu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_menu` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父菜单ID，NULL=顶级菜单',
  `menu_code` varchar(64) NOT NULL COMMENT '菜单编码，如 sale:order:view',
  `menu_name` varchar(64) NOT NULL COMMENT '菜单名称',
  `menu_type` varchar(16) NOT NULL DEFAULT 'MENU' COMMENT '菜单类型：CATALOG(目录)/MENU(菜单)/BUTTON(按钮)',
  `path` varchar(255) DEFAULT NULL COMMENT '前端路由路径',
  `component` varchar(255) DEFAULT NULL COMMENT '前端组件路径',
  `icon` varchar(64) DEFAULT NULL COMMENT '图标',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `visible` tinyint NOT NULL DEFAULT '1' COMMENT '是否可见：1可见，0隐藏',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1启用，0禁用',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_menu_code_tenant` (`menu_code`,`tenant_id`),
  KEY `idx_sys_menu_parent_id` (`parent_id`),
  KEY `idx_sys_menu_sort` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜单权限表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父权限ID',
  `permission_code` varchar(128) NOT NULL COMMENT '权限编码',
  `permission_name` varchar(128) NOT NULL COMMENT '权限名称',
  `permission_type` varchar(16) NOT NULL COMMENT '权限类型：MENU/BUTTON/API',
  `path` varchar(255) DEFAULT NULL COMMENT '前端路由或接口路径',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1正常，0禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_permission_code` (`permission_code`),
  KEY `idx_sys_permission_parent_id` (`parent_id`),
  KEY `idx_t_sys_permission_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_position`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_position` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `position_name` varchar(100) NOT NULL COMMENT '岗位名称',
  `position_code` varchar(50) DEFAULT NULL COMMENT '岗位编码',
  `department_id` bigint DEFAULT NULL COMMENT '所属部门ID',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `status` tinyint DEFAULT '1' COMMENT '状态: 1启用, 0禁用',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_position_code` (`position_code`,`tenant_id`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='岗位表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_role` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(50) NOT NULL COMMENT '角色编码',
  `role_name` varchar(50) NOT NULL COMMENT '角色名称',
  `description` varchar(255) DEFAULT NULL COMMENT '角色描述',
  `data_scope` varchar(32) NOT NULL DEFAULT 'SELF' COMMENT '数据范围：ALL/DEPARTMENT/STORE/SELF',
  `permissions` json DEFAULT NULL COMMENT '权限列表（JSON格式）',
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `name` varchar(64) DEFAULT NULL COMMENT '角色名称(与role_name同义)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code_tenant` (`role_code`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_t_sys_role_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统角色表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_role_menu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_role_menu` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `role_id` bigint NOT NULL COMMENT '角色ID',
  `menu_id` bigint NOT NULL COMMENT '菜单ID（t_sys_menu.id）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_menu` (`role_id`,`menu_id`),
  KEY `idx_sys_role_menu_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色菜单关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_role_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_permission` (`role_id`,`permission_id`),
  KEY `idx_sys_role_permission_permission_id` (`permission_id`),
  KEY `idx_t_sys_role_permission_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色权限关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_user` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password_hash` varchar(255) NOT NULL COMMENT '密码hash',
  `mfa_secret` varchar(128) DEFAULT NULL COMMENT 'TOTP 双因素认证 Secret(Base32)',
  `mfa_enabled` tinyint NOT NULL DEFAULT '0' COMMENT '双因素认证是否启用：1启用/0未启用',
  `real_name` varchar(50) DEFAULT NULL COMMENT '真实姓名',
  `avatar` varchar(512) DEFAULT NULL COMMENT '头像URL',
  `email` varchar(128) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `store_id` int unsigned DEFAULT NULL COMMENT '所属门店ID',
  `department_id` bigint DEFAULT NULL COMMENT '所属部门ID',
  `position_id` bigint DEFAULT NULL COMMENT '所属岗位ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态 1=正常 0=禁用',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `login_fail_count` int DEFAULT '0' COMMENT '登录失败次数',
  `locked_until` datetime DEFAULT NULL COMMENT '锁定截止时间',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  `default_homepage` varchar(50) DEFAULT NULL COMMENT '默认首页',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `password` varchar(255) DEFAULT NULL COMMENT '明文密码(总台创建租户管理员,与password_hash同义)',
  `role` varchar(32) DEFAULT NULL COMMENT '角色编码冗余(总台创建管理员)',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认账号',
  `mobile` varchar(20) DEFAULT NULL COMMENT '手机号（与 phone 同义；建租户/审核通过写管理员账号时使用，全新库缺列）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username_tenant` (`username`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_t_sys_user_tenant` (`tenant_id`),
  KEY `idx_sys_user_default_homepage` (`default_homepage`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统用户表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_user_login`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_user_login` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `user_id` bigint DEFAULT NULL COMMENT '用户ID',
  `username` varchar(64) DEFAULT NULL COMMENT '账号',
  `login_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `ip` varchar(64) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(255) DEFAULT NULL COMMENT '浏览器UA',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_user_login_tenant` (`tenant_id`),
  KEY `idx_sys_user_login_login_at` (`login_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户登录日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_sys_user_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_sys_user_role` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL COMMENT '用户ID',
  `role_id` int unsigned NOT NULL COMMENT '角色ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role_tenant` (`user_id`,`role_id`,`tenant_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_t_sys_user_role_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户角色关联表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_system_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_system_feedback` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '反馈ID',
  `type` varchar(16) NOT NULL COMMENT '类型: BUG/FEATURE/IMPROVEMENT/OTHER',
  `title` varchar(200) NOT NULL COMMENT '标题',
  `content` text NOT NULL COMMENT '内容',
  `contact` varchar(100) DEFAULT NULL COMMENT '联系方式',
  `screenshot_urls` text COMMENT '截图URL列表(JSON)',
  `page_url` varchar(500) DEFAULT NULL COMMENT '提交页面URL',
  `browser_info` varchar(500) DEFAULT NULL COMMENT '浏览器信息',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PROCESSING/RESOLVED/REJECTED',
  `reply` text COMMENT '管理员回复',
  `user_id` bigint unsigned DEFAULT NULL COMMENT '提交用户ID',
  `tenant_id` varchar(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_type` (`type`),
  KEY `idx_feedback_status` (`status`),
  KEY `idx_feedback_tenant` (`tenant_id`),
  KEY `idx_feedback_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户建议反馈表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant` (
  `id` varchar(36) NOT NULL COMMENT '租户ID',
  `name` varchar(100) NOT NULL COMMENT '租户名称',
  `contact_name` varchar(50) DEFAULT NULL COMMENT '联系人',
  `contact_phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `plan` varchar(20) DEFAULT 'basic' COMMENT '套餐',
  `status` tinyint DEFAULT '1' COMMENT '1=正常 0=停用',
  `expire_at` datetime DEFAULT NULL COMMENT '到期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `review_status` varchar(16) NOT NULL DEFAULT 'APPROVED' COMMENT '审核状态（PENDING/APPROVED/REJECTED）',
  `review_remark` varchar(500) DEFAULT NULL COMMENT '审核备注',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `reviewed_by` int DEFAULT NULL COMMENT '审核人ID',
  `tenant_id` varchar(36) DEFAULT NULL COMMENT '租户ID(与id同义,总台服务写入)',
  `tenant_name` varchar(128) DEFAULT NULL COMMENT '租户名称(与company_name同义)',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `tax_no` varchar(64) DEFAULT NULL COMMENT '纳税人识别号（税号）',
  `tenant_code` varchar(32) DEFAULT NULL COMMENT '租户编码（唯一，应用层生成；NULL=历史行未填写）',
  `company_name` varchar(128) DEFAULT NULL COMMENT '公司名称（016 定义为 NOT NULL；全新库因建表被跳过而缺列，本迁移补齐）',
  `company_short_name` varchar(64) DEFAULT NULL COMMENT '公司简称',
  `contact_person` varchar(64) DEFAULT NULL COMMENT '联系人',
  `contact_mobile` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `contact_email` varchar(128) DEFAULT NULL COMMENT '联系邮箱',
  `province` varchar(64) DEFAULT NULL COMMENT '省份',
  `city` varchar(64) DEFAULT NULL COMMENT '城市',
  `district` varchar(64) DEFAULT NULL COMMENT '区县',
  `address` varchar(255) DEFAULT NULL COMMENT '详细地址',
  `business_license` varchar(128) DEFAULT NULL COMMENT '营业执照号',
  `legal_person` varchar(64) DEFAULT NULL COMMENT '法人代表',
  `industry` varchar(64) DEFAULT NULL COMMENT '所属行业',
  `company_scale` varchar(32) DEFAULT NULL COMMENT '公司规模',
  `source` varchar(32) DEFAULT 'MANUAL' COMMENT '来源（MANUAL/SELF_REGISTER/INVITATION，既有三取值不改）',
  `suspend_reason` varchar(255) DEFAULT NULL COMMENT '停用原因',
  `suspended_at` datetime DEFAULT NULL COMMENT '停用时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_code`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_tenant_expire` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID（UUID，对齐 t_tenant.id）',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID（关联 t_sys_user.id）',
  `role` varchar(32) NOT NULL DEFAULT 'ADMIN' COMMENT '角色（ADMIN/SUPER_ADMIN）',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否主管理员',
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_tenant_admin_tenant` (`tenant_id`),
  KEY `idx_tenant_admin_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户管理员表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_ai_billing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_ai_billing` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `plan_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pay_as_you_go' COMMENT '套餐类型: pay_as_you_go/monthly/prepaid',
  `free_chat_count` int NOT NULL DEFAULT '100' COMMENT '免费对话次数',
  `free_token_limit` bigint NOT NULL DEFAULT '100000' COMMENT '免费Token额度',
  `overage_price` decimal(10,6) NOT NULL DEFAULT '0.001000' COMMENT '超额单价（元/千Token）',
  `monthly_chat_limit` int NOT NULL DEFAULT '0' COMMENT '月对话上限（0=不限）',
  `monthly_token_limit` bigint NOT NULL DEFAULT '0' COMMENT '月Token上限（0=不限）',
  `monthly_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '月费（元）',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用: 1=启用 0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant` (`tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户AI计费套餐配置（每租户1条）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_ai_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_ai_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID（关联 t_tenant.id）',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用AI功能: 1=启用 0=禁用',
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deepseek' COMMENT 'AI服务商: deepseek/qwen/zhipu/ollama',
  `api_key` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API Key（AES-256-GCM加密存储）',
  `api_endpoint` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '自定义Endpoint（留空则用服务商默认地址）',
  `model` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'deepseek-chat' COMMENT '模型名称',
  `temperature` decimal(2,1) NOT NULL DEFAULT '0.3' COMMENT '温度参数 0.0-2.0',
  `max_tokens` int NOT NULL DEFAULT '2048' COMMENT '最大Token数',
  `system_prompt` text COLLATE utf8mb4_unicode_ci COMMENT '自定义系统提示词（覆盖平台默认）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant` (`tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户级AI配置（每租户1条）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_attribution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_attribution` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，类型对齐 varchar(36)，不建物理外键）',
  `promo_code_id` bigint unsigned DEFAULT NULL COMMENT '推广码ID（逻辑引用 t_promo_code.id，同型对齐，不建物理外键；NULL=非推广码归因）',
  `agent_id` bigint unsigned DEFAULT NULL COMMENT '代理商ID（逻辑引用 t_agent.id，同型对齐，不建物理外键；NULL=非代理商归因）',
  `attributed_at` datetime NOT NULL COMMENT '归因写入时间',
  `attribution_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '归因类型：AGENT-代理商邀请/PROMO-渠道推广码/REFERRAL-老带新（本单只写 AGENT 与 PROMO，REFERRAL 归 C6-3-2b）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_attr` (`tenant_id`),
  KEY `idx_attr_promo_code` (`promo_code_id`),
  KEY `idx_attr_agent` (`agent_id`),
  KEY `idx_attr_type` (`attribution_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户归因明细（C6-3-2a：一租户一条归因，无任何金额列）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `config_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置键名（如 storage_limit）',
  `config_value` text COLLATE utf8mb4_unicode_ci COMMENT '配置值',
  `config_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'string' COMMENT '值类型：string/number/boolean/json',
  `storage_limit` int DEFAULT NULL COMMENT '存储配额数值（兼容storage-guard查询）',
  `storage_limit_unit` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '存储配额单位（MB/GB）',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_config_key` (`tenant_id`,`config_key`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_library_copy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_library_copy` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，不建物理外键）',
  `library_spu_id` bigint unsigned NOT NULL COMMENT '平台商品库SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  `spu_id` bigint unsigned NOT NULL COMMENT '租户私有SPU ID（逻辑引用 t_product_spu.id，不建物理外键）',
  `copied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次调取时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近一次更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_library` (`tenant_id`,`library_spu_id`),
  KEY `idx_copy_spu` (`spu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户商品库调取映射（幂等判据：同租户同平台SPU唯一；租户删除私有档案后本行保留）';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_module_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_module_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `module_code` varchar(64) NOT NULL COMMENT '模块编码（如：sales/purchase/inventory/marketing）',
  `module_name` varchar(128) NOT NULL COMMENT '模块名称',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `granted_by` varchar(32) NOT NULL DEFAULT 'PLAN' COMMENT '授权方式（PLAN/MANUAL/ADDON）',
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  `expire_at` datetime DEFAULT NULL COMMENT '过期时间（NULL表示永久）',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_module` (`tenant_id`,`module_code`),
  KEY `idx_tenant_module_tenant` (`tenant_id`),
  KEY `idx_tenant_module_enabled` (`enabled`),
  CONSTRAINT `t_tenant_module_access_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `t_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户模块访问权限表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_tenant_register_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_tenant_register_application` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(128) NOT NULL COMMENT '公司名称',
  `company_short_name` varchar(64) DEFAULT NULL COMMENT '公司简称',
  `contact_person` varchar(64) NOT NULL COMMENT '联系人',
  `contact_mobile` varchar(20) NOT NULL COMMENT '联系电话',
  `contact_email` varchar(128) DEFAULT NULL COMMENT '联系邮箱',
  `province` varchar(64) DEFAULT NULL COMMENT '省份',
  `city` varchar(64) DEFAULT NULL COMMENT '城市',
  `district` varchar(64) DEFAULT NULL COMMENT '区县',
  `address` varchar(255) DEFAULT NULL COMMENT '详细地址',
  `business_license` varchar(128) DEFAULT NULL COMMENT '营业执照号',
  `legal_person` varchar(64) DEFAULT NULL COMMENT '法人代表',
  `industry` varchar(64) DEFAULT NULL COMMENT '所属行业',
  `company_scale` varchar(32) DEFAULT NULL COMMENT '公司规模',
  `admin_username` varchar(64) NOT NULL COMMENT '管理员账号',
  `admin_password_hash` varchar(255) NOT NULL COMMENT '管理员密码哈希',
  `admin_real_name` varchar(64) NOT NULL COMMENT '管理员真实姓名',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态（PENDING/APPROVED/REJECTED）',
  `reject_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `reviewed_by` int DEFAULT NULL COMMENT '审核人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `promo_code` varchar(32) DEFAULT NULL COMMENT '注册携带的渠道推广码（NULL=未携带，官网自注册不分配归属）',
  `agent_id` bigint unsigned DEFAULT NULL COMMENT '注册携带的代理商ID（NULL=未携带，逻辑引用 t_agent.id，不建物理外键）',
  PRIMARY KEY (`id`),
  KEY `idx_application_status` (`status`),
  KEY `idx_application_mobile` (`contact_mobile`),
  KEY `idx_application_username` (`admin_username`),
  KEY `idx_tra_promo_code` (`promo_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户注册申请表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_todos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_todos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '待办ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `title` varchar(200) NOT NULL COMMENT '标题',
  `type` varchar(32) DEFAULT NULL COMMENT '类型',
  `source` varchar(64) DEFAULT NULL COMMENT '来源',
  `priority` varchar(16) NOT NULL DEFAULT 'NORMAL' COMMENT '优先级：LOW/NORMAL/HIGH/URGENT',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/DISMISSED',
  `due_date` date DEFAULT NULL COMMENT '截止日期',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_todos_tenant` (`tenant_id`),
  KEY `idx_todos_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='待办表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_trace_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_trace_code` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `trace_code` varchar(32) NOT NULL,
  `sku_id` int NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) DEFAULT '',
  `batch_no` varchar(64) DEFAULT '',
  `production_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `shelf_life_days` int DEFAULT NULL,
  `code_mode` enum('ONE_PER_ITEM','ONE_PER_BATCH') DEFAULT 'ONE_PER_BATCH',
  `category_id` int DEFAULT NULL COMMENT '分类ID',
  `current_status` enum('PRODUCED','PURCHASED','TRANSFERRED','ALLOCATED','ON_SHELF','SOLD','WHOLESALE_SOLD','DELIVERING','DELIVERED','RETURNED','DESTROYED','EXPIRED','RECALLED') DEFAULT 'PRODUCED',
  `current_location` varchar(128) DEFAULT '',
  `store_id` int DEFAULT NULL COMMENT '门店ID',
  `warehouse_id` int DEFAULT NULL,
  `order_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL COMMENT '供应商ID',
  `quality_check_result` enum('PASS','FAIL','PENDING') DEFAULT 'PENDING',
  `first_scan_at` datetime DEFAULT NULL,
  `first_scan_ip` varchar(45) DEFAULT NULL,
  `scan_count` int DEFAULT '0',
  `fraud_alert` tinyint DEFAULT '0',
  `produced_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `version` int DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trace_code` (`trace_code`),
  KEY `idx_trace_code_sku` (`sku_id`),
  KEY `idx_trace_code_batch` (`batch_no`),
  KEY `idx_trace_code_status` (`current_status`),
  KEY `idx_trace_code_store` (`store_id`),
  KEY `idx_t_trace_code_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='追溯码表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_trace_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_trace_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `config_no` varchar(32) NOT NULL,
  `config_level` enum('CATEGORY','SKU','GLOBAL') NOT NULL,
  `target_id` int NOT NULL,
  `target_name` varchar(128) DEFAULT '',
  `trace_enabled` tinyint NOT NULL DEFAULT '0',
  `force_enabled` tinyint NOT NULL DEFAULT '0',
  `code_mode` enum('ONE_PER_ITEM','ONE_PER_BATCH','BATCH_ONLY') DEFAULT 'ONE_PER_BATCH',
  `code_prefix` varchar(16) DEFAULT 'TR',
  `auto_generate` tinyint DEFAULT '1',
  `shelf_life_days` int DEFAULT '365',
  `remark` varchar(255) DEFAULT '',
  `status` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_no` (`config_no`),
  UNIQUE KEY `uk_level_target` (`config_level`,`target_id`),
  KEY `idx_t_trace_config_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='追溯配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_trace_event_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_trace_event_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `trace_code` varchar(32) NOT NULL COMMENT '追溯码',
  `event_type` varchar(32) NOT NULL COMMENT '事件类型',
  `from_status` varchar(32) DEFAULT NULL COMMENT '变更前状态',
  `to_status` varchar(32) DEFAULT NULL COMMENT '变更后状态',
  `operator_type` enum('SYSTEM','STORE','WAREHOUSE','SUPPLIER','CUSTOMER','ADMIN','PDA') NOT NULL COMMENT '操作人类型',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(64) DEFAULT '' COMMENT '操作人名称',
  `store_id` int DEFAULT NULL COMMENT '门店ID',
  `order_id` int DEFAULT NULL COMMENT '订单ID',
  `location` varchar(128) DEFAULT '' COMMENT '位置',
  `remark` varchar(255) DEFAULT '' COMMENT '备注',
  `extra` json DEFAULT NULL COMMENT '扩展信息',
  `ip` varchar(45) DEFAULT '' COMMENT 'IP',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trace_event_log_trace_code` (`trace_code`),
  KEY `idx_trace_event_log_event_type` (`event_type`),
  KEY `idx_t_trace_event_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='追溯事件日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_trace_scan_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_trace_scan_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `trace_code` varchar(32) NOT NULL COMMENT '追溯码',
  `scan_type` enum('CONSUMER','BUSINESS','PDA','ADMIN') NOT NULL COMMENT '扫码类型',
  `user_id` int DEFAULT NULL COMMENT '用户ID',
  `ip` varchar(45) DEFAULT '' COMMENT 'IP',
  `result` enum('SUCCESS','INVALID','NOT_FOUND','FRAUD_ALERT','EXPIRED') DEFAULT 'SUCCESS' COMMENT '扫码结果',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trace_scan_log_trace_code` (`trace_code`),
  KEY `idx_t_trace_scan_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='扫码日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_transfer_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_transfer_order` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transfer_no` varchar(32) NOT NULL COMMENT '调拨编号',
  `from_store_id` bigint NOT NULL COMMENT '调出门店ID',
  `to_store_id` bigint NOT NULL COMMENT '调入门店ID',
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 TRANSIT=运输中 RECEIVED=已完成 CANCELLED=已取消',
  `expected_date` date DEFAULT NULL COMMENT '预计到货日期',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '调拨总金额',
  `total_items` int NOT NULL DEFAULT '0' COMMENT '明细行数',
  `created_by` bigint DEFAULT NULL COMMENT '创建人ID',
  `approved_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `approved_at` datetime DEFAULT NULL COMMENT '审核时间',
  `shipped_by` bigint DEFAULT NULL COMMENT '出库人ID',
  `shipped_at` datetime DEFAULT NULL COMMENT '出库时间',
  `received_by` bigint DEFAULT NULL COMMENT '入库人ID',
  `received_at` datetime DEFAULT NULL COMMENT '入库时间',
  `cancel_reason` varchar(512) DEFAULT NULL COMMENT '取消原因',
  `remark` varchar(512) DEFAULT NULL COMMENT '备注',
  `transfer_status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SHIPPED/RECEIVED',
  `goods_amount` decimal(12,2) DEFAULT '0.00' COMMENT '调拨金额',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `from_store_name` varchar(128) DEFAULT NULL COMMENT '调出门店名称快照',
  `to_store_name` varchar(128) DEFAULT NULL COMMENT '调入门店名称快照',
  `created_by_name` varchar(64) DEFAULT NULL COMMENT '创建人姓名快照',
  `actual_date` date DEFAULT NULL COMMENT '实际完成日期',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_transfer_no` (`transfer_no`,`tenant_id`),
  KEY `idx_from_store` (`from_store_id`),
  KEY `idx_to_store` (`to_store_id`),
  KEY `idx_status` (`transfer_status`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_tto_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='调拨单';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_transfer_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_transfer_order_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transfer_order_id` bigint NOT NULL DEFAULT '0' COMMENT '调拨单ID',
  `transfer_no` varchar(32) DEFAULT NULL COMMENT '调拨编号(094老列,放宽以兼容新明细写法)',
  `sku_id` bigint NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(128) NOT NULL DEFAULT '' COMMENT 'SKU名称',
  `quantity` int NOT NULL DEFAULT '0' COMMENT '数量',
  `box_qty` int DEFAULT '0' COMMENT '箱数',
  `bottle_qty` int DEFAULT '0' COMMENT '瓶数',
  `total_bottle_qty` int NOT NULL DEFAULT '0' COMMENT '总瓶数',
  `unit_price` decimal(12,2) DEFAULT '0.00' COMMENT '单价',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '小计金额',
  `tenant_id` varchar(64) NOT NULL DEFAULT '',
  `transferred_qty` int NOT NULL DEFAULT '0' COMMENT '已发运数量',
  `received_qty` int NOT NULL DEFAULT '0' COMMENT '已收货数量',
  PRIMARY KEY (`id`),
  KEY `idx_transfer_no` (`transfer_no`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_tto_item_order` (`transfer_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='调拨单明细';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_transfer_stock_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_transfer_stock_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `transfer_order_id` bigint unsigned NOT NULL COMMENT '调拨单ID',
  `item_id` bigint unsigned NOT NULL COMMENT '调拨明细ID',
  `store_id` bigint unsigned NOT NULL COMMENT '门店ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `direction` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '方向：OUT=发出 IN=接收',
  `quantity` decimal(12,2) NOT NULL COMMENT '数量',
  `operator_id` bigint unsigned DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_transfer_order` (`transfer_order_id`),
  KEY `idx_store_sku` (`store_id`,`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='调拨库存变动日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_unit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_unit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(32) NOT NULL COMMENT '单位名称（瓶/箱/件/桶）',
  `code` varchar(32) NOT NULL COMMENT '单位编码',
  `type` varchar(16) NOT NULL DEFAULT 'BASE' COMMENT 'BASE基础单位/BOX组合单位',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `tenant_id` varchar(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_tenant` (`tenant_id`),
  KEY `idx_unit_sort` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='单位表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_unit_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_unit_group` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL COMMENT '单位组名称',
  `tenant_id` varchar(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='单位组表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_unit_group_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_unit_group_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned NOT NULL COMMENT '单位组ID',
  `tenant_id` varchar(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `name` varchar(32) NOT NULL COMMENT '单位名称（箱/包/条/合/个）',
  `level` int NOT NULL DEFAULT '0' COMMENT '层级（0为最高级，数字越大层级越低）',
  `conversion_rate` decimal(15,4) NOT NULL DEFAULT '1.0000' COMMENT '换算率（1上级单位=conversion_rate本级单位）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 0停用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_level` (`group_id`,`level`),
  CONSTRAINT `fk_item_group` FOREIGN KEY (`group_id`) REFERENCES `t_unit_group` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='单位层级明细表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_upload_file`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_upload_file` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '存储路径',
  `file_size` bigint NOT NULL DEFAULT '0' COMMENT '文件大小（字节）',
  `file_type` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MIME类型',
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件哈希（MD5/SHA256）',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1=正常 0=已删除',
  `uploader_id` int DEFAULT NULL COMMENT '上传者用户ID',
  `biz_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '业务类型（如 avatar/product/image）',
  `biz_id` int DEFAULT NULL COMMENT '业务ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_tenant_biz` (`tenant_id`,`biz_type`,`biz_id`),
  KEY `idx_file_hash` (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传文件记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_user_binding`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_binding` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '绑定ID',
  `wx_user_id` bigint NOT NULL COMMENT '微信用户ID（t_wx_user.id）',
  `system_user_id` bigint NOT NULL COMMENT '系统用户ID',
  `binding_type` varchar(32) NOT NULL DEFAULT 'WECHAT' COMMENT '绑定类型',
  `username` varchar(64) DEFAULT NULL COMMENT '系统账号快照',
  `real_name` varchar(64) DEFAULT NULL COMMENT '姓名快照',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/UNBOUND',
  `bound_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  `unbound_at` datetime DEFAULT NULL COMMENT '解绑时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_binding_wx` (`wx_user_id`),
  KEY `idx_user_binding_sys` (`system_user_id`),
  KEY `idx_user_binding_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='微信用户绑定表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_user_coupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_coupon` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coupon_no` varchar(32) NOT NULL COMMENT '优惠券编号',
  `template_id` int NOT NULL COMMENT '模板ID',
  `user_id` int NOT NULL COMMENT '用户ID（客户ID）',
  `coupon_type` varchar(32) NOT NULL COMMENT '优惠券类型',
  `coupon_name` varchar(128) NOT NULL COMMENT '优惠券名称',
  `coupon_value` decimal(10,2) NOT NULL COMMENT '优惠值',
  `min_purchase` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '最低消费金额',
  `max_discount` decimal(10,2) DEFAULT NULL COMMENT '最大优惠金额',
  `applicable_scope` varchar(32) NOT NULL COMMENT '适用范围',
  `applicable_ids` json DEFAULT NULL COMMENT '适用范围ID列表',
  `source` varchar(32) NOT NULL COMMENT '来源（RECEIVE/SEND/ACTIVITY）',
  `status` varchar(16) NOT NULL DEFAULT 'UNUSED' COMMENT '状态（UNUSED/USED/EXPIRED/LOCKED）',
  `valid_start` datetime NOT NULL COMMENT '生效时间',
  `valid_end` datetime NOT NULL COMMENT '失效时间',
  `used_at` datetime DEFAULT NULL COMMENT '使用时间',
  `used_order_no` varchar(64) DEFAULT NULL COMMENT '使用的订单号',
  `used_amount` decimal(10,2) DEFAULT NULL COMMENT '使用的订单金额',
  `discount_amount` decimal(10,2) DEFAULT NULL COMMENT '实际优惠金额',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `customer_id` bigint DEFAULT NULL COMMENT '客户ID(与user_id同义,报表服务写入)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_no` (`coupon_no`),
  KEY `idx_coupon_no` (`coupon_no`),
  KEY `idx_template` (`template_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_valid` (`valid_start`,`valid_end`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_user_coupon_status` (`status`),
  KEY `idx_user_coupon_template_id` (`template_id`),
  KEY `idx_user_coupon_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户优惠券表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_user_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_points` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `points` int NOT NULL DEFAULT '0' COMMENT '当前积分',
  `total_earned` int NOT NULL DEFAULT '0' COMMENT '累计获得',
  `total_spent` int NOT NULL DEFAULT '0' COMMENT '累计消耗',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_points` (`tenant_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户积分表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_user_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_session` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `token` varchar(512) NOT NULL COMMENT '会话令牌',
  `device_type` varchar(32) DEFAULT NULL COMMENT '设备类型：WEB/MINIAPP/IOS/ANDROID',
  `device_info` varchar(255) DEFAULT NULL COMMENT '设备信息',
  `ip` varchar(64) DEFAULT NULL COMMENT 'IP地址',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `last_activity_at` datetime DEFAULT NULL COMMENT '最后活跃时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_token` (`token`(191)),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户会话表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_verification_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_verification_code` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `mobile` varchar(20) NOT NULL COMMENT '手机号',
  `code` varchar(10) NOT NULL COMMENT '验证码',
  `type` varchar(32) NOT NULL COMMENT '类型：LOGIN/BIND_PHONE/RESET_PASSWORD',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `used` tinyint NOT NULL DEFAULT '0' COMMENT '是否已使用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mobile_type` (`mobile`,`type`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='验证码表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_wholesale_cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_wholesale_cart` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '购物车ID',
  `member_id` bigint unsigned NOT NULL COMMENT '会员ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '数量',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `selected` tinyint NOT NULL DEFAULT '1' COMMENT '选中状态：1选中 0未选中',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_sku` (`member_id`,`sku_id`,`tenant_id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='批发购物车表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_wholesale_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_wholesale_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` varchar(32) NOT NULL COMMENT '订单编号',
  `member_id` bigint unsigned NOT NULL COMMENT '会员ID',
  `store_id` int DEFAULT NULL COMMENT '门店ID',
  `order_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态：PENDING待付款/PAID已付款/SHIPPED已发货/COMPLETED已完成/CANCELLED已取消',
  `pay_status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态：UNPAID未支付/PAID已支付/REFUNDED已退款',
  `goods_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商品金额',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `shipping_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '运费',
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '应付金额',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '实付金额',
  `receiver_name` varchar(64) DEFAULT NULL COMMENT '收货人姓名',
  `receiver_mobile` varchar(20) DEFAULT NULL COMMENT '收货人手机号',
  `receiver_province` varchar(64) DEFAULT NULL COMMENT '省',
  `receiver_city` varchar(64) DEFAULT NULL COMMENT '市',
  `receiver_district` varchar(64) DEFAULT NULL COMMENT '区',
  `receiver_address` varchar(256) DEFAULT NULL COMMENT '详细地址',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `coupon_id` int DEFAULT NULL COMMENT '使用的优惠券ID',
  `coupon_amount` decimal(12,2) DEFAULT '0.00' COMMENT '优惠券抵扣金额',
  `points_used` int DEFAULT '0' COMMENT '使用积分',
  `points_amount` decimal(12,2) DEFAULT '0.00' COMMENT '积分抵扣金额',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `shipped_at` datetime DEFAULT NULL COMMENT '发货时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间',
  `cancel_reason` varchar(256) DEFAULT NULL COMMENT '取消原因',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_no` (`order_no`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_member` (`member_id`),
  KEY `idx_status` (`order_status`),
  KEY `idx_pay_status` (`pay_status`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='批发订单表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_wholesale_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_wholesale_order_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
  `order_no` varchar(32) NOT NULL COMMENT '订单编号',
  `spu_id` bigint unsigned NOT NULL COMMENT 'SPU ID',
  `sku_id` bigint unsigned NOT NULL COMMENT 'SKU ID',
  `sku_name` varchar(256) NOT NULL COMMENT 'SKU名称',
  `sku_image` varchar(512) DEFAULT NULL COMMENT 'SKU图片',
  `quantity` int NOT NULL COMMENT '数量',
  `unit_price` decimal(12,2) NOT NULL COMMENT '单价（批发价）',
  `subtotal_amount` decimal(12,2) NOT NULL COMMENT '小计金额',
  `spec_info` varchar(256) DEFAULT NULL COMMENT '规格信息',
  `tenant_id` varchar(36) NOT NULL COMMENT '租户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_sku` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='批发订单项表';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `t_wx_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_wx_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` varchar(64) NOT NULL COMMENT '微信openid',
  `unionid` varchar(64) DEFAULT NULL COMMENT '微信unionid',
  `nickname` varchar(64) DEFAULT NULL COMMENT '昵称',
  `avatar_url` varchar(255) DEFAULT NULL COMMENT '头像URL',
  `gender` tinyint DEFAULT '0' COMMENT '性别：0未知/1男/2女',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `country` varchar(64) DEFAULT NULL COMMENT '国家',
  `province` varchar(64) DEFAULT NULL COMMENT '省份',
  `city` varchar(64) DEFAULT NULL COMMENT '城市',
  `session_key` varchar(255) DEFAULT NULL COMMENT '会话密钥',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wx_user_openid` (`openid`),
  KEY `idx_wx_user_unionid` (`unionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='微信用户表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

