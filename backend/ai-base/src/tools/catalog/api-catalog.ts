/**
 * 总台注册表 → AI 工具目录（完善度 P0-8「功能即技能」）
 *
 * 说明：
 * 管理系统后端（Express 8080）的真实 API 端点清单（来源 backend/src/routes/*.routes.ts
 * 与 ServiceClient.API_ENDPOINTS 映射），以结构化目录形式供 ToolGeneratorService
 * 半自动生成 AI 工具——新增后端 API 只需在此登记一条目录即可成为 AI 技能。
 *
 * 命名约定：工具名 api_ 前缀（如 api_query_sale_bills），与现有业务工具（如 searchProduct）
 * 区分；查询类 low 风险，写操作类按实际标注 medium/high。
 */
import { ToolCategory, ToolRisk } from '../tool.interface';

/** API 路由定义（注册表条目） */
export interface ApiRouteDef {
  /** 工具名（api_ 前缀，唯一） */
  name: string;
  /** 工具描述（给 LLM 的用途/前置/出参说明） */
  description: string;
  /** 业务域分类 */
  category: ToolCategory;
  /** HTTP 方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 端点路径（{param} 占位符从入参替换） */
  path: string;
  /** 参数 JSON Schema */
  parameters: object;
  /** 是否写操作 */
  isWriteOperation: boolean;
  /** 风险分级 */
  risk: ToolRisk;
  /** 强制人工审核 */
  needsReview?: boolean;
}

/**
 * 管理系统 API 目录（总台注册表映射）
 *
 * 初始覆盖高频查询端点（low 风险）；写操作与运营域端点按需登记扩展。
 */
export const API_CATALOG: ApiRouteDef[] = [
  {
    name: 'api_query_sale_bills',
    description:
      '查询销售单列表。入参：customerName(客户名,可选)、status(状态,可选)、page(页码,可选)、pageSize(每页条数,可选)。出参：销售单列表。',
    category: 'order',
    method: 'GET',
    path: '/api/admin/sale-bills',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '客户名称（可选）' },
        status: { type: 'string', description: '单据状态（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_orders',
    description:
      '查询订单列表。入参：customerName、status、page、pageSize。出参：订单列表。',
    category: 'order',
    method: 'GET',
    path: '/api/admin/orders',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '客户名称（可选）' },
        status: { type: 'string', description: '订单状态（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_products',
    description:
      '查询商品列表。入参：keyword(关键词,可选)、categoryId(分类,可选)、page、pageSize。出参：商品列表。',
    category: 'product',
    method: 'GET',
    path: '/api/admin/products',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '商品关键词（可选）' },
        categoryId: { type: 'number', description: '分类ID（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_members',
    description:
      '查询客户/会员列表。入参：name(客户名,可选)、customerType(类型,可选)、page、pageSize。出参：客户列表。',
    category: 'customer',
    method: 'GET',
    path: '/api/admin/members',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '客户名称（可选）' },
        customerType: {
          type: 'string',
          description: '客户类型：retail/wholesale（可选）',
        },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_suppliers',
    description:
      '查询供应商列表。入参：name、page、pageSize。出参：供应商列表。',
    category: 'purchase',
    method: 'GET',
    path: '/api/admin/suppliers',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '供应商名称（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_purchase_orders',
    description:
      '查询采购单列表。入参：supplierName、status、page、pageSize。出参：采购单列表。',
    category: 'purchase',
    method: 'GET',
    path: '/api/admin/purchase-orders',
    parameters: {
      type: 'object',
      properties: {
        supplierName: { type: 'string', description: '供应商名称（可选）' },
        status: { type: 'string', description: '单据状态（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_inventory',
    description:
      '查询库存列表。入参：productName(商品名,可选)、warehouseId(仓库,可选)、page、pageSize。出参：库存列表。',
    category: 'inventory',
    method: 'GET',
    path: '/api/admin/inventory',
    parameters: {
      type: 'object',
      properties: {
        productName: { type: 'string', description: '商品名称（可选）' },
        warehouseId: { type: 'number', description: '仓库ID（可选）' },
        page: { type: 'number', description: '页码（默认 1）' },
        pageSize: { type: 'number', description: '每页条数（默认 20）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_receivables',
    description:
      '查询应收账款列表。入参：customerName(客户名,可选)。出参：应收列表。',
    category: 'finance',
    method: 'GET',
    path: '/api/admin/receivables',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '客户名称（可选）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_query_reports',
    description:
      '查询经营报表。入参：period(周期,可选：day/week/month)、start、end。出参：报表数据。',
    category: 'report',
    method: 'GET',
    path: '/api/admin/reports',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: '统计周期：day/week/month（可选）',
        },
        start: { type: 'string', description: '开始日期（可选）' },
        end: { type: 'string', description: '结束日期（可选）' },
      },
    },
    isWriteOperation: false,
    risk: 'low',
  },
  {
    name: 'api_get_dashboard',
    description:
      '获取工作台经营概览数据（今日销售/订单/库存预警等）。无入参。出参：概览数据。',
    category: 'report',
    method: 'GET',
    path: '/api/admin/dashboard',
    parameters: { type: 'object', properties: {} },
    isWriteOperation: false,
    risk: 'low',
  },
];
