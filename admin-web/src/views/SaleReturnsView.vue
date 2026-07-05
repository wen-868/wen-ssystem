<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>销售退货</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索退货单号/客户"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadReturns"
              @keyup.enter="loadReturns"
            />
            <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadReturns">
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已拒绝" value="REJECTED" />
              <el-option label="已完成" value="COMPLETED" />
            </el-select>
            <el-button @click="loadReturns">搜索</el-button>
            <el-button type="primary" @click="dialogVisible = true">新增退货</el-button>
            <el-button @click="loadReturns">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="returns" v-loading="loading" stripe>
        <el-table-column prop="returnNo" label="退货单号" width="200" />
        <el-table-column prop="saleBillNo" label="关联销售单" width="200" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="type" label="退货类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'FULL'" type="warning">全额退货</el-tag>
            <el-tag v-else-if="row.type === 'PARTIAL'" type="primary">部分退货</el-tag>
            <el-tag v-else>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退货金额" width="120">
          <template #default="{ row }">
            <span class="return-amount">-¥{{ Number(row.returnAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.status === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="row.status === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="approveReturn(row)">通过</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="rejectReturn(row)">拒绝</el-button>
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
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增销售退货" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="关联销售单" prop="saleBillNo">
          <el-input v-model="form.saleBillNo" placeholder="请输入销售单号" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="form.customerName" />
        </el-form-item>
        <el-form-item label="退货类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="全额退货" value="FULL" />
            <el-option label="部分退货" value="PARTIAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="退货金额">
          <el-input-number v-model="form.returnAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="退货原因">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入退货原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="退货详情" size="500px">
      <template v-if="currentReturn">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="退货单号">{{ currentReturn.returnNo }}</el-descriptions-item>
          <el-descriptions-item label="关联销售单">{{ currentReturn.saleBillNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentReturn.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="退货类型">
            <el-tag v-if="currentReturn.type === 'FULL'" type="warning">全额退货</el-tag>
            <el-tag v-else-if="currentReturn.type === 'PARTIAL'" type="primary">部分退货</el-tag>
            <el-tag v-else>{{ currentReturn.type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="退货金额">
            <span class="return-amount">-¥{{ Number(currentReturn.returnAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentReturn.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="currentReturn.status === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="currentReturn.status === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="currentReturn.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ currentReturn.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="退货原因">{{ currentReturn.reason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentReturn.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">退货商品</h4>
        <el-table :data="currentReturn.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="120">
            <template #default="{ row }">-¥{{ Number(row.subtotal || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { createSaleReturn, fetchSaleReturns } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const returns = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentReturn = ref<any>(null);

const form = reactive({
  saleBillNo: "",
  customerName: "",
  type: "PARTIAL",
  returnAmount: 0,
  reason: ""
});

const formRef = ref()
const rules = {
  saleBillNo: [{ required: true, message: '请填写关联销售单号', trigger: 'blur' }]
}

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadReturns() {
  loading.value = true;
  try {
    const data = await fetchSaleReturns({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    returns.value = data.records || [];
    total.value = data.total || returns.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载退货列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadReturns();
}

function handlePageChange(p: number) {
  page.value = p;
  loadReturns();
}

function viewDetail(row: any) {
  currentReturn.value = row;
  detailVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (!form.saleBillNo) {
    ElMessage.warning("请填写关联销售单号");
    return;
  }
  if (form.returnAmount <= 0) {
    ElMessage.warning("退货金额必须大于 0");
    return;
  }
  submitLoading.value = true;
  try {
    await createSaleReturn(form);
    ElMessage.success("退货申请已提交");
    dialogVisible.value = false;
    form.saleBillNo = "";
    form.customerName = "";
    form.type = "PARTIAL";
    form.returnAmount = 0;
    form.reason = "";
    loadReturns();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "提交失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function approveReturn(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认通过退货单 ${row.returnNo}?`, "确认通过", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  ElMessage.success("已通过");
  loadReturns();
}

async function rejectReturn(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认拒绝退货单 ${row.returnNo}?`, "确认拒绝", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  ElMessage.success("已拒绝");
  loadReturns();
}

onMounted(() => {
  loadReturns();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.return-amount {
  color: #f56c6c;
  font-weight: 600;
}
</style>
