<template>
  <div class="pos-collection">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">分享收款</h2>
        <p class="page-desc">收款链接、收款记录与退款记录</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="loadList">
          <el-icon><Refresh /></el-icon>&nbsp;刷新
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="loadList">
      <el-tab-pane label="收款链接" name="links" />
      <el-tab-pane label="收款记录" name="payments" />
      <el-tab-pane label="退款记录" name="refunds" />
    </el-tabs>

    <div class="table-card">
      <el-table :data="records" v-loading="loading" stripe>
        <template v-if="activeTab === 'links'">
          <el-table-column prop="linkNo" label="链接编号" width="160" />
          <el-table-column prop="billNo" label="关联单号" width="160" />
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }"><span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span></template>
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
            <template #default="{ row }"><span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span></template>
          </el-table-column>
          <el-table-column label="付款方式" width="100" ><template #default="{ row }">{{ fmtPayMethod(row.paymentMethod) }}</template></el-table-column>
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
            <template #default="{ row }"><span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span></template>
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
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          v-if="total > 0"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadList"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fmtPayMethod } from "../../utils/enums";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
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
  padding: 0;
}
.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
