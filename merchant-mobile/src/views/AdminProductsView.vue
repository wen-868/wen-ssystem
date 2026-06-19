<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  showLoadingToast,
  showSuccessToast,
  showDialog,
  closeToast
} from 'vant'
import {
  fetchAdminProducts,
  updateProductStatus,
  updateProductPrice,
  type AdminProductRecord
} from '../api'

const router = useRouter()

const keyword = ref('')
const products = ref<AdminProductRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

/* ========== 列表加载 ========== */
async function loadProducts(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchAdminProducts({
      page: page.value,
      pageSize,
      keyword: keyword.value || undefined
    })
    const data = res.data.data
    const records = data.records ?? []
    if (reset) {
      products.value = records
    } else {
      products.value.push(...records)
    }
    if (products.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadProducts(true)
}

function onRefresh() {
  refreshing.value = true
  loadProducts(true)
}

/* ========== 状态映射 ========== */
const STATUS_MAP: Record<string, { text: string; type: string }> = {
  ON_SHELF: { text: '上架', type: 'success' },
  OFF_SHELF: { text: '下架', type: 'default' },
  DELETED: { text: '已删除', type: 'danger' }
}

/* ========== 上下架 ========== */
async function toggleStatus(item: AdminProductRecord) {
  const next = item.status === 'ON_SHELF' ? 'OFF_SHELF' : 'ON_SHELF'
  const actionText = next === 'ON_SHELF' ? '上架' : '下架'
  try {
    await showDialog({
      title: '确认操作',
      message: `确认${actionText}「${item.name}」？`
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await updateProductStatus(item.spuId, next)
    closeToast()
    showSuccessToast(`${actionText}成功`)
    await loadProducts(true)
  } catch {
    closeToast()
  }
}

/* ========== 价格编辑弹窗 ========== */
const showPricePopup = ref(false)
const priceForm = ref({
  skuId: 0,
  name: '',
  skuName: '',
  costPrice: '' as string,
  retailPrice: '' as string,
  wholesalePrice: '' as string,
  miniappPrice: '' as string,
  storePrice: '' as string
})

function openPricePopup(item: AdminProductRecord) {
  priceForm.value = {
    skuId: item.skuId,
    name: item.name,
    skuName: item.skuName,
    costPrice: '',
    retailPrice: String(item.retailPrice ?? ''),
    wholesalePrice: item.wholesalePrice != null ? String(item.wholesalePrice) : '',
    miniappPrice: '',
    storePrice: ''
  }
  showPricePopup.value = true
}

function toNum(v: string): number | null {
  const n = v === '' ? null : Number(v)
  return n === null || isNaN(n) ? null : n
}

async function submitPriceUpdate() {
  if (!priceForm.value.retailPrice) {
    showSuccessToast({ message: '请输入零售价', position: 'bottom' })
    return
  }
  try {
    showLoadingToast({ message: '保存中...', forbidClick: true })
    await updateProductPrice(priceForm.value.skuId, {
      costPrice: toNum(priceForm.value.costPrice) ?? undefined,
      retailPrice: toNum(priceForm.value.retailPrice) ?? undefined,
      wholesalePrice: toNum(priceForm.value.wholesalePrice),
      miniappPrice: toNum(priceForm.value.miniappPrice),
      storePrice: toNum(priceForm.value.storePrice)
    })
    closeToast()
    showSuccessToast('价格更新成功')
    showPricePopup.value = false
    await loadProducts(true)
  } catch {
    closeToast()
  }
}

/* ========== 详情弹窗 ========== */
const showDetail = ref(false)
const detailItem = ref<AdminProductRecord | null>(null)

function openDetail(item: AdminProductRecord) {
  detailItem.value = item
  showDetail.value = true
}

onMounted(() => {
  loadProducts(true)
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <h2 class="page-title">商品管理</h2>
      <span style="width: 20px;"></span>
    </div>

    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索商品名称/SKU/条码"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <!-- 新增按钮 -->
    <div class="action-bar">
      <van-button type="primary" size="small" icon="plus" @click="$router.push('/admin/products/create')">
        新增商品
      </van-button>
      <span class="record-count">共 {{ products.length }} 条</span>
    </div>

    <!-- 商品列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadProducts"
      >
        <div v-if="products.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无商品" />
        </div>
        <van-cell
          v-for="item in products"
          :key="`${item.spuId}-${item.skuId}`"
          is-link
          class="product-cell"
          @click="openDetail(item)"
        >
          <template #title>
            <div class="product-header">
              <span class="product-name">{{ item.name }}</span>
              <van-tag
                :type="(STATUS_MAP[item.status]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[item.status]?.text || item.status }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="product-meta">
              <span>SKU: {{ item.skuCode }}</span>
              <span>条码: {{ item.barcode || '-' }}</span>
            </div>
            <div class="product-price-row">
              <span class="price-label">零售价</span>
              <span class="price-value">¥{{ Number(item.retailPrice).toFixed(2) }}</span>
            </div>
          </template>
          <template #right-icon>
            <div class="product-actions">
              <van-button
                size="mini"
                :type="item.status === 'ON_SHELF' ? 'default' : 'success'"
                plain
                @click.stop="toggleStatus(item)"
              >
                {{ item.status === 'ON_SHELF' ? '下架' : '上架' }}
              </van-button>
              <van-button
                size="mini"
                type="primary"
                plain
                @click.stop="openPricePopup(item)"
              >
                改价
              </van-button>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 商品详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="detail-panel" v-if="detailItem">
        <h3>商品详情</h3>
        <van-cell-group inset>
          <van-cell title="商品名称" :value="detailItem.name" />
          <van-cell title="SKU名称" :value="detailItem.skuName" />
          <van-cell title="SKU编码" :value="detailItem.skuCode" />
          <van-cell title="条码" :value="detailItem.barcode || '-'" />
          <van-cell title="零售价">
            <template #value>
              <span class="detail-price">¥{{ Number(detailItem.retailPrice).toFixed(2) }}</span>
            </template>
          </van-cell>
          <van-cell title="批发价">
            <template #value>
              <span class="detail-price">
                {{ detailItem.wholesalePrice !== null && detailItem.wholesalePrice !== undefined ? '¥' + Number(detailItem.wholesalePrice).toFixed(2) : '-' }}
              </span>
            </template>
          </van-cell>
          <van-cell title="状态">
            <template #value>
              <van-tag
                :type="(STATUS_MAP[detailItem.status]?.type as any) || 'default'"
                plain
              >
                {{ STATUS_MAP[detailItem.status]?.text || detailItem.status }}
              </van-tag>
            </template>
          </van-cell>
        </van-cell-group>
        <div class="detail-actions">
          <van-button
            block
            :type="detailItem.status === 'ON_SHELF' ? 'default' : 'success'"
            @click="toggleStatus(detailItem); showDetail = false"
          >
            {{ detailItem.status === 'ON_SHELF' ? '下架' : '上架' }}
          </van-button>
          <van-button block type="primary" @click="openPricePopup(detailItem); showDetail = false">
            修改价格
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 改价弹窗 -->
    <van-popup
      v-model:show="showPricePopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="price-panel">
        <h3>修改价格</h3>
        <div class="price-subtitle">{{ priceForm.name }} — {{ priceForm.skuName }}</div>
        <van-cell-group inset>
          <van-field
            v-model="priceForm.costPrice"
            label="成本价"
            placeholder="请输入成本价"
            type="number"
          />
          <van-field
            v-model="priceForm.retailPrice"
            label="零售价"
            placeholder="请输入零售价"
            type="number"
            required
          />
          <van-field
            v-model="priceForm.wholesalePrice"
            label="批发价"
            placeholder="不填表示无"
            type="number"
          />
          <van-field
            v-model="priceForm.miniappPrice"
            label="小程序价"
            placeholder="不填表示无"
            type="number"
          />
          <van-field
            v-model="priceForm.storePrice"
            label="门店价"
            placeholder="不填表示无"
            type="number"
          />
        </van-cell-group>
        <div class="price-actions">
          <van-button block type="primary" @click="submitPriceUpdate">保存价格</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.product-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.product-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.product-price-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.price-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.price-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.product-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 8px;
}

.detail-panel,
.price-panel {
  padding: 20px 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.detail-panel h3,
.price-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.price-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 16px;
}

.detail-price {
  font-weight: 600;
  color: var(--color-primary);
}

.detail-actions,
.price-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
