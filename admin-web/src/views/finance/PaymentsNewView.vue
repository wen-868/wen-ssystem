<template>
  <div class="page">
    <PageCard title="付款管理">
      <template #extra>
        <el-button type="primary" @click="openNewPayment">新增付款</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-select v-model="filters.supplierId" placeholder="供应商" clearable filterable style="width: 180px">
          <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 140px">
          <el-option label="采购付款" value="purchase" />
          <el-option label="费用付款" value="expense" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option label="待确认" value="PENDING" />
          <el-option label="已确认" value="CONFIRMED" />
          <el-option label="已作废" value="VOIDED" />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table :data="payments" v-loading="loading" stripe>
        <el-table-column prop="paymentNo" label="付款单号" width="180" />
        <el-table-column prop="supplierName" label="供应商" min-width="140" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" align="center" />
        <el-table-column prop="paymentMethod" label="付款方式" width="110" align="center" />
        <el-table-column label="日期" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
            <el-tag v-else-if="row.status === 'VOIDED'" type="info">已作废</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">查看详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="openWriteoff(row)">核销</el-button>
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

    <!-- 新增付款弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增付款" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="供应商" prop="supplierId">
          <el-select v-model="form.supplierId" filterable placeholder="选择供应商" style="width: 100%" @change="loadApBills">
            <el-option v-for="s in supplierList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="应付单据" prop="billIds">
          <el-select v-model="form.billIds" multiple filterable placeholder="选择应付单据" style="width: 100%">
            <el-option v-for="b in apBills" :key="b.id" :label="`${b.billNo} - ${formatYuan(b.amount)} (余额: ${formatYuan(b.balance)})`" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
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
        <el-form-item label="付款日期" prop="paymentDate">
          <el-date-picker v-model="form.paymentDate" type="date" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreate">确认</el-button>
      </template>
    </el-dialog>

    <!-- 核销弹窗 -->
    <el-dialog v-model="writeoffVisible" title="核销付款" width="650px">
      <div class="writeoff-info">
        <p>付款单号：{{ writeoffTarget?.paymentNo }}</p>
        <p>付款金额：{{ formatYuan(writeoffTarget?.amount) }}</p>
      </div>
      <el-table :data="writeoffBills" stripe max-height="300">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="billNo" label="单据号" width="160" />
        <el-table-column label="单据金额" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column label="已核销" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.writtenOffAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column label="本次核销" width="140" align="right">
          <template #default="{ row }">
            <el-input-number v-model="row.writeoffAmount" :min="0" :max="(row.amount || 0) - (row.writtenOffAmount || 0)" :precision="2" size="small" style="width: 120px" />
          </template>
        </el-table-column>
        <el-table-column label="余额" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan((row.amount || 0) - (row.writtenOffAmount || 0) - (row.writeoffAmount || 0)) }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="writeoffVisible = false">取消</el-button>
        <el-button type="primary" :loading="writeoffLoading" @click="handleWriteoff">确认核销</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="付款详情" width="720px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="付款单号">{{ detail.paymentNo }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ detail.supplierName }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ formatYuan(detail.amount) }}</el-descriptions-item>
        <el-descriptions-item label="付款方式">{{ detail.paymentMethod }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="detail.status === 'PENDING'" type="warning">待确认</el-tag>
          <el-tag v-else-if="detail.status === 'CONFIRMED'" type="success">已确认</el-tag>
          <el-tag v-else-if="detail.status === 'VOIDED'" type="info">已作废</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="日期">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="detail?.writeoffDetails?.length" style="margin-top: 16px">
        <h4 style="margin-bottom: 8px">核销明细</h4>
        <el-table :data="detail.writeoffDetails" size="small" stripe>
          <el-table-column prop="billNo" label="单据号" width="160" />
          <el-table-column label="单据金额" width="120" align="right">
            <template #default="{ row }">
              {{ formatYuan(row.billAmount) }}
            </template>
          </el-table-column>
          <el-table-column label="核销金额" width="120" align="right">
            <template #default="{ row }">
              {{ formatYuan(row.writeoffAmount) }}
            </template>
          </el-table-column>
          <el-table-column prop="writeoffDate" label="核销日期" width="140">
            <template #default="{ row }">
              {{ formatDate(row.writeoffDate) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate, formatYuan } from "../../utils/format";
import { fetchPaymentsNew, createPaymentNew, getPaymentDetail, writeoffPayment, voidPayment, fetchSuppliers } from "../../api";

const payments = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const supplierList = ref<any[]>([]);

const filters = reactive({
  supplierId: null as number | null,
  type: "" as string,
  dateRange: null as [Date, Date] | null,
  status: "" as string
});

const dialogVisible = ref(false);
const formRef = ref();
const submitLoading = ref(false);
const form = reactive({
  supplierId: null as number | null,
  billIds: [] as number[],
  amount: 0,
  paymentMethod: "BANK_TRANSFER",
  bankAccount: "",
  paymentDate: new Date()
});

const rules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }]
};

const apBills = ref<any[]>([]);

const writeoffVisible = ref(false);
const writeoffTarget = ref<any>(null);
const writeoffBills = ref<any[]>([]);
const writeoffLoading = ref(false);

const detailVisible = ref(false);
const detail = ref<any>(null);

async function loadData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.supplierId) params.supplierId = filters.supplierId;
    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      params.dateStart = formatDateOnly(filters.dateRange[0]);
      params.dateEnd = formatDateOnly(filters.dateRange[1]);
    }
    const res = await fetchPaymentsNew(params);
    payments.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error("加载付款列表失败");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    const res = await fetchSuppliers();
    supplierList.value = res?.records || res?.list || [];
  } catch { /* ignore */ }
}

async function loadApBills() {
  apBills.value = [];
  if (!form.supplierId) return;
  try {
    const res = await getPaymentDetail(0);
    apBills.value = res?.apBills || [];
  } catch { /* ignore */ }
}

function resetFilters() {
  filters.supplierId = null;
  filters.dateRange = null;
  filters.type = "";
  filters.status = "";
  loadData();
}

function openNewPayment() {
  form.supplierId = null;
  form.billIds = [];
  form.amount = 0;
  form.paymentMethod = "BANK_TRANSFER";
  form.bankAccount = "";
  form.paymentDate = new Date();
  apBills.value = [];
  dialogVisible.value = true;
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    await createPaymentNew({
      supplierId: form.supplierId || 0,
      amount: form.amount,
      type: "PURCHASE",
      paymentMethod: form.paymentMethod,
      bankAccount: form.bankAccount,
      date: formatDateOnly(form.paymentDate)
    });
    ElMessage.success("付款创建成功");
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("创建失败");
  } finally {
    submitLoading.value = false;
  }
}

async function openWriteoff(row: any) {
  writeoffTarget.value = row;
  writeoffVisible.value = true;
  try {
    const res = await getPaymentDetail(row.id);
    const bills = res?.apBills || res?.writeoffBills || [];
    writeoffBills.value = bills.map((b: any) => ({ ...b, writeoffAmount: 0 }));
  } catch {
    writeoffBills.value = [];
  }
}

async function handleWriteoff() {
  writeoffLoading.value = true;
  try {
    const details = writeoffBills.value
      .filter((b: any) => b.writeoffAmount > 0)
      .map((b: any) => ({ billId: b.id, billNo: b.billNo, amount: b.writeoffAmount }));
    if (details.length === 0) {
      ElMessage.warning("请选择至少一笔核销");
      writeoffLoading.value = false;
      return;
    }
    await writeoffPayment(writeoffTarget.value.id, { billIds: details.map((d: any) => d.billId), amounts: details.map((d: any) => d.amount) });
    ElMessage.success("核销成功");
    writeoffVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("核销失败");
  } finally {
    writeoffLoading.value = false;
  }
}

async function handleVoid(row: any) {
  try {
    await ElMessageBox.confirm("确认作废该付款单？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await voidPayment(row.id);
    ElMessage.success("已作废");
    await loadData();
  } catch { /* cancelled */ }
}

async function openDetail(row: any) {
  try {
    detail.value = await getPaymentDetail(row.id);
    detailVisible.value = true;
  } catch {
    ElMessage.error("加载详情失败");
  }
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

onMounted(() => {
  loadData();
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

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.writeoff-info {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.writeoff-info p {
  margin: 4px 0;
}
</style>