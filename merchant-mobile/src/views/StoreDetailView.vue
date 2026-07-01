<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchStoreDetail, type StoreDetailRecord } from '../api'

const route = useRoute()
const router = useRouter()
const store = ref<StoreDetailRecord | null>(null)
const loading = ref(false)

function getStatusText(status: string) {
  if (status === 'OPEN') return '营业中'
  if (status === 'PAUSED') return '暂停中'
  return '已关闭'
}

function getStatusColor(status: string) {
  if (status === 'OPEN') return '#07c160'
  if (status === 'PAUSED') return '#ff7d00'
  return '#999999'
}

function handleCallPhone() {
  if (store.value?.phone) {
    window.location.href = `tel:${store.value.phone}`
  }
}

function handleNavigate() {
  const s = store.value
  if (s && s.longitude && s.latitude) {
    window.open(`https://uri.amap.com/marker?position=${s.longitude},${s.latitude}`)
  } else {
    showToast('暂无位置信息')
  }
}

function goBack() {
  router.back()
}

async function loadDetail() {
  loading.value = true
  try {
    const id = Number(route.params.id)
    const res = await fetchStoreDetail(id)
    store.value = res.data
  } catch {
    showToast('加载门店详情失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <section class="page">
    <van-nav-bar
      title="门店详情"
      left-arrow
      @click-left="goBack"
      fixed
      placeholder
    />

    <van-loading v-if="loading" class="loading-wrapper" />

    <template v-if="store && !loading">
      <!-- 门店信息卡片 -->
      <van-cell-group inset title="门店信息">
        <van-cell title="门店编码" :value="store.storeCode" />
        <van-cell title="门店名称" :value="store.name" />
        <van-cell title="门店地址" :value="store.address" />
        <van-cell
          title="联系电话"
          :value="store.phone"
          is-link
          @click="handleCallPhone"
        />
        <van-cell title="联系人" :value="store.contact" />
        <van-cell title="配送半径">
          <template #default>
            <span>{{ store.deliveryRadius }} km</span>
          </template>
        </van-cell>
        <van-cell title="营业时间" :value="store.businessHours" />
        <van-cell title="微信商户">
          <template #default>
            <span>{{ store.wechatMerchantName || '未绑定' }}</span>
          </template>
        </van-cell>
        <van-cell title="营业状态">
          <template #default>
            <span
              class="status-tag"
              :style="{ backgroundColor: getStatusColor(store.businessStatus) }"
            >
              {{ getStatusText(store.businessStatus) }}
            </span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 地图定位展示区 -->
      <van-cell-group inset title="地图定位" class="map-section">
        <div class="map-placeholder">
          <van-icon name="location-o" size="32" color="#1989fa" />
          <div class="map-info">
            <p class="map-text">经纬度: {{ store.longitude }}, {{ store.latitude }}</p>
            <p class="map-address" v-if="store.address">{{ store.address }}</p>
          </div>
        </div>
      </van-cell-group>
    </template>

    <van-empty v-if="!store && !loading" description="门店信息不存在" />

    <!-- 底部操作栏 -->
    <van-action-bar v-if="store && !loading">
      <van-action-bar-button
        icon="phone-o"
        type="warning"
        text="一键拨打"
        @click="handleCallPhone"
      />
      <van-action-bar-button
        icon="guide-o"
        type="primary"
        text="一键导航"
        @click="handleNavigate"
      />
    </van-action-bar>
  </section>
</template>

<style scoped>
.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

.map-section {
  margin-top: 12px;
}

.map-placeholder {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  background: #f7f8fa;
  border-radius: 8px;
  margin: 0 16px 16px;
}

.map-info {
  flex: 1;
}

.map-text {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--text-primary);
}

.map-address {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>