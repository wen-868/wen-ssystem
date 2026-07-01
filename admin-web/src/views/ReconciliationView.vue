<template>
  <div class="page">
    <PageCard title="对账中心">
      <el-tabs v-model="activeTab" @tab-change="loadData">
        <!-- 客户对账 -->
        <el-tab-pane label="客户对账" name="customer">
          <div class="search-bar">
            <el-select v-model="customerFilters.entityId" placeholder="客户" clearable filterable style="width: 180px">
              <el-option v-for="m in memberList" :key="m.id" :label="m.name" :value="m.id" />
            </el-select>
            <el-select v-model="customerFilters.status" placeholder="状态" clearable style="width: 140px">
              <el-option label="待确认" value="PENDING" />
              <el-option label="已确认" value="CONFIRMED" />
            </el-select>
            <el-date-picker
              v-model="customerFilters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 260px"
            />
            <el-button type="primary" @click="loadData">查询</el-button>
            <el-button @click="openGenerate">生成对账单</el-button>
            <el-button @click="exportReconciliation">导出</el-button>
          </div>

          <el-table :data="customerReconciliations" v-loading="loading" stripe>
            <el-table-column prop="entityName" label="客户" min-width="140" />
            <el-table-column label="期初余额" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.openingBalance) }}
              </template>
            </el-table-column>
            <el-table-column label="本期应收" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.periodAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="本期收款" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.periodPayment) }}
              </template>
            </el-table-column>
            <el-table-column label="期末余额" width="140" align="right">
              <template #default="{ row }">
                <span :style="{ color: (row.closingBalance || 0) > 0 ? '#f56c6c' : '#67c23a' }">
                  {{ formatYuan(row.closingBalance) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
                <el-tag v-else-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openDetail(row)">查看详情</el-button>
                <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleConfirm(row)">确认对账</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 供应商对账 -->
        <el-tab-pane label="供应商对账" name="supplier">
          <div class="search-bar">
            <el-select v-model="supplierFilters.entityId" placeholder="供应商" clearable filterable style="width: 180px">
              <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
            <el-select v-model="supplierFilters.status" placeholder="状态" clearable style="width: 140px">
              <el-option label="待确认" value="PENDING" />
              <el-option label="已确认" value="CONFIRMED" />
            </el-select>
            <el-date-picker
              v-model="supplierFilters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 260px"
            />
            <el-button type="primary" @click="loadData">查询</el-button>
            <el-button @click="openGenerate">生成对账单</el-button>
            <el-button @click="exportReconciliation">导出</el-button>
          </div>

          <el-table :data="supplierReconciliations" v-loading="loading" stripe>
            <el-table-column prop="entityName" label="供应商" min-width="140" />
            <el-table-column label="期初余额" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.openingBalance) }}
              </template>
            </el-table-column>
            <el-table-column label="本期应付" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.periodAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="本期付款" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.periodPayment) }}
              </template>
            </el-table-column>
            <el-table-column label="期末余额" width="140" align="right">
              <template #default="{ row }">
                <span :style="{ color: (row.closingBalance || 0) > 0 ? '#f56c6c' : '#67c23a' }">
                  {{ formatYuan(row.closingBalance) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
                <el-tag v-else-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openDetail(row)">查看详情</el-button>
                <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleConfirm(row)">确认对账</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 生成对账单弹窗 -->
    <el-dialog v-model="generateVisible" title="生成对账单" width="450px">
      <el-form ref="generateFormRef" :model="generateForm" :rules="generateRules" label-width="100px">
        <el-form-item :label="activeTab === 'customer' ? '客户' : '供应商'" prop="entityId">
          <el-select v-model="generateForm.entityId" filterable placeholder="请选择" style="width: 100%">
            <el-option
              v-for="item in (activeTab === 'customer' ? memberList : supplierList)"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="对账期间" prop="period">
          <el-date-picker
            v-model="generateForm.period"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateLoading" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="对账详情" width="750px">
      <el-descriptions v-if="detail" :column="2" border style="margin-bottom: 16px">
        <el-descriptions-item :label="activeTab === 'customer' ? '客户' : '供应商'">{{ detail.entityName }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="detail.status === 'PENDING'" type="warning">待确认</el-tag>
          <el-tag v-else-if="detail.status === 'CONFIRMED'" type="success">已确认</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="期初余额">{{ formatYuan(detail.openingBalance) }}</el-descriptions-item>
        <el-descriptions-item label="期末余额">{{ formatYuan(detail.closingBalance) }}</el-descriptions-item>
      </el-descriptions>

      <el-table :data="detailItems" stripe max-height="350" show-summary :summary-method="getSummary">
        <el-table-column prop="date" label="日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column prop="billNo" label="单据号" width="180" />
        <el-table-column prop="summary" label="摘要" min-width="140" />
        <el-table-column label="应收/应付" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.debitAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="收款/付款" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.creditAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="余额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.balance) }}
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detail?.status === 'PENDING'" type="success" @click="handleConfirmFromDetail">确认对账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatYuan } from "../utils/format";
import {
  fetchCustomerReconciliation, fetchCustomerReconciliationDetail, confirmCustomerReconciliation,
  fetchSupplierReconciliation, fetchSupplierReconciliationDetail, confirmSupplierReconciliation,
  generateReconciliation, fetchMembers, fetchSuppliers
} from "../api";

const activeTab = ref("customer");
const loading = ref(false);

const memberList = ref<any[]>([]);
const supplierList = ref<any[]>([]);

const customerReconciliations = ref<any[]>([]);
const supplierReconciliations = ref<any[]>([]);

const customerFilters = reactive({
  entityId: null as number | null,
  status: "" as string,
  dateRange: null as [Date, Date] | null
});

const supplierFilters = reactive({
  entityId: null as number | null,
  status: "" as string,
  dateRange: null as [Date, Date] | null
});

const generateVisible = ref(false);
const generateFormRef = ref();
const generateLoading = ref(false);
const generateForm = reactive({
  entityId: null as number | null,
  period: null as [Date, Date] | null
});

const generateRules = {
  entityId: [{ required: true, message: "请选择", trigger: "change" }],
  period: [{ required: true, message: "请选择对账期间", trigger: "change" }]
};

const detailVisible = ref(false);
const detail = ref<any>(null);
const detailItems = ref<any[]>([]);

function getDateParams(filters: any) {
  const params: any = {};
  if (filters.entityId) params.entityId = filters.entityId;
  if (filters.status) params.status = filters.status;
  if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    params.dateStart = formatDateOnly(filters.dateRange[0]);
    params.dateEnd = formatDateOnly(filters.dateRange[1]);
  }
  return params;
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [start, end];
}

async function loadData() {
  loading.value = true;
  try {
    if (activeTab.value === "customer") {
      const res = await fetchCustomerReconciliation(getDateParams(customerFilters));
      customerReconciliations.value = res?.records || res?.list || [];
    } else {
      const res = await fetchSupplierReconciliation(getDateParams(supplierFilters));
      supplierReconciliations.value = res?.records || res?.list || [];
    }
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

async function loadMembers() {
  try {
    const res = await fetchMembers();
    memberList.value = res?.records || res?.list || [];
  } catch { /* ignore */ }
}

async function loadSuppliers() {
  try {
    const res = await fetchSuppliers();
    supplierList.value = res?.records || res?.list || [];
  } catch { /* ignore */ }
}

function openGenerate() {
  generateForm.entityId = null;
  generateForm.period = getDefaultMonthRange();
  generateVisible.value = true;
}

async function handleGenerate() {
  const valid = await generateFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  generateLoading.value = true;
  try {
    const period = generateForm.period!;
    await generateReconciliation({
      reconType: activeTab.value === "customer" ? "CUSTOMER" : "SUPPLIER",
      entityId: generateForm.entityId || 0,
      periodStart: formatDateOnly(period[0]),
      periodEnd: formatDateOnly(period[1])
    });
    ElMessage.success("对账单生成成功");
    generateVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("生成失败");
  } finally {
    generateLoading.value = false;
  }
}

async function openDetail(row: any) {
  try {
    if (activeTab.value === "customer") {
      detail.value = await fetchCustomerReconciliationDetail(row.id);
      detailItems.value = detail.value?.items || detail.value?.details || [];
    } else {
      detail.value = await fetchSupplierReconciliationDetail(row.id);
      detailItems.value = detail.value?.items || detail.value?.details || [];
    }
    detailVisible.value = true;
  } catch {
    ElMessage.error("加载详情失败");
  }
}

async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm("确认对账结果？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    if (activeTab.value === "customer") {
      await confirmCustomerReconciliation(row.id);
    } else {
      await confirmSupplierReconciliation(row.id);
    }
    ElMessage.success("对账已确认");
    await loadData();
  } catch { /* cancelled */ }
}

async function handleConfirmFromDetail() {
  try {
    await ElMessageBox.confirm("确认对账结果？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    if (activeTab.value === "customer") {
      await confirmCustomerReconciliation(detail.value.id);
    } else {
      await confirmSupplierReconciliation(detail.value.id);
    }
    ElMessage.success("对账已确认");
    detailVisible.value = false;
    await loadData();
  } catch { /* cancelled */ }
}

function exportReconciliation() {
  ElMessage.info("导出功能开发中");
}

function getSummary(param: { columns: any[]; data: any[] }) {
  const sums: string[] = [];
  const { columns, data } = param;
  columns.forEach((col: any, index: number) => {
    if (index === 0) {
      sums[index] = "合计";
    } else if (["debitAmount", "creditAmount", "balance"].includes(col.property)) {
      const total = data.reduce((acc: number, row: any) => acc + (Number(row[col.property]) || 0), 0);
      sums[index] = formatYuan(total);
    } else {
      sums[index] = "";
    }
  });
  return sums;
}

onMounted(() => {
  customerFilters.dateRange = getDefaultMonthRange();
  supplierFilters.dateRange = getDefaultMonthRange();
  loadData();
  loadMembers();
  loadSuppliers();
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
</style>