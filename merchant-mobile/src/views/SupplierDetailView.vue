<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchSupplierDetail, fetchSupplierProducts, fetchSupplierStats, type SupplierDetail, type SupplierProductRecord, type SupplierStats } from '../api'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const detail = ref<SupplierDetail | null>(null)
const stats = ref<SupplierStats | null>(null)
const products = ref<SupplierProductRecord[]>([])
const loading = ref(true)
const activeTab = ref(0)

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}

onMounted(async () => {
  try {
    const [detailRes, statsRes, productsRes] = await Promise.all([
      fetchSupplierDetail(id),
      fetchSupplierStats(id).catch(() => ({ data: null })),
      fetchSupplierProducts(id).catch(() => ({ data: null }))
    ])
    detail.value = detailRes.data as SupplierDetail
    stats.value = statsRes.data as SupplierStats
    const pData = (productsRes.data as any)?.records ?? (productsRes.data as any)?.list ?? productsRes.data
    products.value = Array.isArray(pData) ? pData : []
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="supplier-detail-view">
    <van-nav-bar title="供应商详情" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="detail">
      <!-- 基本信息 -->
      <div class="section-card">
        <h3 class="section-title">基本信息</h3>
        <van-cell-group inset>
          <van-cell title="供应商名称" :value="detail.name" />
          <van-cell title="简称" :value="detail.shortName || '-'" />
          <van-cell title="供应类型" :value="detail.supplyType || '-'" />
          <van-cell title="信用等级" :value="detail.creditLevel" />
          <van-cell title="结算方式" :value="detail.settlementType === 'CASH' ? '现结' : detail.settlementType === 'MONTHLY' ? '月结' : '季结'" />
          <van-cell v-if="detail.settlementDay" title="结算日" :value="`每月${detail.settlementDay}日`" />
          <van-cell title="税率" :value="`${(detail.taxRate * 100).toFixed(0)}%`" />
          <van-cell title="地址" :value="[detail.province, detail.city, detail.district, detail.address].filter(Boolean).join(' ') || '-'" />
          <van-cell v-if="detail.remark" title="备注" :value="detail.remark" />
        </van-cell-group>
      </div>

      <!-- 联系人 -->
      <div class="section-card" v-if="detail.contacts?.length > 0">
        <h3 class="section-title">联系人</h3>
        <div v-for="(c, idx) in detail.contacts" :key="idx" class="contact-item">
          <div class="contact-name">
            {{ c.name }}
            <span v-if="c.isPrimary" class="primary-badge">主</span>
          </div>
          <div class="contact-info">
            <span v-if="c.mobile">{{ c.mobile }}</span>
            <span v-if="c.phone">{{ c.phone }}</span>
            <span v-if="c.email">{{ c.email }}</span>
            <span v-if="c.wechat">微信：{{ c.wechat }}</span>
          </div>
          <div v-if="c.position" class="contact-position">{{ c.position }}</div>
        </div>
      </div>

      <!-- 银行信息 -->
      <div class="section-card" v-if="detail.bankName || detail.bankAccount">
        <h3 class="section-title">银行信息</h3>
        <van-cell-group inset>
          <van-cell title="银行" :value="detail.bankName || '-'" />
          <van-cell title="账号" :value="detail.bankAccount || '-'" />
          <van-cell title="户名" :value="detail.bankAccountName || '-'" />
        </van-cell-group>
      </div>

      <!-- 统计 -->
      <div class="section-card" v-if="stats">
        <h3 class="section-title">采购统计</h3>
        <van-cell-group inset>
          <van-cell title="采购单数" :value="String(stats.purchaseOrderCount ?? 0)" />
          <van-cell title="采购总额" :value="`¥${formatPrice(stats.totalPurchaseAmount)}`" />
        </van-cell-group>
      </div>

      <!-- 供应产品 -->
      <div class="section-card" v-if="products.length > 0">
        <h3 class="section-title">供应产品</h3>
        <div v-for="p in products" :key="p.skuId" class="product-item">
          <div class="product-name">{{ p.skuName || p.skuId }}</div>
          <div class="product-price">¥{{ formatPrice(p.purchasePrice) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.supplier-detail-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.section-card {
  margin: 0 16px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.section-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.contact-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-normal);
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.primary-badge {
  font-size: 10px;
  padding: 0 6px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 10px;
}

.contact-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.contact-position {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

.product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-normal);
}

.product-item:last-child {
  border-bottom: none;
}

.product-name {
  font-size: 14px;
  color: var(--text-primary);
}

.product-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}
</style>