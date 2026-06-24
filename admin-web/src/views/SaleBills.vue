<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>销售单</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索销售单号/客户"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadSaleBills"
              @keyup.enter="loadSaleBills"
            />
            <el-select v-model="payStatus" placeholder="收款状态" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadSaleBills">
              <el-option label="未收款" value="UNPAID" />
              <el-option label="部分收款" value="PARTIAL" />
              <el-option label="已结清" value="PAID" />
            </el-select>
            <el-select v-model="fulfillStatus" placeholder="履约状态" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadSaleBills">
              <el-option label="待发货" value="PENDING" />
              <el-option label="部分发货" value="PARTIAL" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-button @click="loadSaleBills">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="saleBills" v-loading="loading" stripe>
        <el-table-column prop="billNo" label="销售单号" width="200" />
        <el-table-column prop="customerName" label="客户" min-width="140" />
        <el-table-column prop="receivableAmount" label="应收" width="120">
          <template #default="{ row }">¥{{ Number(row.receivableAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="receivedAmount" label="已收" width="120">
          <template #default="{ row }">¥{{ Number(row.receivedAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="unpaidAmount" label="未收" width="120">
          <template #default="{ row }">
            <span :class="{ 'unpaid-text': row.unpaidAmount > 0 }">
              ¥{{ Number(row.unpaidAmount || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="payStatus" label="收款状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.payStatus === 'UNPAID'" type="danger">未收款</el-tag>
            <el-tag v-else-if="row.payStatus === 'PARTIAL'" type="warning">部分收款</el-tag>
            <el-tag v-else-if="row.payStatus === 'PAID'" type="success">已结清</el-tag>
            <el-tag v-else>{{ row.payStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fulfillStatus" label="履约状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.fulfillStatus === 'PENDING'" type="warning">待发货</el-tag>
            <el-tag v-else-if="row.fulfillStatus === 'PARTIAL'" type="primary">部分发货</el-tag>
            <el-tag v-else-if="row.fulfillStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="row.fulfillStatus === 'CANCELLED'" type="info">已取消</el-tag>
            <el-tag v-else>{{ row.fulfillStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
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

    <el-drawer v-model="detailVisible" title="销售单详情" size="600px">
      <template v-if="currentBill">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="销售单号">{{ currentBill.billNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentBill.customerName }}</el-descriptions-item>
          <el-descriptions-item label="应收金额">¥{{ Number(currentBill.receivableAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="已收金额">¥{{ Number(currentBill.receivedAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="未收金额">
            <span class="unpaid-text">¥{{ Number(currentBill.unpaidAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="收款状态">
            <el-tag v-if="currentBill.payStatus === 'UNPAID'" type="danger">未收款</el-tag>
            <el-tag v-else-if="currentBill.payStatus === 'PARTIAL'" type="warning">部分收款</el-tag>
            <el-tag v-else-if="currentBill.payStatus === 'PAID'" type="success">已结清</el-tag>
            <el-tag v-else>{{ currentBill.payStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="履约状态">
            <el-tag v-if="currentBill.fulfillStatus === 'PENDING'" type="warning">待发货</el-tag>
            <el-tag v-else-if="currentBill.fulfillStatus === 'PARTIAL'" type="primary">部分发货</el-tag>
            <el-tag v-else-if="currentBill.fulfillStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ currentBill.fulfillStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentBill.createTime }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentBill.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品明细</h4>
        <el-table :data="currentBill.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="skuCode" label="SKU编码" width="140" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotalAmount" label="小计" width="100">
            <template #default="{ row }">¥{{ Number(row.subtotalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchSaleBills } from "../api";

const loading = ref(false);
const saleBills = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const payStatus = ref("");
const fulfillStatus = ref("");
const detailVisible = ref(false);
const currentBill = ref<any>(null);

async function loadSaleBills() {
  loading.value = true;
  try {
    const data = await fetchSaleBills();
    let list = Array.isArray(data) ? data : (data.records || []);
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.billNo && item.billNo.toLowerCase().includes(kw)) ||
        (item.customerName && item.customerName.toLowerCase().includes(kw))
      );
    }
    if (payStatus.value) {
      list = list.filter((item: any) => item.payStatus === payStatus.value);
    }
    if (fulfillStatus.value) {
      list = list.filter((item: any) => item.fulfillStatus === fulfillStatus.value);
    }
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    saleBills.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadSaleBills();
}

function handlePageChange(p: number) {
  page.value = p;
  loadSaleBills();
}

function viewDetail(row: any) {
  currentBill.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  loadSaleBills();
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
.unpaid-text {
  color: #f56c6c;
  font-weight: 600;
}
</style>
