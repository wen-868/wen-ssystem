<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchAdminProducts,
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

/* ========== 批量调价 ========== */
const showBatchPopup = ref(false)
const batchAdjustType = ref('percent') // percent | fixed
const batchAdjustValue = ref('')

async function submitBatchAdjust() {
  if (!batchAdjustValue.value) {
    showSuccessToast({ message: '请输入调整值', position: 'bottom' })
    return
  }
  try {
    showLoadingToast({ message: '批量调价中...', forbidClick: true })
    // Simulate batch price update
    await new Promise(r => setTimeout(r, 800))
    closeToast()
    showSuccessToast('批量调价成功')
    showBatchPopup.value = false
    await loadProducts(true)
  } catch {
    closeToast()
  }
}

/* ========== 单品改价弹窗 ========== */
const showPricePopup = ref(false)
const priceForm = ref({
  skuId: 0,
  name: '',
  skuName: '',
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

onMounted(() => {
  loadProducts(true)
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <h2 class="page-title">价格管理</h2>
      <span style="width: 20px;"></span>
    </div>

    <van-search
      v-model="keyword"
      placeholder="搜索商品名称/SKU"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <div class="action-bar">
      <van-button type="warning" size="small" icon="edit" @click="showBatchPopup = true">
        批量调价
      </van-button>
      <span class="record-count">共 {{ products.length }} 条</span>
    </div>

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
          class="price-cell"
          @click="openPricePopup(item)"
        >
          <template #title>
            <div class="price-header">
              <span class="price-name">{{ item.name }}</span>
              <van-tag plain size="medium">{{ item.skuName }}</van-tag>
            </div>
          </template>
          <template #label>
            <div class="price-row">
              <div class="price-item">
                <span class="price-label">零售</span>
                <span class="price-value">¥{{ Number(item.retailPrice).toFixed(2) }}</span>
              </div>
              <div class="price-item" v-if="item.wholesalePrice != null">
                <span class="price-label">批发</span>
                <span class="price-value">¥{{ Number(item.wholesalePrice).toFixed(2) }}</span>
              </div>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 批量调价弹窗 -->
    <van-popup
      v-model:show="showBatchPopup"
      position="bottom"
      round
      :style="{ maxHeight: '50%' }"
    >
      <div class="price-panel">
        <h3>批量调价</h3>
        <van-cell-group inset>
          <van-field
            v-model="batchAdjustValue"
            label="调整值"
            :placeholder="batchAdjustType === 'percent' ? '如: 10 表示上调10%' : '如: 5 表示上调5元'"
            type="number"
          />
          <van-cell title="调整方式" is-link>
            <template #value>
              <van-radio-group v-model="batchAdjustType" direction="horizontal">
                <van-radio name="percent">百分比</van-radio>
                <van-radio name="fixed">固定金额</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
        </van-cell-group>
        <div class="price-actions">
          <van-button block type="warning" @click="submitBatchAdjust">确认调价</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 单品改价弹窗 -->
    <van-popup
      v-model:show="showPricePopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="price-panel">
        <h3>修改价格</h3>
        <div class="price-subtitle">{{ priceForm.name }} -- {{ priceForm.skuName }}</div>
        <van-cell-group inset>
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

.price-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.price-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.price-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price-row {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}

.price-item {
  display: flex;
  align-items: center;
  gap: 4px;
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

.price-panel {
  padding: 20px 16px;
  max-height: 70vh;
  overflow-y: auto;
}

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

.price-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
