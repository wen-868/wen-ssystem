<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  showLoadingToast,
  showSuccessToast,
  showToast,
  closeToast
} from 'vant'
import {
  api,
  fetchAdminStores,
  type AdminStoreRecord
} from '../api'

const keyword = ref('')
const stores = ref<AdminStoreRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

/* ========== 新增/编辑弹窗 ========== */
const showStorePopup = ref(false)
const isEdit = ref(false)
const showStatusPicker = ref(false)
const storeForm = ref({
  id: 0,
  name: '',
  address: '',
  contact: '',
  phone: '',
  deliveryRadius: 5,
  businessStatus: 'OPEN'
})

/* ========== 列表加载 ========== */
async function loadStores() {
  loading.value = true
  try {
    const res = await fetchAdminStores({ page: 1, pageSize: 50, keyword: keyword.value || undefined })
    const data = res.data
    stores.value = data.records ?? []
    finished.value = true
  } catch {
    showToast('加载门店列表失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadStores()
}

function onRefresh() {
  refreshing.value = true
  loadStores()
}

function openAddStore() {
  isEdit.value = false
  storeForm.value = {
    id: 0,
    name: '',
    address: '',
    contact: '',
    phone: '',
    deliveryRadius: 5,
    businessStatus: 'OPEN'
  }
  showStorePopup.value = true
}

function openEditStore(item: AdminStoreRecord) {
  isEdit.value = true
  storeForm.value = {
    id: item.id,
    name: item.name,
    address: item.address,
    contact: item.contact,
    phone: item.phone,
    deliveryRadius: item.deliveryRadius,
    businessStatus: item.businessStatus
  }
  showStorePopup.value = true
}

async function submitStore() {
  if (!storeForm.value.name.trim()) {
    showToast('请填写门店名称')
    return
  }
  try {
    showLoadingToast({ message: '保存中...', forbidClick: true })
    if (isEdit.value) {
      await api.put(`/admin/stores/${storeForm.value.id}`, {
        name: storeForm.value.name,
        address: storeForm.value.address,
        contact: storeForm.value.contact,
        phone: storeForm.value.phone,
        deliveryRadius: storeForm.value.deliveryRadius,
        businessStatus: storeForm.value.businessStatus
      })
    } else {
      await api.post('/admin/stores', {
        name: storeForm.value.name,
        address: storeForm.value.address,
        contact: storeForm.value.contact,
        phone: storeForm.value.phone,
        deliveryRadius: storeForm.value.deliveryRadius
      })
    }
    closeToast()
    showSuccessToast(isEdit.value ? '门店信息已更新' : '门店已添加')
    showStorePopup.value = false
    await loadStores()
  } catch {
    closeToast()
    showToast('操作失败，请重试')
  }
}

function getStatusText(status: string) {
  return status === 'OPEN' ? '营业中' : '已关闭'
}

function getStatusType(status: string) {
  return status === 'OPEN' ? 'success' : 'danger'
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'admin' }))
}

onMounted(() => {
  loadStores()
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <van-icon name="arrow-left" size="20" @click="goBack" />
      <h2 class="page-title">门店设置</h2>
      <span style="width: 20px;"></span>
    </div>

    <van-search
      v-model="keyword"
      placeholder="搜索门店名称/编码"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <div class="action-bar">
      <van-button type="primary" size="small" icon="plus" @click="openAddStore">
        新增门店
      </van-button>
      <span class="record-count">共 {{ stores.length }} 家</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadStores"
      >
        <div v-if="stores.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无门店" />
        </div>
        <van-cell
          v-for="item in stores"
          :key="item.id"
          is-link
          class="store-cell"
          @click="openEditStore(item)"
        >
          <template #title>
            <div class="store-header">
              <span class="store-name">{{ item.name }}</span>
              <van-tag :type="getStatusType(item.businessStatus) as any" plain size="medium">
                {{ getStatusText(item.businessStatus) }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="store-meta">
              <span>编码: {{ item.storeCode }}</span>
              <span v-if="item.phone">电话: {{ item.phone }}</span>
            </div>
            <div class="store-address" v-if="item.address">
              {{ item.address }}
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 新增/编辑弹窗 -->
    <van-popup
      v-model:show="showStorePopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="form-panel">
        <h3>{{ isEdit ? '编辑门店' : '新增门店' }}</h3>
        <van-cell-group inset>
          <van-field
            v-model="storeForm.name"
            label="门店名称"
            placeholder="请输入门店名称"
            required
          />
          <van-field
            v-model="storeForm.address"
            label="门店地址"
            placeholder="请输入地址"
          />
          <van-field
            v-model="storeForm.contact"
            label="联系人"
            placeholder="请输入联系人"
          />
          <van-field
            v-model="storeForm.phone"
            label="联系电话"
            placeholder="请输入电话"
            type="tel"
          />
          <van-field
            v-model="storeForm.deliveryRadius"
            label="配送半径"
            placeholder="配送半径(km)"
            type="number"
          />
          <van-field
            v-model="storeForm.businessStatus"
            label="营业状态"
            placeholder="请选择"
            is-link
            readonly
            @click="showStatusPicker = true"
          />
        </van-cell-group>
        <div class="form-actions">
          <van-button block type="primary" @click="submitStore">保存</van-button>
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

.store-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.store-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.store-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.store-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.store-address {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-panel {
  padding: 20px 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.form-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.form-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
