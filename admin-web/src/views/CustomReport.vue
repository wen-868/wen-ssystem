<template>
  <div class="custom-report-page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 报表模板 Tab -->
      <el-tab-pane label="报表模板" name="templates">
        <el-card class="toolbar-card">
          <el-form :model="templateSearch" inline>
            <el-form-item label="关键词">
              <el-input v-model="templateSearch.keyword" placeholder="模板名称" clearable />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="templateSearch.type" placeholder="请选择类型" clearable>
                <el-option label="销售" value="sales" />
                <el-option label="库存" value="inventory" />
                <el-option label="订单" value="orders" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchTemplates">查询</el-button>
              <el-button type="success" @click="showTemplateDialog()">新建模板</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="table-card">
          <el-table :data="templates" border v-loading="templateLoading">
            <el-table-column prop="name" label="模板名称" min-width="150" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag>{{ getTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180" />
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="executeTemplate(row)">执行</el-button>
                <el-button size="small" @click="showTemplateDialog(row)">编辑</el-button>
                <el-button type="danger" size="small" @click="handleDeleteTemplate(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination v-model:current-page="templatePage" :page-size="templatePageSize" :total="templateTotal"
              layout="total, prev, pager, next" @current-change="fetchTemplates" />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 定时任务 Tab -->
      <el-tab-pane label="定时任务" name="schedules">
        <el-card class="toolbar-card">
          <el-form :model="scheduleSearch" inline>
            <el-form-item label="关键词">
              <el-input v-model="scheduleSearch.keyword" placeholder="任务名称" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchSchedules">查询</el-button>
              <el-button type="success" @click="showScheduleDialog()">新建任务</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="table-card">
          <el-table :data="schedules" border v-loading="scheduleLoading">
            <el-table-column prop="name" label="任务名称" min-width="150" />
            <el-table-column prop="templateName" label="关联模板" min-width="150" />
            <el-table-column prop="cronExpression" label="CRON表达式" width="150" />
            <el-table-column prop="exportFormat" label="导出格式" width="100" />
            <el-table-column prop="lastRunAt" label="上次执行" width="180" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'warning'">
                  {{ row.status === 'active' ? '运行中' : '已暂停' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="runSchedule(row)">立即执行</el-button>
                <el-button size="small" @click="toggleSchedule(row)">
                  {{ row.status === 'active' ? '暂停' : '启用' }}
                </el-button>
                <el-button size="small" @click="showScheduleDialog(row)">编辑</el-button>
                <el-button type="danger" size="small" @click="handleDeleteSchedule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination v-model:current-page="schedulePage" :page-size="schedulePageSize" :total="scheduleTotal"
              layout="total, prev, pager, next" @current-change="fetchSchedules" />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 模板编辑对话框 -->
    <el-dialog :title="templateDialogTitle" v-model="templateDialogVisible" width="600px" @close="resetTemplateForm">
      <el-form :model="templateForm" label-width="100px">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="报表类型">
          <el-select v-model="templateForm.type" placeholder="请选择类型" :disabled="templateEditId !== null">
            <el-option label="销售" value="sales" />
            <el-option label="库存" value="inventory" />
            <el-option label="订单" value="orders" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="templateForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="维度">
          <el-select v-model="templateForm.config.dimensions" multiple placeholder="请选择维度" style="width: 100%">
            <el-option label="日期" value="DATE(created_at)" />
            <el-option label="门店" value="store_id" />
            <el-option label="商品" value="sku_id" />
            <el-option label="客户" value="customer_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="指标">
          <el-select v-model="templateForm.config.metrics" multiple placeholder="请选择指标" style="width: 100%">
            <el-option label="销售额" value="SUM(amount) AS total_amount" />
            <el-option label="订单数" value="COUNT(*) AS order_count" />
            <el-option label="利润" value="SUM(profit) AS total_profit" />
            <el-option label="数量" value="SUM(quantity) AS total_quantity" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleTemplateSubmit" :loading="templateSubmitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 定时任务编辑对话框 -->
    <el-dialog :title="scheduleDialogTitle" v-model="scheduleDialogVisible" width="500px" @close="resetScheduleForm">
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="scheduleForm.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="关联模板">
          <el-select v-model="scheduleForm.templateId" placeholder="请选择模板" style="width: 100%">
            <el-option v-for="t in allTemplates" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="CRON表达式">
          <el-input v-model="scheduleForm.cronExpression" placeholder="如: 0 8 * * 1-5" />
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="scheduleForm.exportFormat" placeholder="请选择格式">
            <el-option label="CSV" value="csv" />
            <el-option label="Excel" value="xlsx" />
            <el-option label="PDF" value="pdf" />
          </el-select>
        </el-form-item>
        <el-form-item label="接收人">
          <el-input v-model="scheduleForm.recipients" placeholder="多个邮箱用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleScheduleSubmit" :loading="scheduleSubmitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchReportTemplates, createReportTemplate, updateReportTemplate,
  deleteReportTemplate, executeReportTemplate,
  fetchReportSchedules, createReportSchedule, updateReportSchedule,
  deleteReportSchedule, toggleReportSchedule, runReportSchedule,
} from "@/api";

const activeTab = ref("templates");

// ========== Templates ==========
const templates = ref<any[]>([]);
const allTemplates = ref<any[]>([]);
const templateLoading = ref(false);
const templateSubmitting = ref(false);
const templatePage = ref(1);
const templatePageSize = ref(20);
const templateTotal = ref(0);
const templateDialogVisible = ref(false);
const templateEditId = ref<number | null>(null);
const templateDialogTitle = ref("新建模板");

const templateSearch = reactive({ keyword: "", type: "" });

const templateForm = reactive({
  name: "",
  type: "sales",
  description: "",
  config: { dimensions: [] as string[], metrics: [] as string[] },
});

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = { sales: "销售", inventory: "库存", orders: "订单" };
  return map[type] || type;
};

const fetchTemplates = async () => {
  templateLoading.value = true;
  try {
    const res = await fetchReportTemplates({
      page: templatePage.value,
      pageSize: templatePageSize.value,
      keyword: templateSearch.keyword || undefined,
      type: templateSearch.type || undefined,
    });
    templates.value = res.records || [];
    templateTotal.value = res.total || 0;
  } catch { ElMessage.error("获取模板列表失败"); }
  finally { templateLoading.value = false; }
};

const fetchAllTemplates = async () => {
  try {
    const res = await fetchReportTemplates({ page: 1, pageSize: 1000 });
    allTemplates.value = res.records || [];
  } catch { /* ignore */ }
};

const showTemplateDialog = (row?: any) => {
  if (row) {
    templateEditId.value = row.id;
    templateDialogTitle.value = "编辑模板";
    templateForm.name = row.name;
    templateForm.type = row.type;
    templateForm.description = row.description || "";
    templateForm.config = typeof row.config === "string" ? JSON.parse(row.config) : (row.config || { dimensions: [], metrics: [] });
  } else {
    templateEditId.value = null;
    templateDialogTitle.value = "新建模板";
    resetTemplateForm();
  }
  templateDialogVisible.value = true;
};

const resetTemplateForm = () => {
  templateForm.name = "";
  templateForm.type = "sales";
  templateForm.description = "";
  templateForm.config = { dimensions: [], metrics: [] };
};

const handleTemplateSubmit = async () => {
  templateSubmitting.value = true;
  try {
    if (templateEditId.value) {
      await updateReportTemplate(templateEditId.value, {
        name: templateForm.name,
        type: templateForm.type,
        config: templateForm.config,
        description: templateForm.description,
      });
      ElMessage.success("更新成功");
    } else {
      await createReportTemplate({
        name: templateForm.name,
        type: templateForm.type,
        config: templateForm.config,
        description: templateForm.description,
      });
      ElMessage.success("创建成功");
    }
    templateDialogVisible.value = false;
    fetchTemplates();
    fetchAllTemplates();
  } catch { ElMessage.error("操作失败"); }
  finally { templateSubmitting.value = false; }
};

const handleDeleteTemplate = async (row: any) => {
  try {
    await ElMessageBox.confirm("确定删除该模板?", "确认", { type: "warning" });
    await deleteReportTemplate(row.id);
    ElMessage.success("删除成功");
    fetchTemplates();
  } catch { /* cancelled */ }
};

const executeTemplate = async (row: any) => {
  try {
    const res = await executeReportTemplate(row.id, {});
    ElMessage.success(`执行完成，共 ${res.total} 条记录`);
  } catch { ElMessage.error("执行失败"); }
};

// ========== Schedules ==========
const schedules = ref<any[]>([]);
const scheduleLoading = ref(false);
const scheduleSubmitting = ref(false);
const schedulePage = ref(1);
const schedulePageSize = ref(20);
const scheduleTotal = ref(0);
const scheduleDialogVisible = ref(false);
const scheduleEditId = ref<number | null>(null);
const scheduleDialogTitle = ref("新建定时任务");

const scheduleSearch = reactive({ keyword: "" });

const scheduleForm = reactive({
  name: "",
  templateId: null as number | null,
  cronExpression: "",
  exportFormat: "csv",
  recipients: "",
});

const fetchSchedules = async () => {
  scheduleLoading.value = true;
  try {
    const res = await fetchReportSchedules({
      page: schedulePage.value,
      pageSize: schedulePageSize.value,
      keyword: scheduleSearch.keyword || undefined,
    });
    schedules.value = res.records || [];
    scheduleTotal.value = res.total || 0;
  } catch { ElMessage.error("获取定时任务列表失败"); }
  finally { scheduleLoading.value = false; }
};

const showScheduleDialog = (row?: any) => {
  if (row) {
    scheduleEditId.value = row.id;
    scheduleDialogTitle.value = "编辑定时任务";
    scheduleForm.name = row.name;
    scheduleForm.templateId = row.templateId;
    scheduleForm.cronExpression = row.cronExpression;
    scheduleForm.exportFormat = row.exportFormat;
    scheduleForm.recipients = row.recipients || "";
  } else {
    scheduleEditId.value = null;
    scheduleDialogTitle.value = "新建定时任务";
    resetScheduleForm();
  }
  scheduleDialogVisible.value = true;
};

const resetScheduleForm = () => {
  scheduleForm.name = "";
  scheduleForm.templateId = null;
  scheduleForm.cronExpression = "";
  scheduleForm.exportFormat = "csv";
  scheduleForm.recipients = "";
};

const handleScheduleSubmit = async () => {
  scheduleSubmitting.value = true;
  try {
    if (scheduleEditId.value) {
      await updateReportSchedule(scheduleEditId.value, {
        name: scheduleForm.name,
        templateId: scheduleForm.templateId!,
        cronExpression: scheduleForm.cronExpression,
        exportFormat: scheduleForm.exportFormat,
        recipients: scheduleForm.recipients,
      });
      ElMessage.success("更新成功");
    } else {
      await createReportSchedule({
        name: scheduleForm.name,
        templateId: scheduleForm.templateId!,
        cronExpression: scheduleForm.cronExpression,
        exportFormat: scheduleForm.exportFormat,
        recipients: scheduleForm.recipients,
      });
      ElMessage.success("创建成功");
    }
    scheduleDialogVisible.value = false;
    fetchSchedules();
  } catch { ElMessage.error("操作失败"); }
  finally { scheduleSubmitting.value = false; }
};

const handleDeleteSchedule = async (row: any) => {
  try {
    await ElMessageBox.confirm("确定删除该定时任务?", "确认", { type: "warning" });
    await deleteReportSchedule(row.id);
    ElMessage.success("删除成功");
    fetchSchedules();
  } catch { /* cancelled */ }
};

const toggleSchedule = async (row: any) => {
  try {
    const newStatus = row.status === "active" ? "paused" : "active";
    await toggleReportSchedule(row.id, newStatus);
    ElMessage.success(newStatus === "active" ? "已启用" : "已暂停");
    fetchSchedules();
  } catch { ElMessage.error("操作失败"); }
};

const runSchedule = async (row: any) => {
  try {
    await runReportSchedule(row.id);
    ElMessage.success("执行成功");
    fetchSchedules();
  } catch { ElMessage.error("执行失败"); }
};

const handleTabChange = (tab: string) => {
  if (tab === "schedules") {
    fetchSchedules();
    fetchAllTemplates();
  }
};

onMounted(() => {
  fetchTemplates();
});
</script>

<style scoped>
.custom-report-page {
  padding: 20px;
}
.toolbar-card {
  margin-bottom: 20px;
}
.table-card {
  margin-bottom: 20px;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>