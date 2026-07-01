<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchCustomerContribution,
  fetchCustomers,
  fetchCustomerDetail,
  fetchCustomerSales,
  fetchSalesRanking,
  type CustomerContributionItem,
  type CustomerRecord,
  type SaleBillRecord
} from '../api'

const router = useRouter()

/* ========== 数据 ========== */
const loading = ref(false)
const refreshing = ref(false)
const contributionList = ref<CustomerContributionItem[]>([])
const purchaseRanking = ref<CustomerContributionItem[]>([])
const customerList = ref<CustomerRecord[]>([])
const searchKeyword = ref('')
const searchLoading = ref(false)

/* ========== 客户详情弹窗 ========== */
const showDetail = ref(false)
const detailCustomer = ref<CustomerRecord | null>(null)
const detailSales = ref<SaleBillRecord[]>([])
const detailLoading = ref(false)

/* ========== 排序 ========== */
const sortBy = ref<'amount' | 'orders'>('amount')

async function loadData() {
  loading.value = true
  try {
    const [contribRes, purchaseRes] = await Promise.all([
      fetchCustomerContribution({ page: 1, pageSize: 20 }),
      fetchSalesRanking({ dimension: 'customer', limit: 20 })
    ])
    contributionList.value = contribRes.data?.records ?? contribRes.data ?? []
    purchaseRanking.value = purchaseRes.data || []
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function searchCustomers() {
  if (!searchKeyword.value.trim()) return
  searchLoading.value = true
  try {
    const res = await fetchCustomers({ keyword: searchKeyword.value, page: 1, pageSize: 20 })
    customerList.value = res.data?.records ?? res.data ?? []
  } catch { /* ignore */ }
  finally { searchLoading.value = false }
}

async function openDetail(customerId: number) {
  showDetail.value = true
  detailLoading.value = true
  try {
    const [detailRes, salesRes] = await Promise.all([
      fetchCustomerDetail(customerId),
      fetchCustomerSales(customerId, { page: 1, pageSize: 20 })
    ])
    detailCustomer.value = detailRes.data || null
    detailSales.value = salesRes.data?.records ?? salesRes.data ?? []
  } catch { /* ignore */ }
  finally { detailLoading.value = false }
}

function onRefresh() {
  refreshing.value = true
  loadData().finally(() => { refreshing.value = false })
}

/* 排序切换 */
const sortedContribution = ref<CustomerContributionItem[]>([])

function sortContribution() {
  sortedContribution.value = [...contributionList.value].sort((a, b) => {
    if (sortBy.value === 'amount') return b.totalAmount - a.totalAmount
    return b.orderCount - a.orderCount
  })
}

function onSortChange() {
  sortContribution()
}

onMounted(() => {
  loadData().then(() => sortContribution())
})

/* ========== 工具函数 ========== */
function formatMoney(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { 'COMPLETED': '已完成', 'CONFIRMED': '已确认', 'DRAFT': '待确认', 'VOIDED': '已作废' }
  return map[s] || s
}
</script>

<template>
  <section class="page">
    <van-nav-bar title="客户分析" left-arrow @click-left="router.back()" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 客户概览 -->
        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#EFF6FF;">
              <van-icon name="friends-o" color="#3B82F6" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">客户总数</span>
              <span class="stat-value">{{ contributionList.length }}<span class="unit">人</span></span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#ECFDF5;">
              <van-icon name="add-o" color="#10B981" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">本月新增</span>
              <span class="stat-value">--<span class="unit">人</span></span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FFF7ED;">
              <van-icon name="fire-o" color="#F59E0B" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">活跃客户</span>
              <span class="stat-value">--<span class="unit">人</span></span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FEF2F2;">
              <van-icon name="user-o" color="#EF4444" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">流失客户</span>
              <span class="stat-value">--<span class="unit">人</span></span>
            </div>
          </div>
        </div>

        <!-- 客户搜索 -->
        <div class="section-header">
          <van-icon name="search" size="16" color="var(--color-primary)" />
          <span>客户搜索</span>
        </div>
        <div class="search-bar">
          <van-search v-model="searchKeyword" placeholder="搜索客户名/手机号" shape="round" @search="searchCustomers" />
        </div>
        <div v-if="searchLoading" class="empty-hint">搜索中...</div>
        <div v-else-if="customerList.length > 0" class="card">
          <div v-for="item in customerList" :key="item.memberId" class="rank-row" @click="openDetail(item.memberId)">
            <span class="rank-name">{{ item.name }}</span>
            <span class="rank-qty">{{ item.mobile }}</span>
            <van-icon name="arrow" size="14" color="var(--text-muted)" />
          </div>
        </div>

        <!-- 客户贡献排行 -->
        <div class="section-header">
          <van-icon name="hot-o" size="16" color="#EF4444" />
          <span>客户贡献排行 TOP20</span>
          <div class="sort-btns">
            <span class="sort-chip" :class="{ active: sortBy === 'amount' }" @click="sortBy = 'amount'; onSortChange()">按金额</span>
            <span class="sort-chip" :class="{ active: sortBy === 'orders' }" @click="sortBy = 'orders'; onSortChange()">按订单</span>
          </div>
        </div>
        <div class="card">
          <div v-if="sortedContribution.length === 0" class="empty-hint">暂无数据</div>
          <div v-for="(item, i) in sortedContribution.slice(0, 20)" :key="item.customerId" class="rank-row" @click="openDetail(item.customerId)">
            <span class="rank-idx" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
            <div class="rank-info-col">
              <span class="rank-name">{{ item.customerName }}</span>
              <span class="rank-sub">{{ item.customerMobile }}</span>
            </div>
            <span class="rank-qty">{{ item.orderCount }}单</span>
            <span class="rank-amount">¥{{ formatMoney(item.totalAmount) }}</span>
          </div>
        </div>

        <!-- 客户采购排行 -->
        <div class="section-header">
          <van-icon name="bag-o" size="16" color="var(--color-primary)" />
          <span>客户采购排行</span>
        </div>
        <div class="card">
          <div v-if="purchaseRanking.length === 0" class="empty-hint">暂无数据</div>
          <div v-for="(item, i) in purchaseRanking.slice(0, 10)" :key="item.customerId" class="rank-row" @click="openDetail(item.customerId)">
            <span class="rank-idx" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
            <div class="rank-info-col">
              <span class="rank-name">{{ item.customerName }}</span>
            </div>
            <span class="rank-qty">{{ item.orderCount }}单</span>
            <span class="rank-amount">¥{{ formatMoney(item.totalAmount) }}</span>
          </div>
        </div>
      </div>
    </van-pull-refresh>

    <!-- 客户详情弹窗 -->
    <van-popup v-model:show="showDetail" position="bottom" round :style="{ maxHeight: '70%' }">
      <div class="popup-body">
        <h3>客户详情</h3>
        <div v-loading="detailLoading">
          <div v-if="detailCustomer" class="detail-info">
            <div class="detail-row">
              <span class="detail-label">客户名称</span>
              <span class="detail-value">{{ detailCustomer.name }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">手机号</span>
              <span class="detail-value">{{ detailCustomer.mobile }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">客户类型</span>
              <span class="detail-value">{{ detailCustomer.customerType }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">结算方式</span>
              <span class="detail-value">{{ detailCustomer.settlementType || '--' }}</span>
            </div>
          </div>

          <div class="section-header">
            <van-icon name="description" size="14" color="var(--color-primary)" />
            <span>消费记录</span>
          </div>
          <div v-if="detailSales.length === 0" class="empty-hint">暂无消费记录</div>
          <div v-for="item in detailSales" :key="item.billNo" class="sale-row">
            <div class="sale-left">
              <span class="sale-no">{{ item.billNo }}</span>
              <span class="sale-date">{{ formatDate(item.createdAt) }}</span>
            </div>
            <div class="sale-right">
              <span class="sale-amount">¥{{ formatMoney(item.receivableAmount) }}</span>
              <span class="sale-status">{{ statusLabel(item.businessStatus) }}</span>
            </div>
          </div>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }

.section-header { display: flex; align-items: center; gap: 6px; padding: 16px 0 8px; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.sort-btns { display: flex; gap: 4px; margin-left: auto; }
.sort-chip { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 400; color: var(--text-secondary); background: var(--bg-soft); cursor: pointer; }
.sort-chip.active { background: var(--color-primary); color: #fff; }

.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border-radius: 10px; padding: 12px 10px; box-shadow: var(--shadow-card); }
.stat-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.stat-info { display: flex; flex-direction: column; min-width: 0; }
.stat-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.stat-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.unit { font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 2px; }

.search-bar { margin: 0 -8px; }

.card { background: var(--bg-card); border-radius: 10px; box-shadow: var(--shadow-card); padding: 10px 12px; margin-bottom: 8px; }
.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; gap: 6px; font-size: 13px; color: var(--text-muted); }

.rank-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-normal); cursor: pointer; }
.rank-row:last-child { border-bottom: none; }
.rank-idx { width: 20px; height: 20px; border-radius: 50%; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
.rank-top { background: var(--color-primary-soft); color: var(--color-primary); }
.rank-info-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.rank-name { font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-sub { font-size: 11px; color: var(--text-muted); }
.rank-qty { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.rank-amount { font-size: 13px; font-weight: 600; color: var(--color-primary); flex-shrink: 0; }

/* ===== 弹窗 ===== */
.popup-body { padding: 20px 16px; }
.popup-body h3 { margin: 0 0 16px; font-size: 16px; text-align: center; }
.detail-info { margin-bottom: 12px; }
.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.detail-label { font-size: 13px; color: var(--text-secondary); }
.detail-value { font-size: 13px; font-weight: 500; color: var(--text-primary); }

.sale-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.sale-row:last-child { border-bottom: none; }
.sale-left { display: flex; flex-direction: column; gap: 2px; }
.sale-no { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.sale-date { font-size: 11px; color: var(--text-muted); }
.sale-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.sale-amount { font-size: 14px; font-weight: 600; color: var(--color-primary); }
.sale-status { font-size: 10px; padding: 2px 6px; border-radius: 8px; background: var(--bg-soft); color: var(--text-secondary); }
</style>