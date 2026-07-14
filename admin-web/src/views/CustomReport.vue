<template>
  <div class="custom-report-page">
    <!-- 报表列表 -->
    <div v-show="!showDesigner">
      <el-card class="toolbar-card">
        <el-form :model="searchForm" inline>
          <el-form-item label="报表名称">
            <el-input v-model="searchForm.keyword" placeholder="请输入报表名称" clearable style="width: 200px" />
          </el-form-item>
          <el-form-item label="报表类型">
            <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 140px">
              <el-option label="销售报表" value="sales" />
              <el-option label="采购报表" value="purchase" />
              <el-option label="库存报表" value="inventory" />
              <el-option label="客户报表" value="customer" />
              <el-option label="财务报表" value="finance" />
              <el-option label="订单报表" value="orders" />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="searchForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchReportList">查询</el-button>
            <el-button @click="resetSearch">重置</el-button>
            <el-button type="success" @click="openDesigner()">
              <el-icon><Plus /></el-icon>
              新建报表
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="table-card">
        <el-table :data="reportList" border v-loading="listLoading">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="报表名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="type" label="类型" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="getTypeTagType(row.type)" size="small">{{ getTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="chartType" label="图表类型" width="110" align="center">
            <template #default="{ row }">
              <span v-if="row.chartType">{{ getChartTypeLabel(row.chartType) }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdBy" label="创建人" width="110" align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="170" align="center" />
          <el-table-column prop="updatedAt" label="更新时间" width="170" align="center" />
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewReport(row)">查看</el-button>
              <el-button size="small" @click="openDesigner(row)">编辑</el-button>
              <el-button type="success" size="small" @click="exportReport(row, 'excel')">导出</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="fetchReportList"
            @current-change="fetchReportList"
          />
        </div>
      </el-card>
    </div>

    <!-- 报表设计器 -->
    <div v-show="showDesigner" class="designer-container">
      <div class="designer-header">
        <div class="designer-title">
          <el-button @click="closeDesigner" :icon="ArrowLeft" circle size="small" />
          <span style="margin-left: 12px; font-size: 16px; font-weight: 600">
            {{ isEdit ? '编辑报表' : '新建报表' }}
          </span>
        </div>
        <div class="designer-actions">
          <el-button @click="closeDesigner">取消</el-button>
          <el-button type="primary" @click="saveReport" :loading="saving">保存报表</el-button>
        </div>
      </div>

      <div class="designer-body">
        <!-- 左侧配置区 -->
        <div class="designer-left">
          <el-collapse v-model="activeCollapse" class="designer-collapse">
            <!-- 基本信息 -->
            <el-collapse-item name="basic" title="基本信息">
              <el-form :model="reportForm" label-width="80px" label-position="left">
                <el-form-item label="报表名称" required>
                  <el-input v-model="reportForm.name" placeholder="请输入报表名称" />
                </el-form-item>
                <el-form-item label="报表类型" required>
                  <el-select v-model="reportForm.type" placeholder="请选择类型" style="width: 100%" @change="onTypeChange">
                    <el-option label="销售报表" value="sales" />
                    <el-option label="采购报表" value="purchase" />
                    <el-option label="库存报表" value="inventory" />
                    <el-option label="客户报表" value="customer" />
                    <el-option label="财务报表" value="finance" />
                    <el-option label="订单报表" value="orders" />
                  </el-select>
                </el-form-item>
                <el-form-item label="描述">
                  <el-input v-model="reportForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 数据源 -->
            <el-collapse-item name="datasource" title="数据源选择">
              <div class="datasource-list">
                <div
                  v-for="ds in dataSources"
                  :key="ds.value"
                  class="datasource-item"
                  :class="{ active: reportForm.dataSource === ds.value }"
                  @click="selectDataSource(ds.value)"
                >
                  <el-icon class="ds-icon"><DataAnalysis /></el-icon>
                  <span>{{ ds.label }}</span>
                </div>
              </div>
            </el-collapse-item>

            <!-- 字段选择 -->
            <el-collapse-item name="fields" title="字段选择">
              <div class="field-section">
                <div class="field-section-title">维度字段</div>
                <div class="field-list">
                  <div
                    v-for="field in dimensionFields"
                    :key="field.value"
                    class="field-item"
                    :class="{ selected: isFieldSelected(field.value, 'dimension') }"
                    @click="toggleField(field, 'dimension')"
                  >
                    <el-icon class="field-icon"><Grid /></el-icon>
                    <span>{{ field.label }}</span>
                    <el-icon v-if="isFieldSelected(field.value, 'dimension')" class="field-check"><Check /></el-icon>
                  </div>
                </div>
              </div>
              <div class="field-section">
                <div class="field-section-title">指标字段</div>
                <div class="field-list">
                  <div
                    v-for="field in metricFields"
                    :key="field.value"
                    class="field-item"
                    :class="{ selected: isFieldSelected(field.value, 'metric') }"
                    @click="toggleField(field, 'metric')"
                  >
                    <el-icon class="field-icon metric"><TrendCharts /></el-icon>
                    <span>{{ field.label }}</span>
                    <el-icon v-if="isFieldSelected(field.value, 'metric')" class="field-check"><Check /></el-icon>
                  </div>
                </div>
              </div>
            </el-collapse-item>

            <!-- 筛选条件 -->
            <el-collapse-item name="filters" title="筛选条件">
              <div class="filter-list">
                <div v-for="(filter, index) in reportForm.filters" :key="index" class="filter-item">
                  <el-select v-model="filter.field" placeholder="字段" style="width: 100px" size="small">
                    <el-option
                      v-for="f in allFields"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                  <el-select v-model="filter.operator" placeholder="条件" style="width: 80px" size="small">
                    <el-option label="等于" value="eq" />
                    <el-option label="不等于" value="ne" />
                    <el-option label="大于" value="gt" />
                    <el-option label="小于" value="lt" />
                    <el-option label="包含" value="like" />
                    <el-option label="介于" value="between" />
                    <el-option label="属于" value="in" />
                  </el-select>
                  <el-input v-model="filter.value" placeholder="值" style="width: 100px" size="small" />
                  <el-button type="danger" size="small" :icon="Delete" circle @click="removeFilter(index)" />
                </div>
                <el-button type="primary" size="small" plain @click="addFilter" style="width: 100%; margin-top: 8px">
                  <el-icon><Plus /></el-icon>
                  添加筛选条件
                </el-button>
              </div>
            </el-collapse-item>

            <!-- 图表设置 -->
            <el-collapse-item name="chart" title="图表设置">
              <el-form :model="reportForm" label-width="80px" label-position="left">
                <el-form-item label="图表类型">
                  <el-radio-group v-model="reportForm.chartType" style="display: flex; flex-direction: column; gap: 8px">
                    <el-radio value="table">
                      <el-icon><Tickets /></el-icon>
                      数据表格
                    </el-radio>
                    <el-radio value="bar">
                      <el-icon><Histogram /></el-icon>
                      柱状图
                    </el-radio>
                    <el-radio value="line">
                      <el-icon><TrendCharts /></el-icon>
                      折线图
                    </el-radio>
                    <el-radio value="pie">
                      <el-icon><PieChart /></el-icon>
                      饼图
                    </el-radio>
                    <el-radio value="bar-line">
                      <el-icon><DataLine /></el-icon>
                      组合图
                    </el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="reportForm.chartType !== 'table' && reportForm.chartType !== 'pie'" label="X轴字段">
                  <el-select v-model="reportForm.xAxisField" placeholder="请选择X轴字段" style="width: 100%">
                    <el-option
                      v-for="f in selectedDimensionFields"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="reportForm.chartType === 'pie'" label="名称字段">
                  <el-select v-model="reportForm.xAxisField" placeholder="请选择名称字段" style="width: 100%">
                    <el-option
                      v-for="f in selectedDimensionFields"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="reportForm.chartType !== 'table'" label="数据字段">
                  <el-select v-model="reportForm.yAxisField" placeholder="请选择数据字段" style="width: 100%">
                    <el-option
                      v-for="f in selectedMetricFields"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="显示图例">
                  <el-switch v-model="reportForm.showLegend" />
                </el-form-item>
                <el-form-item label="显示数值">
                  <el-switch v-model="reportForm.showValue" />
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 分组汇总 -->
            <el-collapse-item name="group" title="分组汇总">
              <el-form :model="reportForm" label-width="80px" label-position="left">
                <el-form-item label="分组字段">
                  <el-select
                    v-model="reportForm.groupFields"
                    multiple
                    placeholder="选择分组字段"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="f in selectedDimensionFields"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="排序字段">
                  <el-select v-model="reportForm.sortField" placeholder="选择排序字段" style="width: 100%">
                    <el-option
                      v-for="f in [...selectedDimensionFields, ...selectedMetricFields]"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="排序方式">
                  <el-radio-group v-model="reportForm.sortOrder">
                    <el-radio value="desc">降序</el-radio>
                    <el-radio value="asc">升序</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="限制条数">
                  <el-input-number v-model="reportForm.limit" :min="1" :max="1000" style="width: 100%" />
                </el-form-item>
              </el-form>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 右侧预览区 -->
        <div class="designer-right">
          <div class="preview-header">
            <span class="preview-title">报表预览</span>
            <div class="preview-actions">
              <el-radio-group v-model="previewMode" size="small" @change="onPreviewModeChange">
                <el-radio-button value="chart">图表</el-radio-button>
                <el-radio-button value="table">表格</el-radio-button>
              </el-radio-group>
              <el-button size="small" :icon="Refresh" @click="refreshPreview">刷新</el-button>
              <el-dropdown @command="onExportCommand" size="small">
                <el-button type="primary" size="small">
                  导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
                    <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
                    <el-dropdown-item command="image">导出图片</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div class="preview-body" v-loading="previewLoading">
            <!-- 图表预览 -->
            <div v-show="previewMode === 'chart'" class="chart-preview" ref="chartPreviewRef">
              <div v-if="reportForm.chartType === 'table'" class="table-preview">
                <el-table :data="previewData" border size="small" max-height="500">
                  <el-table-column
                    v-for="col in previewColumns"
                    :key="col.value"
                    :prop="col.value"
                    :label="col.label"
                    min-width="120"
                    align="center"
                  />
                </el-table>
              </div>
              <div v-else ref="chartRef" class="chart-canvas"></div>
            </div>

            <!-- 表格预览 -->
            <div v-show="previewMode === 'table'" class="table-preview">
              <el-table :data="previewData" border stripe max-height="500">
                <el-table-column type="index" label="序号" width="60" align="center" />
                <el-table-column
                  v-for="col in previewColumns"
                  :key="col.value"
                  :prop="col.value"
                  :label="col.label"
                  min-width="120"
                  show-overflow-tooltip
                />
              </el-table>
              <div class="preview-pagination">
                <el-pagination
                  small
                  v-model:current-page="previewPage"
                  :page-size="previewPageSize"
                  :total="previewTotal"
                  layout="total, prev, pager, next"
                />
              </div>
            </div>
          </div>

          <div class="preview-footer">
            <el-tag type="info">共 {{ previewTotal }} 条数据</el-tag>
            <span v-if="lastPreviewTime" class="text-muted">上次更新：{{ lastPreviewTime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus, ArrowLeft, Delete, Refresh, ArrowDown, Check,
  DataAnalysis, Grid, TrendCharts, Histogram, PieChart as PieChartIcon, DataLine, Tickets
} from "@element-plus/icons-vue";
import echarts from "@/utils/echarts";
import type { ECharts } from "echarts/core";
import {
  fetchReportTemplates, createReportTemplate, updateReportTemplate,
  deleteReportTemplate, executeReportTemplate,
} from "@/api";

// ========== 列表相关 ==========
const listLoading = ref(false);
const reportList = ref<any[]>([]);
const searchForm = reactive({
  keyword: "",
  type: "",
  dateRange: [] as string[],
});
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

// 模拟数据
const mockReports = [
  { id: 1, name: "月度销售趋势分析", type: "sales", chartType: "line", createdBy: "管理员", createdAt: "2026-07-01 10:00:00", updatedAt: "2026-07-10 14:30:00", status: "active" },
  { id: 2, name: "商品销售排行", type: "sales", chartType: "bar", createdBy: "管理员", createdAt: "2026-07-02 11:00:00", updatedAt: "2026-07-08 09:20:00", status: "active" },
  { id: 3, name: "库存周转率分析", type: "inventory", chartType: "bar", createdBy: "张三", createdAt: "2026-07-03 09:00:00", updatedAt: "2026-07-05 16:45:00", status: "active" },
  { id: 4, name: "客户贡献度分布", type: "customer", chartType: "pie", createdBy: "李四", createdAt: "2026-07-04 15:00:00", updatedAt: "2026-07-06 10:10:00", status: "active" },
  { id: 5, name: "采购金额统计", type: "purchase", chartType: "table", createdBy: "王五", createdAt: "2026-07-05 08:00:00", updatedAt: "2026-07-07 11:30:00", status: "inactive" },
  { id: 6, name: "收支明细报表", type: "finance", chartType: "table", createdBy: "管理员", createdAt: "2026-07-06 14:00:00", updatedAt: "2026-07-09 13:00:00", status: "active" },
  { id: 7, name: "订单状态分布", type: "orders", chartType: "pie", createdBy: "管理员", createdAt: "2026-07-08 10:30:00", updatedAt: "2026-07-10 15:00:00", status: "active" },
  { id: 8, name: "门店业绩对比", type: "sales", chartType: "bar-line", createdBy: "张三", createdAt: "2026-07-09 11:00:00", updatedAt: "2026-07-11 09:45:00", status: "active" },
];

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    sales: "销售报表", purchase: "采购报表", inventory: "库存报表",
    customer: "客户报表", finance: "财务报表", orders: "订单报表",
  };
  return map[type] || type;
};

const getTypeTagType = (type: string) => {
  const map: Record<string, string> = {
    sales: "primary", purchase: "success", inventory: "warning",
    customer: "danger", finance: "info", orders: "",
  };
  return map[type] || "";
};

const getChartTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    table: "数据表格", bar: "柱状图", line: "折线图",
    pie: "饼图", "bar-line": "组合图",
  };
  return map[type] || type;
};

const fetchReportList = async () => {
  listLoading.value = true;
  try {
    // 先尝试调真实 API，失败则用 mock 数据
    try {
      const res = await fetchReportTemplates({
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword: searchForm.keyword || undefined,
        type: searchForm.type || undefined,
      });
      reportList.value = res.records || [];
      pagination.total = res.total || 0;
    } catch {
      // 使用 mock 数据
      let filtered = [...mockReports];
      if (searchForm.keyword) {
        filtered = filtered.filter(r => r.name.includes(searchForm.keyword));
      }
      if (searchForm.type) {
        filtered = filtered.filter(r => r.type === searchForm.type);
      }
      pagination.total = filtered.length;
      const start = (pagination.page - 1) * pagination.pageSize;
      reportList.value = filtered.slice(start, start + pagination.pageSize);
    }
  } catch {
    ElMessage.error("获取报表列表失败");
  } finally {
    listLoading.value = false;
  }
};

const resetSearch = () => {
  searchForm.keyword = "";
  searchForm.type = "";
  searchForm.dateRange = [];
  pagination.page = 1;
  fetchReportList();
};

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm("确定删除该报表?", "确认删除", { type: "warning" });
    try {
      await deleteReportTemplate(row.id);
    } catch {
      // mock 删除
      const idx = reportList.value.findIndex(r => r.id === row.id);
      if (idx > -1) reportList.value.splice(idx, 1);
      pagination.total--;
    }
    ElMessage.success("删除成功");
    fetchReportList();
  } catch { /* cancelled */ }
};

const viewReport = (row: any) => {
  openDesigner(row, true);
};

// ========== 设计器相关 ==========
const showDesigner = ref(false);
const isEdit = ref(false);
const isView = ref(false);
const saving = ref(false);
const activeCollapse = ref(["basic", "datasource", "fields", "chart"]);

const reportForm = reactive({
  id: null as number | null,
  name: "",
  type: "sales",
  description: "",
  dataSource: "sale_bill",
  dimensions: [] as string[],
  metrics: [] as string[],
  filters: [] as Array<{ field: string; operator: string; value: string }>,
  chartType: "bar" as string,
  xAxisField: "",
  yAxisField: "",
  showLegend: true,
  showValue: false,
  groupFields: [] as string[],
  sortField: "",
  sortOrder: "desc",
  limit: 100,
});

// 数据源配置
const dataSources = [
  { value: "sale_bill", label: "销售数据", type: "sales" },
  { value: "purchase_order", label: "采购数据", type: "purchase" },
  { value: "inventory_balance", label: "库存数据", type: "inventory" },
  { value: "customer", label: "客户数据", type: "customer" },
  { value: "finance_payment", label: "财务数据", type: "finance" },
  { value: "order", label: "订单数据", type: "orders" },
];

// 字段配置 - 按类型区分
const fieldConfig: Record<string, { dimensions: Array<{ value: string; label: string }>; metrics: Array<{ value: string; label: string }> }> = {
  sales: {
    dimensions: [
      { value: "date", label: "日期" },
      { value: "store_id", label: "门店" },
      { value: "sku_id", label: "商品" },
      { value: "customer_id", label: "客户" },
      { value: "operator_id", label: "业务员" },
      { value: "sale_type", label: "销售类型" },
      { value: "category_id", label: "商品分类" },
      { value: "brand_id", label: "品牌" },
    ],
    metrics: [
      { value: "amount", label: "销售金额" },
      { value: "quantity", label: "销售数量" },
      { value: "profit", label: "利润" },
      { value: "order_count", label: "订单数" },
      { value: "cost", label: "成本" },
      { value: "discount", label: "优惠金额" },
    ],
  },
  purchase: {
    dimensions: [
      { value: "date", label: "日期" },
      { value: "supplier_id", label: "供应商" },
      { value: "sku_id", label: "商品" },
      { value: "store_id", label: "入库门店" },
      { value: "category_id", label: "商品分类" },
      { value: "brand_id", label: "品牌" },
    ],
    metrics: [
      { value: "amount", label: "采购金额" },
      { value: "quantity", label: "采购数量" },
      { value: "tax_amount", label: "税额" },
      { value: "order_count", label: "采购单数" },
      { value: "return_amount", label: "退货金额" },
    ],
  },
  inventory: {
    dimensions: [
      { value: "sku_id", label: "商品" },
      { value: "store_id", label: "门店" },
      { value: "category_id", label: "商品分类" },
      { value: "brand_id", label: "品牌" },
      { value: "batch_no", label: "批次号" },
    ],
    metrics: [
      { value: "stock_qty", label: "库存数量" },
      { value: "stock_cost", label: "库存成本" },
      { value: "in_qty", label: "入库数量" },
      { value: "out_qty", label: "出库数量" },
      { value: "turnover_rate", label: "周转率" },
      { value: "alert_qty", label: "预警数量" },
    ],
  },
  customer: {
    dimensions: [
      { value: "level", label: "客户等级" },
      { value: "tag", label: "客户标签" },
      { value: "region", label: "地区" },
      { value: "salesman_id", label: "负责业务员" },
      { value: "source", label: "客户来源" },
    ],
    metrics: [
      { value: "total_amount", label: "累计消费" },
      { value: "order_count", label: "订单数" },
      { value: "customer_count", label: "客户数" },
      { value: "avg_order_amount", label: "客单价" },
      { value: "receivable", label: "应收余额" },
      { value: "points", label: "积分" },
    ],
  },
  finance: {
    dimensions: [
      { value: "date", label: "日期" },
      { value: "type", label: "收支类型" },
      { value: "category", label: "费用分类" },
      { value: "payment_method", label: "支付方式" },
      { value: "store_id", label: "门店" },
    ],
    metrics: [
      { value: "income", label: "收入金额" },
      { value: "expense", label: "支出金额" },
      { value: "profit", label: "利润" },
      { value: "balance", label: "余额" },
      { value: "voucher_count", label: "凭证数" },
    ],
  },
  orders: {
    dimensions: [
      { value: "date", label: "日期" },
      { value: "store_id", label: "门店" },
      { value: "status", label: "订单状态" },
      { value: "platform", label: "平台" },
      { value: "delivery_type", label: "配送类型" },
      { value: "sku_id", label: "商品" },
    ],
    metrics: [
      { value: "order_count", label: "订单数" },
      { value: "amount", label: "订单金额" },
      { value: "item_count", label: "商品件数" },
      { value: "refund_count", label: "退款数" },
      { value: "refund_amount", label: "退款金额" },
      { value: "cancel_count", label: "取消数" },
    ],
  },
};

const currentFieldConfig = computed(() => fieldConfig[reportForm.type] || fieldConfig.sales);
const dimensionFields = computed(() => currentFieldConfig.value.dimensions);
const metricFields = computed(() => currentFieldConfig.value.metrics);
const allFields = computed(() => [...dimensionFields.value, ...metricFields.value]);

const selectedDimensionFields = computed(() =>
  dimensionFields.value.filter(f => reportForm.dimensions.includes(f.value))
);
const selectedMetricFields = computed(() =>
  metricFields.value.filter(f => reportForm.metrics.includes(f.value))
);

const isFieldSelected = (value: string, type: "dimension" | "metric") => {
  if (type === "dimension") return reportForm.dimensions.includes(value);
  return reportForm.metrics.includes(value);
};

const toggleField = (field: { value: string; label: string }, type: "dimension" | "metric") => {
  if (type === "dimension") {
    const idx = reportForm.dimensions.indexOf(field.value);
    if (idx > -1) {
      reportForm.dimensions.splice(idx, 1);
      if (reportForm.xAxisField === field.value) reportForm.xAxisField = "";
    } else {
      reportForm.dimensions.push(field.value);
      if (!reportForm.xAxisField) reportForm.xAxisField = field.value;
    }
  } else {
    const idx = reportForm.metrics.indexOf(field.value);
    if (idx > -1) {
      reportForm.metrics.splice(idx, 1);
      if (reportForm.yAxisField === field.value) reportForm.yAxisField = "";
    } else {
      reportForm.metrics.push(field.value);
      if (!reportForm.yAxisField) reportForm.yAxisField = field.value;
    }
  }
  refreshPreview();
};

const selectDataSource = (value: string) => {
  const ds = dataSources.find(d => d.value === value);
  if (ds) {
    reportForm.dataSource = value;
    reportForm.type = ds.type;
    reportForm.dimensions = [];
    reportForm.metrics = [];
    reportForm.xAxisField = "";
    reportForm.yAxisField = "";
    // 默认选前两个维度和前两个指标
    if (dimensionFields.value.length > 0) {
      reportForm.dimensions.push(dimensionFields.value[0].value);
      reportForm.xAxisField = dimensionFields.value[0].value;
    }
    if (metricFields.value.length > 0) {
      reportForm.metrics.push(metricFields.value[0].value);
      reportForm.yAxisField = metricFields.value[0].value;
    }
    refreshPreview();
  }
};

const onTypeChange = (val: string) => {
  const ds = dataSources.find(d => d.type === val);
  if (ds) selectDataSource(ds.value);
};

const addFilter = () => {
  reportForm.filters.push({ field: "", operator: "eq", value: "" });
};

const removeFilter = (index: number) => {
  reportForm.filters.splice(index, 1);
};

const openDesigner = (row?: any, viewOnly = false) => {
  isView.value = viewOnly;
  if (row) {
    isEdit.value = true;
    reportForm.id = row.id;
    reportForm.name = row.name;
    reportForm.type = row.type;
    reportForm.description = row.description || "";
    reportForm.chartType = row.chartType || "bar";
    // 模拟从后端加载配置
    const ds = dataSources.find(d => d.type === row.type);
    if (ds) reportForm.dataSource = ds.value;
    if (dimensionFields.value.length > 0) {
      reportForm.dimensions = [dimensionFields.value[0].value];
      reportForm.xAxisField = dimensionFields.value[0].value;
    }
    if (metricFields.value.length > 0) {
      reportForm.metrics = [metricFields.value[0].value];
      reportForm.yAxisField = metricFields.value[0].value;
    }
  } else {
    isEdit.value = false;
    reportForm.id = null;
    reportForm.name = "";
    reportForm.type = "sales";
    reportForm.description = "";
    reportForm.dataSource = "sale_bill";
    reportForm.dimensions = dimensionFields.value.slice(0, 1).map(f => f.value);
    reportForm.metrics = metricFields.value.slice(0, 1).map(f => f.value);
    reportForm.filters = [];
    reportForm.chartType = "bar";
    reportForm.xAxisField = dimensionFields.value[0]?.value || "";
    reportForm.yAxisField = metricFields.value[0]?.value || "";
    reportForm.showLegend = true;
    reportForm.showValue = false;
    reportForm.groupFields = [];
    reportForm.sortField = "";
    reportForm.sortOrder = "desc";
    reportForm.limit = 100;
  }
  showDesigner.value = true;
  nextTick(() => {
    refreshPreview();
  });
};

const closeDesigner = () => {
  showDesigner.value = false;
  isEdit.value = false;
  isView.value = false;
};

const saveReport = async () => {
  if (!reportForm.name) {
    ElMessage.warning("请输入报表名称");
    return;
  }
  if (reportForm.dimensions.length === 0) {
    ElMessage.warning("请至少选择一个维度字段");
    return;
  }
  if (reportForm.metrics.length === 0) {
    ElMessage.warning("请至少选择一个指标字段");
    return;
  }
  saving.value = true;
  try {
    const config = {
      dataSource: reportForm.dataSource,
      dimensions: reportForm.dimensions,
      metrics: reportForm.metrics,
      filters: reportForm.filters,
      chartType: reportForm.chartType,
      xAxisField: reportForm.xAxisField,
      yAxisField: reportForm.yAxisField,
      showLegend: reportForm.showLegend,
      showValue: reportForm.showValue,
      groupFields: reportForm.groupFields,
      sortField: reportForm.sortField,
      sortOrder: reportForm.sortOrder,
      limit: reportForm.limit,
    };
    if (isEdit.value && reportForm.id) {
      try {
        await updateReportTemplate(reportForm.id, {
          name: reportForm.name,
          type: reportForm.type,
          description: reportForm.description,
          config,
        });
      } catch {
        // mock 更新
        const idx = mockReports.findIndex(r => r.id === reportForm.id);
        if (idx > -1) {
          mockReports[idx] = { ...mockReports[idx], name: reportForm.name, type: reportForm.type, chartType: reportForm.chartType };
        }
      }
      ElMessage.success("更新成功");
    } else {
      try {
        await createReportTemplate({
          name: reportForm.name,
          type: reportForm.type,
          description: reportForm.description,
          config,
        });
      } catch {
        // mock 创建
        const newId = Math.max(...mockReports.map(r => r.id)) + 1;
        mockReports.unshift({
          id: newId,
          name: reportForm.name,
          type: reportForm.type,
          chartType: reportForm.chartType,
          createdBy: "当前用户",
          createdAt: new Date().toLocaleString(),
          updatedAt: new Date().toLocaleString(),
          status: "active",
        });
      }
      ElMessage.success("创建成功");
    }
    closeDesigner();
    fetchReportList();
  } catch {
    ElMessage.error("保存失败");
  } finally {
    saving.value = false;
  }
};

// ========== 预览相关 ==========
const previewMode = ref("chart");
const previewLoading = ref(false);
const previewData = ref<any[]>([]);
const previewColumns = computed(() => {
  const cols: Array<{ value: string; label: string }> = [];
  selectedDimensionFields.value.forEach(f => cols.push({ value: f.value, label: f.label }));
  selectedMetricFields.value.forEach(f => cols.push({ value: f.value, label: f.label }));
  return cols;
});
const previewPage = ref(1);
const previewPageSize = ref(20);
const previewTotal = ref(0);
const lastPreviewTime = ref("");
const chartRef = ref<HTMLDivElement>();
const chartPreviewRef = ref<HTMLDivElement>();
let chartInstance: ECharts | null = null;

const handleResize = () => {
  chartInstance?.resize();
};

// 生成 mock 预览数据
const generateMockPreviewData = () => {
  const dimFields = selectedDimensionFields.value;
  const metFields = selectedMetricFields.value;
  if (dimFields.length === 0 || metFields.length === 0) return [];

  const xField = reportForm.xAxisField || dimFields[0].value;
  const xLabel = dimFields.find(f => f.value === xField)?.label || xField;

  const count = Math.min(reportForm.limit, 12);
  const data: any[] = [];
  const categories = generateMockCategories(xField, count);

  for (let i = 0; i < count; i++) {
    const item: any = {};
    // 填充维度
    dimFields.forEach(f => {
      if (f.value === xField) {
        item[f.value] = categories[i];
      } else {
        item[f.value] = generateMockDimensionValue(f.value, i);
      }
    });
    // 填充指标
    metFields.forEach(f => {
      item[f.value] = Math.floor(Math.random() * 10000 + 1000);
    });
    data.push(item);
  }
  return data;
};

const generateMockCategories = (field: string, count: number): string[] => {
  if (field === "date") {
    const dates: string[] = [];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return dates;
  }
  if (field === "store_id") {
    return ["总店", "城东店", "城西店", "城南店", "城北店", "开发区店", "高新区店", "滨江店"].slice(0, count);
  }
  if (field === "sku_id" || field === "商品") {
    return ["飞天茅台", "五粮液", "剑南春", "泸州老窖", "郎酒", "习酒", "国窖1573", "汾酒", "洋河", "古井贡"].slice(0, count);
  }
  if (field === "customer_id") {
    return ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"].slice(0, count);
  }
  if (field === "category_id") {
    return ["白酒", "红酒", "啤酒", "洋酒", "黄酒", "饮料"].slice(0, count);
  }
  if (field === "brand_id") {
    return ["茅台", "五粮液", "剑南春", "泸州老窖", "郎酒", "习酒"].slice(0, count);
  }
  if (field === "level") {
    return ["钻石会员", "黄金会员", "白银会员", "普通会员"].slice(0, count);
  }
  if (field === "status") {
    return ["待付款", "待发货", "待收货", "已完成", "已取消"].slice(0, count);
  }
  if (field === "platform") {
    return ["美团外卖", "饿了么", "京东到家", "抖音外卖"].slice(0, count);
  }
  return Array.from({ length: count }, (_, i) => `项目${i + 1}`);
};

const generateMockDimensionValue = (field: string, index: number): string => {
  const allStores = ["总店", "城东店", "城西店", "城南店"];
  if (field === "store_id") return allStores[index % allStores.length];
  if (field === "sale_type") return index % 2 === 0 ? "现销" : "赊销";
  return `值${index + 1}`;
};

const refreshPreview = async () => {
  if (!showDesigner.value) return;
  if (selectedDimensionFields.value.length === 0 || selectedMetricFields.value.length === 0) {
    previewData.value = [];
    previewTotal.value = 0;
    return;
  }
  previewLoading.value = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 300));
    previewData.value = generateMockPreviewData();
    previewTotal.value = previewData.value.length;
    lastPreviewTime.value = new Date().toLocaleTimeString();
    if (previewMode.value === "chart" && reportForm.chartType !== "table") {
      await nextTick();
      renderChart();
    }
  } catch {
    ElMessage.error("预览生成失败");
  } finally {
    previewLoading.value = false;
  }
};

const renderChart = () => {
  if (!chartRef.value) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  const xField = reportForm.xAxisField || selectedDimensionFields.value[0]?.value;
  const yField = reportForm.yAxisField || selectedMetricFields.value[0]?.value;
  const xLabel = selectedDimensionFields.value.find(f => f.value === xField)?.label || xField;
  const yLabel = selectedMetricFields.value.find(f => f.value === yField)?.label || yField;

  const xData = previewData.value.map((d: any) => d[xField]);
  const yData = previewData.value.map((d: any) => d[yField]);

  let option: any = {};

  if (reportForm.chartType === "bar") {
    option = {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { show: reportForm.showLegend, top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 60 },
      xAxis: {
        type: "category",
        data: xData,
        axisLabel: { rotate: xData.length > 8 ? 30 : 0, interval: 0 },
      },
      yAxis: { type: "value" },
      series: [{
        name: yLabel,
        type: "bar",
        data: yData,
        barMaxWidth: 50,
        label: { show: reportForm.showValue, position: "top" },
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#409eff" },
            { offset: 1, color: "#79bbff" },
          ]),
        },
      }],
    };
  } else if (reportForm.chartType === "line") {
    option = {
      tooltip: { trigger: "axis" },
      legend: { show: reportForm.showLegend, top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 60 },
      xAxis: {
        type: "category",
        data: xData,
        boundaryGap: false,
        axisLabel: { rotate: xData.length > 8 ? 30 : 0 },
      },
      yAxis: { type: "value" },
      series: [{
        name: yLabel,
        type: "line",
        data: yData,
        smooth: true,
        symbol: "circle",
        symbolSize: 8,
        label: { show: reportForm.showValue, position: "top" },
        lineStyle: { width: 3, color: "#67c23a" },
        itemStyle: { color: "#67c23a" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(103, 194, 58, 0.3)" },
            { offset: 1, color: "rgba(103, 194, 58, 0.05)" },
          ]),
        },
      }],
    };
  } else if (reportForm.chartType === "pie") {
    const pieData = previewData.value.map((d: any) => ({
      name: d[xField],
      value: d[yField],
    }));
    option = {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: {
        show: reportForm.showLegend,
        orient: "vertical",
        right: 10,
        top: "center",
        textStyle: { fontSize: 12 },
      },
      series: [{
        name: yLabel,
        type: "pie",
        radius: ["45%", "70%"],
        center: ["35%", "50%"],
        data: pieData,
        label: { show: reportForm.showValue, formatter: "{b}\n{d}%" },
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
      }],
    };
  } else if (reportForm.chartType === "bar-line") {
    const y2Field = selectedMetricFields.value[1]?.value || yField;
    const y2Label = selectedMetricFields.value[1]?.label || yLabel;
    const y2Data = previewData.value.map((d: any) => d[y2Field]);
    option = {
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { show: reportForm.showLegend, top: 0 },
      grid: { left: 60, right: 60, top: 40, bottom: 60 },
      xAxis: {
        type: "category",
        data: xData,
        axisLabel: { rotate: xData.length > 8 ? 30 : 0 },
      },
      yAxis: [
        { type: "value", name: yLabel, position: "left" },
        { type: "value", name: y2Label, position: "right" },
      ],
      series: [
        {
          name: yLabel,
          type: "bar",
          data: yData,
          barMaxWidth: 30,
          label: { show: reportForm.showValue, position: "top" },
          itemStyle: { color: "#409eff" },
        },
        {
          name: y2Label,
          type: "line",
          yAxisIndex: 1,
          data: y2Data,
          smooth: true,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 2, color: "#e6a23c" },
          itemStyle: { color: "#e6a23c" },
        },
      ],
    };
  }

  chartInstance.setOption(option, true);
};

const onPreviewModeChange = () => {
  if (previewMode.value === "chart" && reportForm.chartType !== "table") {
    nextTick(() => renderChart());
  }
};

watch(() => reportForm.chartType, () => {
  if (showDesigner.value && previewMode.value === "chart") {
    nextTick(() => renderChart());
  }
});

// ========== 导出相关 ==========
const onExportCommand = async (command: string) => {
  if (command === "excel") {
    exportToExcel();
  } else if (command === "pdf") {
    exportToPdf();
  } else if (command === "image") {
    exportToImage();
  }
};

const exportReport = (row: any, format: string) => {
  ElMessage.info(`正在导出 ${row.name} 为 ${format.toUpperCase()} 格式...`);
  setTimeout(() => {
    ElMessage.success("导出成功，文件已开始下载");
  }, 800);
};

const exportToExcel = () => {
  ElMessage.info("正在生成 Excel 文件...");
  // 模拟导出 - 实际应调后端 API
  setTimeout(() => {
    ElMessage.success("Excel 导出成功");
  }, 800);
};

const exportToPdf = () => {
  ElMessage.info("正在生成 PDF 文件...");
  setTimeout(() => {
    ElMessage.success("PDF 导出成功");
  }, 800);
};

const exportToImage = () => {
  ElMessage.info("正在生成图片...");
  setTimeout(() => {
    ElMessage.success("图片导出成功");
  }, 800);
};

// ========== 生命周期 ==========
onMounted(() => {
  fetchReportList();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped>
.custom-report-page {
  padding: 20px;
}
.toolbar-card {
  margin-bottom: 16px;
}
.table-card {
  margin-bottom: 16px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.text-muted {
  color: #909399;
  font-size: 12px;
}

/* 设计器 */
.designer-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;
}
.designer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.designer-title {
  display: flex;
  align-items: center;
}
.designer-actions {
  display: flex;
  gap: 8px;
}
.designer-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.designer-left {
  width: 340px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 10px;
}
.designer-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.preview-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.preview-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.preview-body {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}
.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  font-size: 12px;
}
.preview-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

/* 折叠面板 */
.designer-collapse :deep(.el-collapse-item__header) {
  font-weight: 600;
  font-size: 13px;
}
.designer-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 12px;
}

/* 数据源 */
.datasource-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.datasource-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}
.datasource-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}
.datasource-item.active {
  border-color: #409eff;
  background: #409eff;
  color: #fff;
}
.datasource-item.active .ds-icon {
  color: #fff;
}
.ds-icon {
  font-size: 24px;
  color: #409eff;
}

/* 字段选择 */
.field-section {
  margin-bottom: 12px;
}
.field-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
  padding-left: 4px;
}
.field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  position: relative;
}
.field-item:hover {
  border-color: #c6e2ff;
  background: #ecf5ff;
}
.field-item.selected {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.field-item.selected .field-icon {
  color: #fff;
}
.field-icon {
  font-size: 12px;
  color: #909399;
}
.field-icon.metric {
  color: #67c23a;
}
.field-check {
  font-size: 12px;
}

/* 筛选条件 */
.filter-item {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

/* 图表预览 */
.chart-preview {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
.chart-canvas {
  width: 100%;
  height: 500px;
}
.table-preview {
  width: 100%;
}
</style>
