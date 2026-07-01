<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { fetchCustomerPoints, fetchCustomerPointsRecords, adjustCustomerPoints, type CustomerPointsData, type PointsRecord } from '../api'

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.customerId)

const pointsData = ref<CustomerPointsData | null>(null)
const records = ref<PointsRecord[]>([])
const loading = ref(false)
const recordType = ref('')

const showAdjust = ref(false)
const adjustAmount = ref(0)
const adjustReason = ref('')
const adjusting = ref(false)

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').slice(0, 19)
}

async function loadData() {
  loading.value = true
  try {
    const [points, recordsRes] = await Promise.all([
      fetchCustomerPoints(customerId),
      fetchCustomerPointsRecords(customerId, recordType.value || undefined)
    ])
    pointsData.value = points.data as CustomerPointsData
    const rData = (recordsRes.data as any)?.records ?? recordsRes.data
    records.value = Array.isArray(rData) ? rData : []
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function onTypeChange() { loadData() }

async function handleAdjust() {
  if (!adjustAmount.value || !adjustReason.value) {
    showToast('请填写积分和原因')
    return
  }
  adjusting.value = true
  showLoadingToast({ message: '调整中...', forbidClick: true })
  try {
    await adjustCustomerPoints(customerId, { amount: adjustAmount.value, reason: adjustReason.value })
    closeToast()
    showAdjust.value = false
    adjustAmount.value = 0
    adjustReason.value = ''
    await loadData()
  } catch {
    closeToast()
    showToast('调整失败')
  } finally { adjusting.value = false }
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="customer-points-view">
    <van-nav-bar title="积分明细" left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="add-o" size="20" @click="showAdjust = true" />
      </template>
    </van-nav-bar>

    <!-- 积分余额卡片 -->
    <div class="points-card">
      <div class="points-balance">{{ pointsData?.points ?? 0 }}</div>
      <div class="points-label">当前积分</div>
      <div class="points-stats">
        <div class="stat-item">
          <div class="stat-value">{{ pointsData?.totalEarned ?? 0 }}</div>
          <div class="stat-label">累计获取</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ pointsData?.totalSpent ?? 0 }}</div>
          <div class="stat-label">累计消耗</div>
        </div>
      </div>
    </div>

    <!-- 类型筛选 -->
    <div class="filter-bar">
      <span class="filter-chip" :class="{ active: recordType === '' }" @click="recordType = ''; onTypeChange()">全部</span>
      <span class="filter-chip" :class="{ active: recordType === 'EARN' }" @click="recordType = 'EARN'; onTypeChange()">获取</span>
      <span class="filter-chip" :class="{ active: recordType === 'SPEND' }" @click="recordType = 'SPEND'; onTypeChange()">消耗</span>
    </div>

    <!-- 积分记录 -->
    <div class="records-list">
      <div v-for="r in records" :key="r.id" class="record-item">
        <div class="record-left">
          <div class="record-source">{{ r.remark || r.sourceType }}</div>
          <div class="record-time">{{ formatDateTime(r.createdAt) }}</div>
        </div>
        <div class="record-right">
          <div class="record-amount" :class="r.type === 'EARN' ? 'earn' : 'spend'">
            {{ r.type === 'EARN' ? '+' : '-' }}{{ r.amount }}
          </div>
          <div class="record-balance">余额 {{ r.balance }}</div>
        </div>
      </div>
      <van-empty v-if="!loading && records.length === 0" description="暂无记录" />
    </div>

    <!-- 调整积分弹窗 -->
    <van-popup v-model:show="showAdjust" position="bottom" round>
      <div class="adjust-popup">
        <h3>调整积分</h3>
        <van-cell-group inset>
          <van-field v-model.number="adjustAmount" type="number" label="积分" placeholder="正数增加，负数减少" />
          <van-field v-model="adjustReason" label="原因" placeholder="请输入调整原因" />
        </van-cell-group>
        <div class="adjust-actions">
          <van-button block @click="showAdjust = false">取消</van-button>
          <van-button type="primary" block :loading="adjusting" @click="handleAdjust">确认调整</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.customer-points-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }

.points-card {
  margin: 12px 16px;
  padding: 24px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: #fff;
  text-align: center;
}

.points-balance { font-size: 36px; font-weight: 700; }
.points-label { font-size: 13px; opacity: 0.85; margin-top: 4px; }

.points-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,.2);
}

.stat-item { text-align: center; }
.stat-value { font-size: 18px; font-weight: 600; }
.stat-label { font-size: 11px; opacity: 0.75; margin-top: 2px; }

.filter-bar {
  display: flex; gap: 8px; padding: 8px 16px;
}

.filter-chip {
  padding: 4px 12px; border-radius: 14px; font-size: 12px;
  background: var(--bg-card); color: var(--text-secondary);
}

.filter-chip.active { background: var(--color-primary); color: #fff; }

.records-list { padding: 0 16px; }

.record-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; background: var(--bg-card); border-radius: 10px;
  margin-bottom: 8px; box-shadow: var(--shadow-card);
}

.record-source { font-size: 14px; color: var(--text-primary); }
.record-time { font-size: 11px; color: var(--text-hint); margin-top: 2px; }
.record-right { text-align: right; }
.record-amount { font-size: 16px; font-weight: 600; }
.record-amount.earn { color: var(--color-success); }
.record-amount.spend { color: var(--color-danger); }
.record-balance { font-size: 11px; color: var(--text-hint); }

.adjust-popup { padding: 24px 16px 32px; }
.adjust-popup h3 { text-align: center; margin: 0 0 16px; }
.adjust-actions { display: flex; gap: 10px; margin-top: 20px; }
</style>