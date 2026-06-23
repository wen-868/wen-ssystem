<template>
  <div class="purchase-detail-view">
    <van-nav-bar title="采购单详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="loading" />

    <template v-else-if="detail">
      <van-cell-group inset>
        <van-cell title="采购单号" :value="detail.purchaseNo" />
        <van-cell title="状态">
          <template #value>
            <van-tag :type="getStatusType(detail.status)">
              {{ getStatusText(detail.status) }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="入库状态" :value="detail.warehouseStatus || '-'" />
        <van-cell title="创建时间" :value="formatDate(detail.createdAt)" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="供应商" :value="detail.supplierName" />
        <van-cell title="仓库" :value="detail.warehouseName" />
        <van-cell v-if="detail.expectedDate" title="预计到货" :value="detail.expectedDate" />
        <van-cell title="备注" :value="detail.remark || '-'" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="采购商品" />
        <div class="items-list">
          <div
            v-for="item in detail.items"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <div class="item-amount">¥{{ formatMoney(item.subtotal) }}</div>
            </div>
            <div class="item-body">
              <div class="info-row">
                <span class="label">数量：</span>
                <span class="value">{{ item.quantity }}</span>
              </div>
              <div class="info-row">
                <span class="label">单价：</span>
                <span class="value">¥{{ formatMoney(item.unitPrice) }}</span>
              </div>
            </div>
          </div>
        </div>
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="采购总额" :value="`¥${formatMoney(detail.totalAmount)}`" />
        <van-cell title="已付金额" :value="`¥${formatMoney(detail.paidAmount)}`" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px" v-if="detail.operationLogs?.length">
        <van-cell title="操作记录" />
        <div class="logs-list">
          <div
            v-for="(log, index) in detail.operationLogs"
            :key="index"
            class="log-item"
          >
            <div class="log-header">
              <span class="log-action">{{ log.action }}</span>
              <span class="log-time">{{ formatDate(log.createdAt) }}</span>
            </div>
            <div class="log-body">
              <span class="log-operator">{{ log.operator }}</span>
              <span class="log-remark" v-if="log.remark">{{ log.remark }}</span>
            </div>
          </div>
        </div>
      </van-cell-group>

      <div class="footer" v-if="detail.status === 'PENDING'">
        <van-button type="primary" block round @click="handleApprove">
          审核通过
        </van-button>
        <van-button plain block round @click="handleCancel" style="margin-top: 10px">
          取消订单
        </van-button>
      </div>

      <div class="footer" v-if="detail.status === 'APPROVED' && detail.warehouseStatus !== 'WAREHOUSED'">
        <van-button type="success" block round @click="goWarehousing">
          入库
        </van-button>
      </div>
    </template>

    <van-empty v-else description="采购单不存在" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  fetchPurchaseOrderDetail,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  type PurchaseOrderDetail
} from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const detail = ref<PurchaseOrderDetail | null>(null)

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    WAREHOUSED: 'success',
    CANCELLED: 'default'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已审核',
    WAREHOUSED: '已入库',
    CANCELLED: '已取消'
  }
  return map[status] || status
}

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

function formatDate(str: string) {
  if (!str) return ''
  return str.replace('T', ' ').slice(0, 16)
}

async function loadDetail() {
  loading.value = true
  try {
    const purchaseNo = route.params.purchaseNo as string
    const res = await fetchPurchaseOrderDetail(purchaseNo)
    detail.value = res.data as any
  } catch (e) {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function goWarehousing() {
  if (detail.value) {
    router.push(`/purchase-orders/${detail.value.purchaseNo}/warehousing`)
  }
}

async function handleApprove() {
  if (!detail.value) return
  try {
    await showConfirmDialog({ title: '确认', message: '确定审核通过该采购单？' })
    await approvePurchaseOrder(detail.value.purchaseNo)
    showToast('审核成功')
    loadDetail()
  } catch {
    // cancelled
  }
}

async function handleCancel() {
  if (!detail.value) return
  try {
    await showConfirmDialog({ title: '确认', message: '确定取消该采购单？' })
    await cancelPurchaseOrder(detail.value.purchaseNo)
    showToast('已取消')
    loadDetail()
  } catch {
    // cancelled
  }
}

onMounted(loadDetail)
</script>

<style scoped>
.purchase-detail-view {
  padding-bottom: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

.loading {
  display: block;
  margin: 40px auto;
}

.items-list {
  padding: 0 14px 10px;
}

.item-card {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
  margin-top: 8px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.item-amount {
  color: #ee0a24;
  font-weight: 600;
}

.item-body {
  font-size: 13px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.label {
  color: #999;
}

.value {
  color: #333;
}

.logs-list {
  padding: 0 14px 10px;
}

.log-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-item:last-child {
  border-bottom: none;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.log-action {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.log-time {
  font-size: 12px;
  color: #999;
}

.log-body {
  font-size: 12px;
  color: #666;
}

.log-operator {
  margin-right: 8px;
}

.log-remark {
  color: #999;
}

.footer {
  padding: 20px 16px;
}
</style>
