<template>
  <div class="purchase-return-detail-view">
    <van-nav-bar title="采购退货详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="loading" />

    <template v-else-if="detail">
      <van-cell-group inset>
        <van-cell title="退货单号" :value="detail.returnNo" />
        <van-cell title="关联采购单号" :value="detail.purchaseNo || '-'" />
        <van-cell title="状态">
          <template #value>
            <van-tag :type="getStatusType(detail.returnStatus) as any">
              {{ getStatusText(detail.returnStatus) }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="创建时间" :value="formatDate(detail.createdAt)" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="供应商" :value="detail.supplierName || '-'" />
        <van-cell title="退货原因" :value="detail.remark || '-'" />
        <van-cell title="审核人" :value="detail.approvedBy || '-'" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货商品" />
        <div class="items-list">
          <div v-for="item in detail.items" :key="item.skuId" class="item-card">
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <div class="item-amount">¥{{ formatMoney(item.subtotal) }}</div>
            </div>
            <div class="item-body">
              <div class="item-qty">数量: {{ item.quantity || item.bottleQty || 0 }}</div>
              <div class="item-price">单价: ¥{{ formatMoney(item.unitPrice) }}</div>
            </div>
          </div>
        </div>
      </van-cell-group>

      <div class="empty" v-if="!detail.items || detail.items.length === 0">
        暂无退货商品
      </div>
    </template>

    <div class="error" v-else-if="!loading">
      加载失败，请重试
      <van-button type="primary" size="small" @click="loadDetail">重试</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { showToast } from "vant";
import { api } from "../api";

const route = useRoute();
const loading = ref(true);
const detail = ref<any>(null);

function formatDate(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-CN");
}

function formatMoney(val: any) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    COMPLETED: "",
  };
  return map[status] || "";
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回",
    COMPLETED: "已完成",
  };
  return map[status] || status;
}

async function loadDetail() {
  loading.value = true;
  try {
    const returnNo = route.params.returnNo as string;
    const { data } = await api.get(`/store/purchase-returns/${returnNo}`);
    detail.value = data.data;
  } catch (e: any) {
    showToast(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<style scoped>
.purchase-return-detail-view {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 24px;
}
.loading {
  margin-top: 40px;
}
.items-list {
  padding: 0 16px;
}
.item-card {
  padding: 12px 0;
  border-bottom: 1px solid #ebedf0;
}
.item-card:last-child {
  border-bottom: none;
}
.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.item-name {
  font-weight: 500;
}
.item-amount {
  color: #ee0a24;
  font-weight: 600;
}
.item-body {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 13px;
  color: #969799;
}
.empty,
.error {
  text-align: center;
  padding: 40px;
  color: #969799;
}
.error .van-button {
  margin-top: 12px;
}
</style>