<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'

const metrics = ref([
  { label: '今日销售', value: '¥0.00' },
  { label: '今日收款', value: '¥0.00' },
  { label: '待配送', value: '0' },
  { label: '待收款', value: '0' }
])

onMounted(async () => {
  try {
    const res = await api.get('/store/dashboard')
    const data = res.data.data || {}
    metrics.value = [
      { label: '今日销售', value: `¥${Number(data.todaySalesAmount || 0).toFixed(2)}` },
      { label: '今日收款', value: `¥${Number(data.todayReceivedAmount || 0).toFixed(2)}` },
      { label: '待配送', value: String(data.waitDeliveryCount || 0) },
      { label: '待收款', value: String(data.unpaidReceivableCount || 0) }
    ]
  } catch {
    // dashboard may not be available yet
  }
})
</script>

<template>
  <section class="page">
    <div class="card hero">
      <h2>今日经营</h2>
      <p>快速查看销售、收款、配送和应收</p>
    </div>
    <div class="metric-grid">
      <div v-for="item in metrics" :key="item.label" class="card metric">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </section>
</template>
