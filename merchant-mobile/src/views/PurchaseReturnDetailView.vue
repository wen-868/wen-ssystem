<template>
  <div class="purchase-return-detail-view">
    <van-nav-bar title="采购退货单详情" left-arrow @click-left="$router.back()" />
    
    <van-loading v-if="loading" class="loading" />
    
    <template v-else-if="detail">
      <!-- 状态信息 -->
      <van-cell-group inset>
        <van-cell title="退货单号" :value="detail.returnNo" />
        <van-cell title="退货状态">
          <template #value>
            <van-tag :type="getStatusType(detail.status) as any">
              {{ getStatusText(detail.status) }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="退款状态">
          <template #value>
            <van-tag :type="getRefundStatusType(detail.returnStatus) as any">
              {{ getRefundStatusText(detail.returnStatus) }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="创建时间" :value="formatDate(detail.createdAt)" />
      </van-cell-group>
      
      <!-- 供应商信息 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="供应商名称" :value="detail.supplierName || '--'" />
        <van-cell v-if="detail.purchaseNo" title="原采购单号" :value="detail.purchaseNo" />
        <van-cell v-if="detail.orderNo" title="关联订单号" :value="detail.orderNo" />
      </van-cell-group>
      
      <!-- 退货商品 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货商品" />
        <div class="items-list">
          <div
            v-for="item in detail.items"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <div class="item-amount">¥{{ formatMoney(item.subtotalAmount) }}</div>
            </div>
            <div class="item-body">
              <div class="info-row">
                <span class="label">退货数量：</span>
                <span class="value">{{ item.totalBottleQty }} 瓶</span>
              </div>
              <div class="info-row">
                <span class="label">单价：</span>
                <span class="value">¥{{ formatMoney(item.unitPrice) }}</span>
              </div>
              <div class="info-row" v-if="item.reason">
                <span class="label">原因：</span>
                <span class="value">{{ item.reason }}</span>
              </div>
            </div>
          </div>
        </div>
      </van-cell-group>
      
      <!-- 退货原因 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货原因" :label="detail.reason || '--'" />
      </van-cell-group>
      
      <!-- 金额信息 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货金额" :value="`¥${formatMoney(detail.refundAmount)}`" />
        <van-cell title="已退款金额" :value="`¥${formatMoney(detail.refundedAmount)}`" />
      </van-cell-group>
    </template>
    
    <van-empty v-else description="退货单不存在" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { fetchPurchaseReturnDetail, type PurchaseReturnDetail } from '../api'

const route = useRoute()

const loading = ref(true)
const detail = ref<PurchaseReturnDetail | null>(null)

onMounted(async () => {
  const returnNo = route.params.returnNo as string
  try {
    const res = await fetchPurchaseReturnDetail(returnNo)
    detail.value = res.data.data || res.data
  } catch (error) {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
})

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'default'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已审核',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  }
  return map[status] || status
}

function getRefundStatusType(status: string) {
  const map: Record<string, string> = {
    UNPAID: 'warning',
    PARTIAL: 'primary',
    PAID: 'success'
  }
  return map[status] || 'default'
}

function getRefundStatusText(status: string) {
  const map: Record<string, string> = {
    UNPAID: '待退款',
    PARTIAL: '部分退款',
    PAID: '已退款'
  }
  return map[status] || status
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatMoney(amount: number) {
  return amount.toFixed(2)
}
</script>

<style scoped>
.purchase-return-detail-view {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.items-list {
  padding: 12px;
}

.item-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-name {
  font-weight: 500;
  font-size: 14px;
}

.item-amount {
  color: #ee0a24;
  font-weight: 500;
}

.item-body {
  padding-left: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.label {
  color: #999;
  font-size: 13px;
}

.value {
  color: #333;
  font-size: 13px;
}
</style>