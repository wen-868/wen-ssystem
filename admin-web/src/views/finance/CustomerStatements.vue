<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">客户对账</h2>
    <p class="page-desc">客户对账单查询与确认</p>
  </div>
</div>
<div class="filter-bar">
  <el-input
  v-model="keyword"
  placeholder="搜索对账单号/客户"
  size="default"
  style="width: 220px; margin-right: 10px"
  clearable
  @clear="loadStatements"
  @keyup.enter="loadStatements"
  />
  <el-select v-model="status" placeholder="全部状态" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadStatements">
  <el-option label="待确认" value="PENDING" />
  <el-option label="已确认" value="CONFIRMED" />
  <el-option label="已结算" value="SETTLED" />
  <el-option label="已作废" value="VOID" />
  </el-select>
  <el-button @click="loadStatements">刷新</el-button>
</div>


      <div class="table-card">
<el-table :data="statements" v-loading="loading" stripe>
        <el-table-column prop="statementNo" label="对账单号" width="200" />
        <el-table-column prop="customerName" label="客户" min-width="140" />
        <el-table-column prop="period" label="账期" width="140" />
        <el-table-column prop="openingBalance" label="期初余额" width="120">
          <template #default="{ row }">¥{{ Number(row.openingBalance || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="periodSales" label="本期销售" width="120">
          <template #default="{ row }">¥{{ Number(row.periodSales || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="periodReturns" label="本期退货" width="120">
          <template #default="{ row }">-¥{{ Number(row.periodReturns || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="periodReceipts" label="本期收款" width="120">
          <template #default="{ row }">-¥{{ Number(row.periodReceipts || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="closingBalance" label="期末余额" width="120">
          <template #default="{ row }">
            <span :class="{ 'balance-positive': row.closingBalance > 0, 'balance-negative': row.closingBalance < 0 }">
              ¥{{ Number(row.closingBalance || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="row.status === 'CONFIRMED'" type="primary">已确认</el-tag>
            <el-tag v-else-if="row.status === 'SETTLED'" type="success">已结算</el-tag>
            <el-tag v-else-if="row.status === 'VOID'" type="info">已作废</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
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
</div>
    

    <el-drawer v-model="detailVisible" title="对账单详情" size="600px">
      <template v-if="currentStatement">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="对账单号">{{ currentStatement.statementNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentStatement.customerName }}</el-descriptions-item>
          <el-descriptions-item label="账期">{{ currentStatement.period }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentStatement.status === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="currentStatement.status === 'CONFIRMED'" type="primary">已确认</el-tag>
            <el-tag v-else-if="currentStatement.status === 'SETTLED'" type="success">已结算</el-tag>
            <el-tag v-else>{{ currentStatement.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="期初余额">¥{{ Number(currentStatement.openingBalance || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="本期销售">¥{{ Number(currentStatement.periodSales || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="本期退货">-¥{{ Number(currentStatement.periodReturns || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="本期收款">-¥{{ Number(currentStatement.periodReceipts || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="期末余额" :span="2">
            <span class="balance-text">¥{{ Number(currentStatement.closingBalance || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentStatement.createTime }}</el-descriptions-item>
          <el-descriptions-item label="确认时间">{{ currentStatement.confirmTime || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">销售明细</h4>
        <el-table :data="currentStatement.saleItems || []" size="small" border>
          <el-table-column prop="billNo" label="单据号" width="180" />
          <el-table-column prop="billType" label="类型" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.billType === 'SALE'" type="primary">销售</el-tag>
              <el-tag v-else-if="row.billType === 'RETURN'" type="danger">退货</el-tag>
              <el-tag v-else>{{ row.billType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">
              {{ row.billType === 'RETURN' ? '-' : '' }}¥{{ Number(row.amount || 0).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="日期" width="160" />
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>

        <h4 style="margin: 20px 0 10px">收款明细</h4>
        <el-table :data="currentStatement.paymentItems || []" size="small" border>
          <el-table-column prop="paymentNo" label="收款单号" width="180" />
          <el-table-column prop="payMethod" label="方式" width="100" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">-¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="createTime" label="日期" width="160" />
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>
      </template>
    </el-drawer>
</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchCustomerStatements } from "../../api";

const loading = ref(false);
const statements = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const status = ref("");
const detailVisible = ref(false);
const currentStatement = ref<any>(null);

async function loadStatements() {
  loading.value = true;
  try {
    const data = await fetchCustomerStatements({
      page: page.value,
      pageSize: pageSize.value,
      status: status.value || undefined
    });
    let list = Array.isArray(data) ? data : (data.records || []);
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.statementNo && item.statementNo.toLowerCase().includes(kw)) ||
        (item.customerName && item.customerName.toLowerCase().includes(kw))
      );
    }
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    statements.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadStatements();
}

function handlePageChange(p: number) {
  page.value = p;
  loadStatements();
}

function viewDetail(row: any) {
  currentStatement.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  loadStatements();
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
.balance-positive {
  color: var(--color-danger);
  font-weight: 600;
}
.balance-negative {
  color: var(--color-success);
  font-weight: 600;
}
.balance-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-danger);
}
</style>
