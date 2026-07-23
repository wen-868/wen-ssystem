<template>
  <div class="page">
    <PageCard title="费用管理">
      <template #extra>
        <el-button type="primary" @click="openNewExpense">新增费用</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-select v-model="filters.expenseType" placeholder="类型" clearable style="width: 140px">
          <el-option label="日常费用" value="daily" />
          <el-option label="差旅费" value="travel" />
          <el-option label="办公费" value="office" />
          <el-option label="交通费" value="transport" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-input v-model="filters.category" placeholder="分类" clearable style="width: 140px" />
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option label="待审批" value="PENDING" />
          <el-option label="已审批" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
          <el-option label="已作废" value="VOIDED" />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table :data="expenses" v-loading="loading" stripe>
        <el-table-column prop="expenseNo" label="费用单号" width="180" />
        <el-table-column prop="expenseType" label="类型" width="100" align="center" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column prop="payee" label="收款方" min-width="140" />
        <el-table-column label="日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expenseDate) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待审批</el-tag>
            <el-tag v-else-if="row.status === 'APPROVED'" type="success">已审批</el-tag>
            <el-tag v-else-if="row.status === 'REJECTED'" type="danger">已驳回</el-tag>
            <el-tag v-else-if="row.status === 'VOIDED'" type="info">已作废</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="openApprove(row)">审批</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="handleVoid(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="(s: number) => { pageSize = s; loadData(); }"
          @current-change="(p: number) => { page = p; loadData(); }"
        />
      </div>
    </PageCard>

    <!-- 汇总图表 -->
    <PageCard title="费用汇总">
      <div class="chart-row">
        <div class="chart-card half">
          <div class="chart-header">
            <span class="chart-title">月度费用趋势</span>
          </div>
          <div ref="barChartRef" class="chart-body"></div>
        </div>
        <div class="chart-card half">
          <div class="chart-header">
            <span class="chart-title">费用分类占比</span>
          </div>
          <div ref="pieChartRef" class="chart-body"></div>
        </div>
      </div>
    </PageCard>

    <!-- 新增费用弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增费用" width="550px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="费用类型" prop="expenseType">
          <el-select v-model="form.expenseType" style="width: 100%">
            <el-option label="日常费用" value="daily" />
            <el-option label="差旅费" value="travel" />
            <el-option label="办公费" value="office" />
            <el-option label="交通费" value="transport" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="form.category" placeholder="费用分类" />
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款方" prop="payee">
          <el-input v-model="form.payee" placeholder="收款方" />
        </el-form-item>
        <el-form-item label="付款方式" prop="paymentMethod">
          <el-select v-model="form.paymentMethod" style="width: 100%">
            <el-option label="现金" value="CASH" />
            <el-option label="银行转账" value="BANK_TRANSFER" />
            <el-option label="微信" value="WECHAT" />
            <el-option label="支付宝" value="ALIPAY" />
          </el-select>
        </el-form-item>
        <el-form-item label="银行账户" prop="bankAccount">
          <el-input v-model="form.bankAccount" placeholder="银行账户" />
        </el-form-item>
        <el-form-item label="发票号" prop="invoiceNo">
          <el-input v-model="form.invoiceNo" placeholder="发票号" />
        </el-form-item>
        <el-form-item label="费用日期" prop="expenseDate">
          <el-date-picker v-model="form.expenseDate" type="date" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreate">确认</el-button>
      </template>
    </el-dialog>

    <!-- 审批弹窗 -->
    <el-dialog v-model="approveVisible" title="审批费用" width="480px">
      <el-descriptions v-if="approveTarget" :column="1" border>
        <el-descriptions-item label="费用单号">{{ approveTarget.expenseNo }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ formatYuan(approveTarget.amount) }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ approveTarget.category }}</el-descriptions-item>
        <el-descriptions-item label="收款方">{{ approveTarget.payee }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">驳回</el-button>
        <el-button type="success" @click="handleApprove">通过</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatDate, formatYuan } from "../../utils/format";
import { fetchExpenses, createExpense, approveExpense, voidExpense, fetchExpenseSummary } from "../../api";

const expenses = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filters = reactive({
  expenseType: "" as string,
  category: "" as string,
  dateRange: null as [Date, Date] | null,
  status: "" as string
});

const dialogVisible = ref(false);
const formRef = ref();
const submitLoading = ref(false);
const form = reactive({
  expenseType: "daily",
  category: "",
  amount: 0,
  payee: "",
  paymentMethod: "BANK_TRANSFER",
  bankAccount: "",
  invoiceNo: "",
  expenseDate: new Date(),
  remark: ""
});

const rules = {
  expenseType: [{ required: true, message: "请选择类型", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  payee: [{ required: true, message: "请输入收款方", trigger: "blur" }]
};

const approveVisible = ref(false);
const approveTarget = ref<any>(null);

const barChartRef = ref<HTMLDivElement>();
const pieChartRef = ref<HTMLDivElement>();
let barInstance: echarts.ECharts | null = null;
let pieInstance: echarts.ECharts | null = null;

async function loadData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.expenseType) params.expenseType = filters.expenseType;
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      params.dateStart = formatDateOnly(filters.dateRange[0]);
      params.dateEnd = formatDateOnly(filters.dateRange[1]);
    }
    const res = await fetchExpenses(params);
    expenses.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error("加载费用列表失败");
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  try {
    const res = await fetchExpenseSummary();
    await nextTick();
    renderCharts(res);
  } catch { /* ignore */ }
}

function renderCharts(data: any) {
  renderBarChart(data?.monthly || []);
  renderPieChart(data?.byCategory || []);
}

function renderBarChart(data: any[]) {
  if (!barChartRef.value || !data.length) return;
  if (barInstance) barInstance.dispose();

  const months = data.map((d: any) => d.month || d.label || "");
  const values = data.map((d: any) => Number(d.amount) || 0);

  barInstance = echarts.init(barChartRef.value);
  barInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: months, axisLabel: { rotate: 30 } },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => formatYuan(v) } },
    series: [{
      type: "bar",
      data: values,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#409eff" },
          { offset: 1, color: "#a0cfff" }
        ])
      }
    }]
  });
}

function renderPieChart(data: any[]) {
  if (!pieChartRef.value || !data.length) return;
  if (pieInstance) pieInstance.dispose();

  pieInstance = echarts.init(pieChartRef.value);
  pieInstance.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0 },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      center: ["50%", "45%"],
      data: data.map((d: any) => ({
        name: d.category || d.name || "",
        value: Number(d.amount || d.value) || 0
      })),
      label: { show: true, formatter: "{b}\n{d}%" },
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 }
    }]
  });
}

function resetFilters() {
  filters.expenseType = "";
  filters.category = "";
  filters.dateRange = null;
  filters.status = "";
  loadData();
}

function openNewExpense() {
  form.expenseType = "daily";
  form.category = "";
  form.amount = 0;
  form.payee = "";
  form.paymentMethod = "BANK_TRANSFER";
  form.bankAccount = "";
  form.invoiceNo = "";
  form.expenseDate = new Date();
  form.remark = "";
  dialogVisible.value = true;
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    await createExpense({
      expenseType: form.expenseType,
      category: form.category,
      amount: form.amount,
      payee: form.payee,
      paymentMethod: form.paymentMethod,
      bankAccount: form.bankAccount,
      invoiceNo: form.invoiceNo,
      expenseDate: formatDateOnly(form.expenseDate),
      remark: form.remark
    });
    ElMessage.success("费用创建成功");
    dialogVisible.value = false;
    await loadData();
    await loadSummary();
  } catch {
    ElMessage.error("创建失败");
  } finally {
    submitLoading.value = false;
  }
}

function openApprove(row: any) {
  approveTarget.value = row;
  approveVisible.value = true;
}

async function handleApprove() {
  try {
    await approveExpense(approveTarget.value.id, true);
    ElMessage.success("审批通过");
    approveVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("审批失败");
  }
}

async function handleReject() {
  try {
    await ElMessageBox.confirm("确认驳回该费用申请？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await approveExpense(approveTarget.value.id, false);
    ElMessage.success("已驳回");
    approveVisible.value = false;
    await loadData();
  } catch { /* cancelled */ }
}

async function handleVoid(row: any) {
  try {
    await ElMessageBox.confirm("确认作废该费用单？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await voidExpense(row.id);
    ElMessage.success("已作废");
    await loadData();
  } catch { /* cancelled */ }
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

onMounted(() => {
  loadData();
  loadSummary();
  window.addEventListener("resize", loadSummary);
});
</script>

<style scoped>
.search-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.chart-row {
  display: flex;
  gap: 16px;
}

.chart-card {
  flex: 1;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
}

.chart-card.half {
  flex: 1;
  min-width: 0;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chart-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.chart-body {
  width: 100%;
  height: 320px;
}
</style>