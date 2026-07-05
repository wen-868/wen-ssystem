<template>
  <div class="page">
    <PageCard title="供应商对账">
      <template #extra>
        <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px" clearable @change="loadList">
          <el-option label="待确认" value="GENERATED" />
          <el-option label="已确认" value="CONFIRMED" />
          <el-option label="争议" value="DISPUTED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showGenerateDialog">生成对账单</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
      >
        <template #purchaseAmount="{ row }">¥{{ Number(row.purchaseAmount || 0).toFixed(2) }}</template>
        <template #paidAmount="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
        <template #returnAmount="{ row }">¥{{ Number(row.returnAmount || 0).toFixed(2) }}</template>
        <template #balance="{ row }">
          <span :class="{ 'balance-positive': Number(row.balance) > 0, 'balance-negative': Number(row.balance) < 0 }">
            ¥{{ Number(row.balance || 0).toFixed(2) }}
          </span>
        </template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'GENERATED'" type="warning">待确认</el-tag>
          <el-tag v-else-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
          <el-tag v-else-if="row.status === 'DISPUTED'" type="danger">争议</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          <el-button v-if="row.status !== 'CONFIRMED'" size="small" link type="success" @click="handleConfirm(row)">确认</el-button>
          <el-button v-if="row.status !== 'CONFIRMED'" size="small" link type="danger" @click="handleDispute(row)">争议</el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 生成对账单弹窗 -->
    <el-dialog v-model="genVisible" title="生成对账单" width="450px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="genForm" :rules="rules" label-width="100px">
        <el-form-item label="供应商" prop="supplierId">
          <el-select v-model="genForm.supplierId" filterable placeholder="请选择供应商" style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="对账期间">
          <el-date-picker
            v-model="genForm.dateRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 对账单详情抽屉 -->
    <DetailDrawer v-model="detailVisible" title="对账单详情" width="600px">
      <template v-if="currentDetail">
        <!-- 汇总卡片 -->
        <div class="summary-row">
          <div class="summary-card">
            <div class="summary-label">采购总额</div>
            <div class="summary-value">¥{{ Number(currentDetail.purchaseAmount || 0).toFixed(2) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">已付总额</div>
            <div class="summary-value green">¥{{ Number(currentDetail.paidAmount || 0).toFixed(2) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">退货总额</div>
            <div class="summary-value orange">¥{{ Number(currentDetail.returnAmount || 0).toFixed(2) }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">应付余额</div>
            <div class="summary-value" :class="Number(currentDetail.balance) > 0 ? 'red' : ''">
              ¥{{ Number(currentDetail.balance || 0).toFixed(2) }}
            </div>
          </div>
        </div>

        <el-descriptions :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="对账单号">{{ currentDetail.statementNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentDetail.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="期间">{{ currentDetail.periodStart }} ~ {{ currentDetail.periodEnd }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentDetail.status === 'GENERATED'" type="warning">待确认</el-tag>
            <el-tag v-else-if="currentDetail.status === 'CONFIRMED'" type="success">已确认</el-tag>
            <el-tag v-else-if="currentDetail.status === 'DISPUTED'" type="danger">争议</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-bottom: 10px">明细列表</h4>
        <el-table :data="currentDetail.items || []" size="small" border>
          <el-table-column prop="sourceNo" label="单号" width="180" />
          <el-table-column prop="itemType" label="类型" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.itemType === 'PURCHASE'" type="primary" size="small">采购</el-tag>
              <el-tag v-else-if="row.itemType === 'PAYMENT'" type="success" size="small">付款</el-tag>
              <el-tag v-else-if="row.itemType === 'RETURN'" type="danger" size="small">退货</el-tag>
              <el-tag v-else size="small">{{ row.itemType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="occurredAt" label="发生时间" width="150" />
        </el-table>
      </template>
    </DetailDrawer>

    <!-- 争议原因弹窗 -->
    <el-dialog v-model="disputeVisible" title="填写争议原因" width="400px" :close-on-click-modal="false">
      <el-input v-model="disputeReason" type="textarea" :rows="3" placeholder="请描述争议原因" />
      <template #footer>
        <el-button @click="disputeVisible = false">取消</el-button>
        <el-button type="primary" :loading="disputeLoading" @click="handleDisputeSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchSupplierStatements, generateSupplierStatement, fetchSupplierStatementDetail, confirmSupplierStatement, disputeSupplierStatement, fetchSuppliers } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";
import DetailDrawer from "../components/DetailDrawer.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref("");

const suppliers = ref<any[]>([]);

const genVisible = ref(false);
const genLoading = ref(false);
const formRef = ref();
const rules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }]
};
const genForm = ref({ supplierId: null as number | null, dateRange: null as [string, string] | null });

const detailVisible = ref(false);
const currentDetail = ref<any>(null);

const disputeVisible = ref(false);
const disputeLoading = ref(false);
const disputeReason = ref("");
const disputeId = ref<number | null>(null);

const columns = [
  { prop: "statementNo", label: "对账单号", width: 180 },
  { prop: "supplierName", label: "供应商", minWidth: 140 },
  { prop: "periodStart", label: "开始", width: 110 },
  { prop: "periodEnd", label: "结束", width: 110 },
  { prop: "purchaseAmount", label: "采购金额", width: 110, slot: "purchaseAmount" },
  { prop: "paidAmount", label: "已付金额", width: 110, slot: "paidAmount" },
  { prop: "returnAmount", label: "退货金额", width: 110, slot: "returnAmount" },
  { prop: "balance", label: "余额", width: 110, slot: "balance" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { label: "操作", width: 160, fixed: "right", slot: "actions" }
];

async function loadSuppliers() {
  try {
    const data = await fetchSuppliers();
    suppliers.value = (Array.isArray(data) ? data : (data.records || [])).map((s: any) => ({ id: s.id, name: s.name || s.supplierName }));
  } catch { /* ignore */ }
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchSupplierStatements({ page: page.value, pageSize: pageSize.value, status: statusFilter.value || undefined });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function showGenerateDialog() {
  genForm.value = { supplierId: null, dateRange: null };
  loadSuppliers();
  genVisible.value = true;
}

async function handleGenerate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!genForm.value.supplierId) { ElMessage.warning("请选择供应商"); return; }
  if (!genForm.value.dateRange || !genForm.value.dateRange[0] || !genForm.value.dateRange[1]) {
    ElMessage.warning("请选择对账期间"); return;
  }
  genLoading.value = true;
  try {
    const supplier = suppliers.value.find((s: any) => s.id === genForm.value.supplierId);
    await generateSupplierStatement({
      supplierId: genForm.value.supplierId,
      supplierName: supplier?.name || "",
      periodStart: genForm.value.dateRange[0],
      periodEnd: genForm.value.dateRange[1]
    });
    ElMessage.success("对账单生成成功");
    genVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "生成失败");
  } finally {
    genLoading.value = false;
  }
}

async function viewDetail(row: any) {
  try {
    const data = await fetchSupplierStatementDetail(row.id);
    currentDetail.value = data;
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  }
}

async function handleConfirm(row: any) {
  try { await ElMessageBox.confirm("确认此对账单数据无误？", "确认对账", { type: "warning" }); } catch { return; }
  try {
    await confirmSupplierStatement(row.id);
    ElMessage.success("对账已确认");
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "确认失败");
  }
}

function handleDispute(row: any) {
  disputeId.value = row.id;
  disputeReason.value = "";
  disputeVisible.value = true;
}

async function handleDisputeSubmit() {
  disputeLoading.value = true;
  try {
    await disputeSupplierStatement(disputeId.value!, { reason: disputeReason.value });
    ElMessage.success("已标记争议");
    disputeVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "操作失败");
  } finally {
    disputeLoading.value = false;
  }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.page { padding: 0; }
.summary-row { display: flex; gap: 12px; margin-bottom: 16px; }
.summary-card { flex: 1; background: #f5f7fa; border-radius: 8px; padding: 12px; text-align: center; }
.summary-label { font-size: 12px; color: #909399; }
.summary-value { font-size: 20px; font-weight: 700; color: #303133; margin-top: 4px; }
.summary-value.green { color: #67c23a; }
.summary-value.orange { color: #e6a23c; }
.summary-value.red { color: #f56c6c; }
.balance-positive { color: #e6a23c; font-weight: 600; }
.balance-negative { color: #67c23a; font-weight: 600; }
</style>