<template>
  <div class="pos-collection">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>分享收款</span>
          <el-button size="small" type="primary" @click="loadList">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="loadList">
        <el-tab-pane label="收款链接" name="links" />
        <el-tab-pane label="收款记录" name="payments" />
        <el-tab-pane label="退款记录" name="refunds" />
      </el-tabs>

      <el-table :data="records" v-loading="loading" size="small" style="width: 100%">
        <template v-if="activeTab === 'links'">
          <el-table-column prop="linkNo" label="链接编号" width="160" />
          <el-table-column prop="billNo" label="关联单号" width="160" />
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'PAID' ? 'success' : 'warning'" size="small">
                {{ row.status === "PAID" ? "已支付" : "待支付" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="expireAt" label="过期时间" width="160" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button v-if="row.shareUrl" size="small" link type="primary" @click="copyLink(row.shareUrl)">复制链接</el-button>
            </template>
          </el-table-column>
        </template>

        <template v-else-if="activeTab === 'payments'">
          <el-table-column prop="paymentNo" label="支付单号" width="180" />
          <el-table-column prop="billNo" label="关联单号" width="160" />
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="paymentMethod" label="支付方式" width="100" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row.status || "成功" }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="paidAt" label="支付时间" width="160" />
        </template>

        <template v-else>
          <el-table-column prop="refundNo" label="退款单号" width="180" />
          <el-table-column prop="billNo" label="关联单号" width="160" />
          <el-table-column prop="amount" label="退款金额" width="100">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="退款原因" min-width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'SUCCESS' ? 'success' : 'warning'" size="small">
                {{ row.status || "处理中" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="申请时间" width="160" />
        </template>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px"
        @current-change="loadList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchStoreCollectionLinks,
  fetchStorePaymentOrders,
  fetchStoreRefundOrders
} from "../../api";

const loading = ref(false);
const activeTab = ref("links");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(30);
const total = ref(0);

async function loadList() {
  loading.value = true;
  try {
    let data: any;
    if (activeTab.value === "links") {
      data = await fetchStoreCollectionLinks({ page: page.value, pageSize: pageSize.value });
    } else if (activeTab.value === "payments") {
      data = await fetchStorePaymentOrders({ page: page.value, pageSize: pageSize.value });
    } else {
      data = await fetchStoreRefundOrders({ page: page.value, pageSize: pageSize.value });
    }
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载失败");
    records.value = [];
  } finally {
    loading.value = false;
  }
}

function copyLink(url: string) {
  navigator.clipboard.writeText(url);
  ElMessage.success("链接已复制");
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-collection {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
