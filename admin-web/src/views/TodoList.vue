<template>
  <div class="page">
    <PageCard title="待办提醒">
      <template #extra>
        <el-button type="primary" @click="openCreateDialog">新建待办</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="16" class="stat-row">
        <el-col :span="4" v-for="card in statCards" :key="card.type">
          <div
            class="stat-card"
            :class="{ active: filter.type === card.type }"
            :style="{ borderLeftColor: card.color }"
            @click="toggleTypeFilter(card.type)"
          >
            <div class="stat-card-value" :style="{ color: card.color }">{{ card.count }}</div>
            <div class="stat-card-label">{{ card.label }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-select v-model="filter.type" placeholder="待办类型" clearable style="width: 160px" @change="search">
          <el-option label="库存预警" value="INVENTORY_ALERT" />
          <el-option label="订单待处理" value="ORDER_PENDING" />
          <el-option label="支付逾期" value="PAYMENT_OVERDUE" />
          <el-option label="采购审批" value="PURCHASE_APPROVAL" />
          <el-option label="退货待处理" value="RETURN_PENDING" />
          <el-option label="客户跟进" value="CUSTOMER_FOLLOWUP" />
        </el-select>
        <el-select v-model="filter.priority" placeholder="优先级" clearable style="width: 130px; margin-left: 12px" @change="search">
          <el-option label="高" value="HIGH" />
          <el-option label="中" value="MEDIUM" />
          <el-option label="低" value="LOW" />
        </el-select>
        <el-select v-model="filter.status" placeholder="状态" clearable style="width: 130px; margin-left: 12px" @change="search">
          <el-option label="待处理" value="PENDING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已忽略" value="DISMISSED" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag :color="getTypeColor(row.type)" effect="dark" style="border: none; color: #fff">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="140" show-overflow-tooltip />
        <el-table-column label="优先级" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getPriorityTagType(row.priority)" size="small">{{ getPriorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="截止日期" width="140">
          <template #default="{ row }">
            <span :class="{ 'overdue': isOverdue(row.dueDate) }">{{ formatDate(row.dueDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button size="small" type="success" @click="handleComplete(row)">完成</el-button>
              <el-button size="small" type="info" @click="handleDismiss(row)">忽略</el-button>
            </template>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            <el-button size="small" type="primary" link @click="handleNavigate(row)">跳转</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无待办事项，经营状态良好" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="(s: number) => { pageSize = s; search(); }"
          @current-change="(p: number) => { page = p; search(); }"
        />
      </div>
    </PageCard>

    <!-- 新建待办弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建待办" width="480px">
      <el-form ref="formRef" :model="form" label-width="90px">
        <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题' }]">
          <el-input v-model="form.title" placeholder="请输入待办标题" />
        </el-form-item>
        <el-form-item label="类型" prop="type" :rules="[{ required: true, message: '请选择类型' }]">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="库存预警" value="INVENTORY_ALERT" />
            <el-option label="订单待处理" value="ORDER_PENDING" />
            <el-option label="支付逾期" value="PAYMENT_OVERDUE" />
            <el-option label="采购审批" value="PURCHASE_APPROVAL" />
            <el-option label="退货待处理" value="RETURN_PENDING" />
            <el-option label="客户跟进" value="CUSTOMER_FOLLOWUP" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级" prop="priority" :rules="[{ required: true, message: '请选择优先级' }]">
          <el-select v-model="form.priority" style="width: 100%">
            <el-option label="高" value="HIGH" />
            <el-option label="中" value="MEDIUM" />
            <el-option label="低" value="LOW" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止日期" prop="dueDate">
          <el-date-picker v-model="form.dueDate" type="datetime" placeholder="选择截止日期" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import axios from "axios";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filter = reactive({
  type: "",
  priority: "",
  status: ""
});

const statCards = ref([
  { type: "INVENTORY_ALERT", label: "库存预警", count: 0, color: "#F56C6C" },
  { type: "ORDER_PENDING", label: "订单待处理", count: 0, color: "#409EFF" },
  { type: "PAYMENT_OVERDUE", label: "支付逾期", count: 0, color: "#E6A23C" },
  { type: "PURCHASE_APPROVAL", label: "采购审批", count: 0, color: "#722ED1" },
  { type: "RETURN_PENDING", label: "退货待处理", count: 0, color: "#13C2C2" },
  { type: "CUSTOMER_FOLLOWUP", label: "客户跟进", count: 0, color: "#67C23A" }
]);

const typeMap: Record<string, string> = {
  INVENTORY_ALERT: "库存预警",
  ORDER_PENDING: "订单待处理",
  PAYMENT_OVERDUE: "支付逾期",
  PURCHASE_APPROVAL: "采购审批",
  RETURN_PENDING: "退货待处理",
  CUSTOMER_FOLLOWUP: "客户跟进"
};

const typeColorMap: Record<string, string> = {
  INVENTORY_ALERT: "#F56C6C",
  ORDER_PENDING: "#409EFF",
  PAYMENT_OVERDUE: "#E6A23C",
  PURCHASE_APPROVAL: "#722ED1",
  RETURN_PENDING: "#13C2C2",
  CUSTOMER_FOLLOWUP: "#67C23A"
};

function getTypeLabel(type: string) { return typeMap[type] || type; }
function getTypeColor(type: string) { return typeColorMap[type] || "#909399"; }

function getPriorityLabel(p: string) {
  if (p === "HIGH") return "高";
  if (p === "MEDIUM") return "中";
  if (p === "LOW") return "低";
  return p;
}

function getPriorityTagType(p: string) {
  if (p === "HIGH") return "danger";
  if (p === "MEDIUM") return "warning";
  return "info";
}

function isOverdue(date: string) {
  if (!date) return false;
  return new Date(date) < new Date();
}

async function loadStats() {
  try {
    const { data: res } = await axios.get("/api/admin/todos/stats");
    const stats = res.data || res || {};
    statCards.value.forEach(card => {
      card.count = stats[card.type] || 0;
    });
  } catch { /* ignore */ }
}

async function search() {
  loading.value = true;
  try {
    const { data: res } = await axios.get("/api/admin/todos", {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        type: filter.type || undefined,
        priority: filter.priority || undefined,
        status: filter.status || undefined
      }
    });
    const data = res.data || res;
    list.value = data.records || data.list || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function toggleTypeFilter(type: string) {
  if (filter.type === type) {
    filter.type = "";
  } else {
    filter.type = type;
  }
  page.value = 1;
  search();
}

async function loadData() {
  await Promise.all([search(), loadStats()]);
}

async function handleComplete(row: any) {
  try {
    await ElMessageBox.confirm("确认完成该待办？", "提示", { type: "info" });
    await axios.put(`/api/admin/todos/${row.id}/complete`);
    ElMessage.success("已完成");
    await loadData();
  } catch { /* cancelled */ }
}

async function handleDismiss(row: any) {
  try {
    await ElMessageBox.confirm("确认忽略该待办？", "提示", { type: "info" });
    await axios.put(`/api/admin/todos/${row.id}/dismiss`);
    ElMessage.success("已忽略");
    await loadData();
  } catch { /* cancelled */ }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确认删除该待办？", "提示", { type: "warning" });
    await axios.delete(`/api/admin/todos/${row.id}`);
    ElMessage.success("删除成功");
    await loadData();
  } catch { /* cancelled */ }
}

function handleNavigate(row: any) {
  if (row.linkUrl) {
    window.open(row.linkUrl, "_blank");
  } else {
    ElMessage.info("暂无关联链接");
  }
}

// 新建待办
const dialogVisible = ref(false);
const submitLoading = ref(false);
const formRef = ref();
const form = reactive({
  title: "",
  type: "",
  priority: "MEDIUM",
  dueDate: "",
  remark: ""
});

function openCreateDialog() {
  form.title = "";
  form.type = "";
  form.priority = "MEDIUM";
  form.dueDate = "";
  form.remark = "";
  dialogVisible.value = true;
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    await axios.post("/api/admin/todos", {
      title: form.title,
      type: form.type,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      remark: form.remark || undefined
    });
    ElMessage.success("创建成功");
    dialogVisible.value = false;
    await loadData();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "创建失败");
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 0; }

.stat-row {
  margin-bottom: 16px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  border-left: 4px solid var(--color-primary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.stat-card:hover {
  box-shadow: 0 4px 20px rgba(31, 35, 40, 0.12);
  transform: translateY(-1px);
}
.stat-card.active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.stat-card-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-card-label {
  font-size: var(--text-caption);
  color: var(--text-muted);
  margin-top: 4px;
}

.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.overdue {
  color: #EF4444;
  font-weight: 600;
}
</style>