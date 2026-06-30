<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchSuppliers, type SupplierRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const supplyType = ref('')
const list = ref<SupplierRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const pageSize = 20

const TYPE_OPTIONS = [
  { text: '全部', value: '' },
  { text: '酒水', value: '酒水' },
  { text: '食品', value: '食品' },
  { text: '日用品', value: '日用品' },
  { text: '其他', value: '其他' },
]

function getTypeLabel(type: string) {
  return TYPE_OPTIONS.find(o => o.value === type)?.text || type || '-'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}

async function onSearch() {
  page.value = 1
  list.value = []
  finished.value = false
  await loadData()
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchSuppliers({
      keyword: keyword.value || undefined,
      supplyType: supplyType.value || undefined,
      page: page.value,
      pageSize
    })
    const data = (res.data as any).records ?? (res.data as any).list ?? res.data
    if (Array.isArray(data)) {
      if (page.value === 1) list.value = data
      else list.value.push(...data)
      if (data.length < pageSize) finished.value = true
    } else {
      finished.value = true
    }
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

async function onLoad() {
  page.value++
  await loadData()
}

function goDetail(id: number) {
  router.push(`/suppliers/${id}`)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="suppliers-view">
    <van-nav-bar title="供应商管理" left-arrow @click-left="router.back()" />

    <van-search v-model="keyword" placeholder="搜索供应商名称" show-action @search="onSearch" @clear="onSearch">
      <template #action>
        <div @click="onSearch">搜索</div>
      </template>
    </van-search>

    <!-- 分类筛选 -->
    <div class="filter-bar">
      <span
        v-for="opt in TYPE_OPTIONS"
        :key="opt.value"
        class="filter-chip"
        :class="{ active: supplyType === opt.value }"
        @click="supplyType = opt.value; onSearch()"
      >
        {{ opt.text }}
      </span>
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div v-for="item in list" :key="item.id" class="supplier-card" @click="goDetail(item.id)">
        <div class="supplier-header">
          <span class="supplier-name">{{ item.name }}</span>
          <span class="supplier-type-tag">{{ getTypeLabel(item.supplyType) }}</span>
        </div>
        <div class="supplier-info">
          <span class="supplier-contact">{{ item.contactPerson || '暂无联系人' }}</span>
          <span class="supplier-mobile">{{ item.contactMobile || '' }}</span>
        </div>
        <div class="supplier-meta">
          <span>结算：{{ item.settlementType === 'CASH' ? '现结' : item.settlementType === 'MONTHLY' ? '月结' : '季结' }}</span>
          <span>信用：{{ item.creditLevel }}</span>
          <span>创建：{{ formatDate(item.createdAt) }}</span>
        </div>
        <van-icon name="arrow" class="arrow-icon" />
      </div>
    </van-list>

    <van-empty v-if="!loading && list.length === 0" description="暂无供应商" />
  </div>
</template>

<style scoped>
.suppliers-view {
  min-height: 100vh;
  background: var(--bg-page);
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  overflow-x: auto;
  white-space: nowrap;
}

.filter-chip {
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.filter-chip.active {
  background: var(--color-primary);
  color: #fff;
}

.supplier-card {
  margin: 8px 16px;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  position: relative;
}

.supplier-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.supplier-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.supplier-type-tag {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.supplier-info {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.supplier-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-hint);
}

.arrow-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-hint);
  font-size: 14px;
}
</style>