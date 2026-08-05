<template>
  <div class="page">
    <PageCard title="销售单">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索销售单号/客户"
          size="default"
          style="width: 220px"
          clearable
          @clear="loadSaleBills"
          @keyup.enter="loadSaleBills"
        />
        <el-select v-model="payStatus" placeholder="收款状态" size="default" style="width: 140px" clearable @change="loadSaleBills">
          <el-option label="未收款" value="UNPAID" />
          <el-option label="已分享待支付" value="SHARED" />
          <el-option label="部分收款" value="PARTIAL" />
          <el-option label="已结清" value="PAID" />
          <el-option label="逾期" value="OVERDUE" />
        </el-select>
        <el-select v-model="fulfillStatus" placeholder="履约状态" size="default" style="width: 130px" clearable @change="loadSaleBills">
          <el-option label="待发货" value="PENDING" />
          <el-option label="部分发货" value="PARTIAL" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button @click="loadSaleBills">刷新</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="saleBills"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadSaleBills"
        @update:page-size="loadSaleBills"
      >
        <template #receivableAmount="{ row }">
          ¥{{ Number(row.receivableAmount || 0).toFixed(2) }}
        </template>

        <template #receivedAmount="{ row }">
          ¥{{ Number(row.receivedAmount || 0).toFixed(2) }}
        </template>

        <template #unpaidAmount="{ row }">
          <span :class="{ 'unpaid-text': row.unpaidAmount > 0 }">
            ¥{{ Number(row.unpaidAmount || 0).toFixed(2) }}
          </span>
        </template>

        <template #payStatus="{ row }">
          <el-tag v-if="row.payStatus === 'UNPAID'" type="danger">未收款</el-tag>
          <el-tag v-else-if="row.payStatus === 'SHARED'" type="primary">已分享待支付</el-tag>
          <el-tag v-else-if="row.payStatus === 'OVERDUE'" type="danger" effect="dark">逾期</el-tag>
          <el-tag v-else-if="row.payStatus === 'PARTIAL'" type="warning">部分收款</el-tag>
          <el-tag v-else-if="row.payStatus === 'PAID'" type="success">已结清</el-tag>
          <el-tag v-else>{{ row.payStatus }}</el-tag>
        </template>

        <template #shareInfo="{ row }">
          <span v-if="row.shareCollectionCount > 0" style="font-size:12px; color:#3F6FEF">
            已分享 {{ row.shareCollectionCount }} 次
          </span>
          <span v-else style="color:#CCCCCC">-</span>
        </template>

        <template #fulfillStatus="{ row }">
          <el-tag v-if="row.fulfillStatus === 'PENDING'" type="warning">待发货</el-tag>
          <el-tag v-else-if="row.fulfillStatus === 'PARTIAL'" type="primary">部分发货</el-tag>
          <el-tag v-else-if="row.fulfillStatus === 'COMPLETED'" type="success">已完成</el-tag>
          <el-tag v-else-if="row.fulfillStatus === 'CANCELLED'" type="info">已取消</el-tag>
          <el-tag v-else>{{ row.fulfillStatus }}</el-tag>
        </template>

        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
        </template>
      </DataTable>
    </PageCard>

    <DetailDrawer v-model="detailVisible" title="销售单详情" width="720px">
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
            <el-tag v-else-if="currentBill.payStatus === 'SHARED'" type="primary">已分享待支付</el-tag>
            <el-tag v-else-if="currentBill.payStatus === 'OVERDUE'" type="danger" effect="dark">逾期</el-tag>
            <el-tag v-else-if="currentBill.payStatus === 'PARTIAL'" type="warning">部分收款</el-tag>
            <el-tag v-else-if="currentBill.payStatus === 'PAID'" type="success">已结清</el-tag>
            <el-tag v-else>{{ currentBill.payStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="履约状态">
            <el-tag v-if="currentBill.fulfillStatus === 'PENDING'" type="warning">待发货</el-tag>
            <el-tag v-else-if="currentBill.fulfillStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ currentBill.fulfillStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentBill.createTime }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentBill.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 状态流转时间线 -->
        <h4 style="margin: 20px 0 10px">状态流转</h4>
        <el-timeline v-if="statusTimeline.length > 0" style="margin-left: 10px">
          <el-timeline-item
            v-for="item in statusTimeline"
            :key="item.time"
            :timestamp="item.time"
            :color="item.color"
            :type="item.type"
          >
            {{ item.label }}
          </el-timeline-item>
        </el-timeline>
        <div v-else style="color: #CCCCCC; font-size: 13px; padding-left: 10px">暂无状态流转记录</div>

        <!-- 分享记录 -->
        <h4 style="margin: 20px 0 10px">分享记录</h4>
        <el-table v-if="shareLinks.length > 0" :data="shareLinks" size="small" border>
          <el-table-column prop="linkNo" label="链接单号" width="160" />
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="已付" width="100">
            <template #default="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">待支付</el-tag>
              <el-tag v-else-if="row.status === 'PAID'" type="success" size="small">已支付</el-tag>
              <el-tag v-else-if="row.status === 'EXPIRED'" type="danger" size="small">已过期</el-tag>
              <el-tag v-else-if="row.status === 'REVOKED'" type="info" size="small">已撤销</el-tag>
              <el-tag v-else size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="shareChannel" label="渠道" width="70" />
          <el-table-column prop="viewCount" label="浏览次数" width="80" />
          <el-table-column prop="createdAt" label="创建时间" width="150" />
        </el-table>
        <div v-else style="color: #CCCCCC; font-size: 13px; padding-left: 10px">暂无分享记录</div>

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
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { fetchSaleBills, fetchSaleBillCollectionLinks } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";
import DetailDrawer from "../components/DetailDrawer.vue";

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
const shareLinks = ref<any[]>([]);

const columns = [
  { prop: "billNo", label: "销售单号", width: 200 },
  { prop: "customerName", label: "客户", minWidth: 140 },
  { prop: "receivableAmount", label: "应收", width: 120, slot: "receivableAmount" },
  { prop: "receivedAmount", label: "已收", width: 120, slot: "receivedAmount" },
  { prop: "unpaidAmount", label: "未收", width: 120, slot: "unpaidAmount" },
  { prop: "payStatus", label: "收款状态", width: 120, slot: "payStatus" },
  { prop: "shareInfo", label: "分享", width: 100, slot: "shareInfo" },
  { prop: "fulfillStatus", label: "履约状态", width: 100, slot: "fulfillStatus" },
  { prop: "createTime", label: "创建时间", width: 160 },
  { label: "操作", width: 100, fixed: "right", slot: "actions" }
];

// 根据收款状态构建状态流转时间线
const statusTimeline = computed(() => {
  const bill = currentBill.value;
  if (!bill) return [];
  const timeline: { time: string; label: string; color: string; type: string }[] = [];
  // 创建
  if (bill.createTime) {
    timeline.push({ time: bill.createTime, label: "创建销售单", color: "#3F6FEF", type: "primary" });
  }
  // 分享
  if (bill.lastShareTime) {
    timeline.push({ time: bill.lastShareTime, label: `分享链接（共${bill.shareCollectionCount || 0}次）`, color: "#3F6FEF", type: "primary" });
  }
  // 支付
  if (bill.payStatus === 'PAID' || bill.payStatus === 'PARTIAL') {
    timeline.push({ time: bill.createTime, label: bill.payStatus === 'PAID' ? "全部支付完成" : "部分支付", color: "#0EA879", type: "success" });
  }
  // 逾期
  if (bill.payStatus === 'OVERDUE') {
    timeline.push({ time: "", label: "已逾期", color: "#C0392B", type: "danger" });
  }
  return timeline;
});

async function loadSaleBills() {
  loading.value = true;
  try {
    const data = await fetchSaleBills();
    let list = Array.isArray(data) ? data : (data.records || []);
    // 映射字段名兼容
    list = list.map((item: any) => ({
      ...item,
      payStatus: item.collectionStatus || item.payStatus,
      fulfillStatus: item.businessStatus || item.fulfillStatus,
      createTime: item.createdAt || item.createTime,
      shareCollectionCount: item.shareCollectionCount ?? 0,
      lastShareTime: item.lastShareTime || null,
    }));
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
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function viewDetail(row: any) {
  currentBill.value = row;
  shareLinks.value = [];
  detailVisible.value = true;
  // 加载分享链接
  try {
    const links = await fetchSaleBillCollectionLinks(row.billNo);
    shareLinks.value = Array.isArray(links) ? links : [];
  } catch { /* ignore */ }
}

onMounted(() => {
  loadSaleBills();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.unpaid-text {
  color: var(--color-danger);
  font-weight: 600;
}
</style>