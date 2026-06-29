<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchProductDetail, fetchProductTags, type ProductDetailRecord, type ProductTagGroups } from '../api'

const route = useRoute()
const router = useRouter()

const spuId = Number(route.params.spuId)
const detail = ref<ProductDetailRecord | null>(null)
const tagGroups = ref<ProductTagGroups | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [detailRes, tagsRes] = await Promise.all([
      fetchProductDetail(spuId),
      fetchProductTags(spuId).catch(() => ({ data: null }))
    ])
    detail.value = detailRes.data as ProductDetailRecord
    tagGroups.value = tagsRes.data as ProductTagGroups | null
  } catch {
    showToast('加载商品详情失败')
  } finally {
    loading.value = false
  }
})

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

function formatNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '-'
}

/* ========== 营销标签颜色映射 ========== */
const MARKETING_TAG_STYLE: Record<string, { text: string; color: string }> = {
  NEW: { text: '新品', color: '#1989FA' },
  HOT: { text: '爆款', color: '#EE0A24' },
  RECOMMEND: { text: '推荐', color: '#07C160' },
  LIMITED: { text: '限时特价', color: '#FF976A' },
  CLEARANCE: { text: '清仓', color: '#969799' }
}

function getMarketingTags(): string[] {
  if (!detail.value?.marketingTags) return []
  if (typeof detail.value.marketingTags === 'string') {
    try { return JSON.parse(detail.value.marketingTags as string) } catch { return [] }
  }
  return detail.value.marketingTags as string[]
}

function goBatches() {
  router.push(`/products/${spuId}/batches`)
}
</script>

<template>
  <div class="product-detail-view">
    <van-nav-bar title="商品详情" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-if="detail">
      <!-- 图片轮播 -->
      <van-swipe v-if="detail.mainImage || detail.imageUrls?.length" class="image-swipe" :autoplay="3000" indicator-color="var(--color-primary)">
        <van-swipe-item v-if="detail.mainImage">
          <img :src="detail.mainImage" alt="主图" class="swipe-image" />
        </van-swipe-item>
        <van-swipe-item v-for="(url, i) in detail.imageUrls" :key="i">
          <img :src="url" alt="轮播图" class="swipe-image" />
        </van-swipe-item>
      </van-swipe>
      <div v-else class="image-placeholder">
        <van-icon name="goods-collect-o" size="48" color="var(--text-muted)" />
      </div>

      <!-- 基本信息 -->
      <div class="section">
        <h2 class="product-name">{{ detail.name }}</h2>

        <!-- 营销标签 -->
        <div v-if="getMarketingTags().length > 0" class="marketing-tags">
          <span
            v-for="tag in getMarketingTags()"
            :key="tag"
            class="marketing-tag"
            :style="{ background: MARKETING_TAG_STYLE[tag]?.color || '#969799' }"
          >
            {{ MARKETING_TAG_STYLE[tag]?.text || tag }}
          </span>
        </div>

        <div class="meta-row">
          <span v-if="detail.brand" class="meta-item">品牌：{{ detail.brand }}</span>
          <span v-if="detail.unit" class="meta-item">单位：{{ detail.unit }}</span>
          <span v-if="detail.specs" class="meta-item">规格：{{ detail.specs }}</span>
          <span v-if="detail.alcoholContent" class="meta-item">酒精度：{{ detail.alcoholContent }}%vol</span>
          <span v-if="detail.origin" class="meta-item">产地：{{ detail.origin }}</span>
        </div>
        <div class="tag-row" v-if="detail.isNew || detail.isRecommend">
          <van-tag v-if="detail.isNew" type="danger" size="medium">新品</van-tag>
          <van-tag v-if="detail.isRecommend" type="warning" size="medium">推荐</van-tag>
        </div>
        <div v-if="detail.description" class="description">{{ detail.description }}</div>
      </div>

      <!-- 属性标签 -->
      <div v-if="tagGroups?.groups?.length" class="section">
        <h3 class="section-title">属性标签</h3>
        <div v-for="group in tagGroups.groups" :key="group.groupId" class="tag-group">
          <span class="tag-group-name">{{ group.groupName }}</span>
          <div class="tag-group-values">
            <van-tag
              v-for="tag in group.tags"
              :key="tag.id"
              type="primary"
              plain
              size="medium"
              class="attr-tag"
            >
              {{ tag.name }}
            </van-tag>
          </div>
        </div>
      </div>

      <!-- SKU 规格 -->
      <div class="section">
        <h3 class="section-title">SKU 规格</h3>
        <div class="sku-list">
          <div v-for="sku in detail.skus" :key="sku.skuId" class="sku-card">
            <div class="sku-header">
              <span class="sku-name">{{ sku.skuName }}</span>
              <span class="sku-barcode">{{ sku.barcode || '-' }}</span>
            </div>
            <div class="sku-meta">
              <span v-if="sku.volume" class="sku-meta-item">{{ sku.volume }}</span>
              <span v-if="sku.packaging" class="sku-meta-item">{{ sku.packaging }}</span>
              <span v-if="sku.boxRatio > 1" class="sku-meta-item">{{ sku.boxRatio }}×{{ sku.boxUnit }}/{{ sku.baseUnit }}</span>
              <span v-if="sku.temperature" class="sku-meta-item">{{ sku.temperature }}</span>
              <span v-if="sku.traceEnabled" class="sku-meta-item">可追溯</span>
              <span class="sku-meta-item">预警{{ sku.warningThreshold }}{{ sku.baseUnit }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 价格信息 -->
      <div class="section">
        <h3 class="section-title">价格信息</h3>
        <div class="price-grid">
          <div v-for="sku in detail.skus" :key="'p-' + sku.skuId" class="price-card">
            <div class="price-sku-name">{{ sku.skuName }}</div>
            <div class="price-rows">
              <div class="price-row">
                <span class="price-label">零售价</span>
                <span class="price-value">¥{{ formatPrice(sku.retailPrice) }}</span>
              </div>
              <div v-if="sku.wholesalePrice" class="price-row">
                <span class="price-label">批发价</span>
                <span class="price-value">¥{{ formatPrice(sku.wholesalePrice) }}</span>
              </div>
              <div class="price-row">
                <span class="price-label">库存</span>
                <span class="price-value price-stock">{{ formatNumber(sku.availableQty) }} {{ sku.baseUnit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 批次入口 -->
      <div class="section">
        <van-button block plain type="primary" @click="goBatches">
          <van-icon name="clock-o" style="margin-right: 6px;" />
          查看批次追溯
        </van-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.product-detail-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

/* ===== 图片轮播 ===== */
.image-swipe {
  height: 260px;
}

.swipe-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  height: 200px;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 通用区块 ===== */
.section {
  margin: 12px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-name {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== 营销标签 ===== */
.marketing-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.marketing-tag {
  font-size: 11px;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

/* ===== 属性标签 ===== */
.tag-group {
  margin-bottom: 10px;
}

.tag-group:last-child {
  margin-bottom: 0;
}

.tag-group-name {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 8px;
  min-width: 40px;
  display: inline-block;
}

.tag-group-values {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  vertical-align: middle;
}

.attr-tag {
  margin: 0;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 8px;
}

.meta-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.tag-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding-top: 8px;
  border-top: 1px solid var(--border-normal);
}

/* ===== SKU 列表 ===== */
.sku-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sku-card {
  padding: 10px;
  background: var(--bg-soft);
  border-radius: var(--radius-md);
}

.sku-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.sku-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.sku-barcode {
  font-size: 12px;
  color: var(--text-muted);
}

.sku-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.sku-meta-item {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ===== 价格 ===== */
.price-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.price-card {
  padding: 10px;
  background: var(--bg-soft);
  border-radius: var(--radius-md);
}

.price-sku-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.price-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.price-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-danger);
}

.price-stock {
  color: var(--text-primary);
  font-weight: 500;
}
</style>