<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  fetchMyPoints,
  fetchMyPointsRecords,
  type PointsRecord
} from '../api'
import PointsProductCard from '../components/PointsProductCard.vue'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)

/* 积分数据 */
const myPoints = ref(0)
const pointsRecords = ref<PointsRecord[]>([])
const pointsPage = ref(1)
const pointsFinished = ref(false)

/* 积分明细筛选 */
const pointsTypeFilter = ref('')
const pointsTypeOptions = [
  { label: '全部', value: '' },
  { label: '获取', value: 'EARN' },
  { label: '消耗', value: 'SPEND' }
]

/* 模拟积分商品 */
const pointsProducts = ref([
  { id: 1, name: '精品大米礼盒装', image: '', points: 500, price: 99.00, stock: 100 },
  { id: 2, name: '厨房清洁套装', image: '', points: 300, price: 59.00, stock: 50 },
  { id: 3, name: '家用工具箱组合', image: '', points: 800, price: 159.00, stock: 30 },
  { id: 4, name: '保温杯不锈钢', image: '', points: 200, price: 39.00, stock: 200 },
  { id: 5, name: '品牌毛巾套装', image: '', points: 150, price: 29.00, stock: 80 },
  { id: 6, name: '智能体脂秤', image: '', points: 600, price: 119.00, stock: 25 }
])

/* 兑换记录 */
const exchangeRecords = ref<any[]>([])
const exchangePage = ref(1)
const exchangeFinished = ref(false)

/* 子Tab */
const subTab = ref('products')
const subTabs = [
  { label: '兑换商品', value: 'products' },
  { label: '兑换记录', value: 'records' },
  { label: '积分明细', value: 'history' }
]

async function loadData() {
  loading.value = true
  try {
    const res = await fetchMyPoints().catch(() => ({ data: { points: 0 } }))
    myPoints.value = res.data?.points ?? 0
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function loadPointsRecords() {
  try {
    const res = await fetchMyPointsRecords({ page: pointsPage.value, pageSize: 20, type: pointsTypeFilter.value || undefined })
    const records = (res.data?.records ?? res.data ?? []) as PointsRecord[]
    if (pointsPage.value === 1) pointsRecords.value = records
    else pointsRecords.value = [...pointsRecords.value, ...records]
    pointsFinished.value = records.length < 20
  } catch { /* ignore */ }
}

function onRefresh() {
  refreshing.value = true
  pointsPage.value = 1
  exchangePage.value = 1
  Promise.all([loadData(), loadPointsRecords()]).finally(() => { refreshing.value = false })
}

function onLoadMore() {
  pointsPage.value++
  loadPointsRecords()
}

function onProductClick(id: number) {
  showToast('商品详情')
}

function onExchange(id: number) {
  const product = pointsProducts.value.find(p => p.id === id)
  if (!product) return
  showConfirmDialog({
    title: '确认兑换',
    message: `确定使用 ${product.points} 积分兑换「${product.name}」？\n当前积分: ${myPoints.value}\n兑换后: ${myPoints.value - product.points}`,
    confirmButtonText: '确认兑换',
    cancelButtonText: '取消'
  }).then(() => {
    showToast('兑换成功')
    myPoints.value -= product.points
    product.stock--
  }).catch(() => {})
}

function onSubTabChange() {
  if (subTab.value === 'history') {
    pointsPage.value = 1
    loadPointsRecords()
  }
}

onMounted(() => {
  loadData()
})

/* 工具函数 */
function formatMoney(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 16).replace('T', ' ')
}

function recordTypeLabel(t: string): string {
  return t === 'EARN' ? '获取' : t === 'SPEND' ? '消耗' : t
}
</script>

<template>
  <section class="page">
    <van-nav-bar title="积分商城" left-arrow @click-left="router.back()" />

    <!-- 积分余额卡片 -->
    <div class="points-card">
      <div class="points-balance">
        <span class="points-number">{{ myPoints }}</span>
        <span class="points-unit">积分</span>
      </div>
      <div class="points-actions">
        <span class="points-link" @click="router.push('/reports/customers')">积分明细 ›</span>
      </div>
    </div>

    <!-- 子Tab -->
    <van-tabs v-model:active="subTab" sticky @change="onSubTabChange">
      <van-tab v-for="t in subTabs" :key="t.value" :title="t.label" :name="t.value" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 兑换商品 -->
        <template v-if="subTab === 'products'">
          <div v-if="pointsProducts.length === 0" class="empty-hint">
            <van-icon name="gold-coin-o" size="40" color="var(--text-muted)" />
            <span>暂无兑换商品</span>
          </div>
          <div class="product-grid">
            <PointsProductCard
              v-for="p in pointsProducts"
              :key="p.id"
              :id="p.id"
              :product-name="p.name"
              :product-image="p.image"
              :points-required="p.points"
              :market-price="p.price"
              :stock-remaining="p.stock"
              :my-points="myPoints"
              @click="onProductClick"
              @exchange="onExchange"
            />
          </div>
        </template>

        <!-- 兑换记录 -->
        <template v-if="subTab === 'records'">
          <div class="empty-hint">
            <van-icon name="description" size="40" color="var(--text-muted)" />
            <span>暂无兑换记录</span>
          </div>
        </template>

        <!-- 积分明细 -->
        <template v-if="subTab === 'history'">
          <div class="filter-row">
            <span
              v-for="o in pointsTypeOptions"
              :key="o.value"
              class="filter-chip"
              :class="{ active: pointsTypeFilter === o.value }"
              @click="pointsTypeFilter = o.value; pointsPage = 1; loadPointsRecords()"
            >{{ o.label }}</span>
          </div>
          <div v-if="pointsRecords.length === 0" class="empty-hint">
            <van-icon name="description" size="40" color="var(--text-muted)" />
            <span>暂无积分记录</span>
          </div>
          <div class="card">
            <div v-for="item in pointsRecords" :key="item.id" class="record-row">
              <div class="record-left">
                <span class="record-title">{{ item.remark || item.sourceType }}</span>
                <span class="record-time">{{ formatDate(item.createdAt) }}</span>
              </div>
              <div class="record-right">
                <span class="record-amount" :class="{ earn: item.amount > 0, spend: item.amount < 0 }">
                  {{ item.amount > 0 ? '+' : '' }}{{ item.amount }}
                </span>
                <span class="record-balance">余额 {{ item.balance }}</span>
              </div>
            </div>
          </div>
          <div v-if="!pointsFinished" class="load-more" @click="onLoadMore">加载更多</div>
        </template>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }

.points-card { background: linear-gradient(135deg, #FFFDE7, #FFF8E1); border-radius: 12px; padding: 20px; margin: 8px 0; box-shadow: var(--shadow-card); }
.points-balance { display: flex; align-items: baseline; justify-content: center; gap: 4px; }
.points-number { font-size: 36px; font-weight: 700; color: #F9CA24; }
.points-unit { font-size: 16px; color: #F9CA24; }
.points-actions { text-align: center; margin-top: 8px; }
.points-link { font-size: 13px; color: var(--color-primary); cursor: pointer; }

.filter-row { display: flex; gap: 8px; padding: 8px 0; }
.filter-chip { padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text-secondary); background: var(--bg-soft); cursor: pointer; }
.filter-chip.active { background: var(--color-primary); color: #fff; }

.product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }

.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 8px; font-size: 13px; color: var(--text-muted); }

.card { background: var(--bg-card); border-radius: 10px; box-shadow: var(--shadow-card); padding: 10px 12px; margin-bottom: 8px; }
.record-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.record-row:last-child { border-bottom: none; }
.record-left { display: flex; flex-direction: column; gap: 2px; }
.record-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.record-time { font-size: 11px; color: var(--text-muted); }
.record-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.record-amount { font-size: 15px; font-weight: 600; }
.record-amount.earn { color: #10B981; }
.record-amount.spend { color: #EF4444; }
.record-balance { font-size: 10px; color: var(--text-muted); }

.load-more { text-align: center; padding: 12px; font-size: 13px; color: var(--color-primary); cursor: pointer; }
</style>