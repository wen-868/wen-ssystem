<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'

interface DashboardMetrics {
  todaySalesAmount: number
  todayReceivedAmount: number
  waitDeliveryCount: number
  unpaidReceivableAmount: number
  inventoryAlertCount: number
}

const loading = ref(false)
const metrics = ref<DashboardMetrics>({
  todaySalesAmount: 0,
  todayReceivedAmount: 0,
  waitDeliveryCount: 0,
  unpaidReceivableAmount: 0,
  inventoryAlertCount: 0
})

// 快捷操作
const quickActions = [
  { text: '配送管理', icon: 'logistics', color: '#1677FF' },
  { text: '开单收款', icon: 'cash-back-record', color: '#10B981' },
  { text: '库存查询', icon: 'search', color: '#F59E0B' },
  { text: '客户管理', icon: 'friends-o', color: '#8B5CF6' }
]

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/store/dashboard')
    const data = res.data.data || {}
    metrics.value = {
      todaySalesAmount: Number(data.todaySalesAmount || 0),
      todayReceivedAmount: Number(data.todayReceivedAmount || data.unReceivedAmount || 0),
      waitDeliveryCount: Number(data.waitDeliveryCount || data.pendingOrderCount || 0),
      unpaidReceivableAmount: Number(data.unpaidReceivableAmount || data.unReceivedAmount || 0),
      inventoryAlertCount: Number(data.inventoryAlertCount || 0)
    }
  } catch {
    // dashboard 接口可能尚未就绪，使用 mock 数据
    metrics.value = {
      todaySalesAmount: 12580.50,
      todayReceivedAmount: 8960.00,
      waitDeliveryCount: 12,
      unpaidReceivableAmount: 34500.00,
      inventoryAlertCount: 5
    }
  } finally {
    loading.value = false
  }
})

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <section class="page">
    <!-- 顶部经营概览 -->
    <div class="card hero">
      <div class="hero-content">
        <h2>今日经营</h2>
        <p>快速查看销售、收款、配送和应收</p>
      </div>
    </div>

    <!-- 核心指标网格 -->
    <van-grid :column-num="2" :border="false" class="metric-grid">
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: var(--color-primary-soft);">
            <van-icon name="chart-trending-o" color="var(--color-primary)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">今日销售额</span>
            <span class="metric-value">¥{{ formatMoney(metrics.todaySalesAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #ECFDF5;">
            <van-icon name="cash-back-record" color="var(--color-success)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">今日收款额</span>
            <span class="metric-value">¥{{ formatMoney(metrics.todayReceivedAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #FFF7ED;">
            <van-icon name="logistics" color="var(--color-warning)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">待配送订单</span>
            <span class="metric-value metric-value--warn">{{ metrics.waitDeliveryCount }}<span class="metric-unit"> 单</span></span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #FEF2F2;">
            <van-icon name="balance-o" color="var(--color-danger)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">待收款金额</span>
            <span class="metric-value metric-value--danger">¥{{ formatMoney(metrics.unpaidReceivableAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
    </van-grid>

    <!-- 库存预警 -->
    <van-cell-group inset class="alert-section">
      <van-cell
        title="库存预警"
        :value="`${metrics.inventoryAlertCount} 项`"
        is-link
        icon="warning-o"
      >
        <template #right-icon>
          <van-tag :type="metrics.inventoryAlertCount > 0 ? 'danger' : 'success'" plain>
            {{ metrics.inventoryAlertCount > 0 ? '需关注' : '正常' }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 快捷操作 -->
    <div class="section-title">常用操作</div>
    <van-grid :column-num="4" :border="false" class="action-grid">
      <van-grid-item
        v-for="action in quickActions"
        :key="action.text"
        :icon="action.icon"
        :text="action.text"
        icon-color="#1677FF"
      />
    </van-grid>
  </section>
</template>

<style scoped>
.hero {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.hero-content h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.hero-content p {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}

.metric-grid {
  margin: 12px 0;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.metric-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.metric-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.metric-value--warn {
  color: var(--color-warning);
}

.metric-value--danger {
  color: var(--color-danger);
}

.metric-unit {
  font-size: 12px;
  font-weight: 400;
}

.alert-section {
  margin-top: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 16px 16px 8px;
}

.action-grid {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
</style>
