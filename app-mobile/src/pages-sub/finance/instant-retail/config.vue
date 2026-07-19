<template>
  <view class="retail-config-page">
    <view class="page-header">
      <text class="header-title">即时零售配置</text>
    </view>

    <view class="platform-section">
      <text class="section-title">支持平台</text>
      <view class="platform-grid">
        <view class="platform-card" v-for="p in platforms" :key="p.code" @tap="onPlatformTap(p)">
          <view class="platform-icon" :class="{ 'platform-icon--active': isConfigured(p.code) }">
            <text class="platform-icon-text">{{ p.name.charAt(0) }}</text>
          </view>
          <text class="platform-name">{{ p.name }}</text>
          <view class="platform-status" :class="isConfigured(p.code) ? 'platform-status--on' : ''">
            <text class="platform-status-text">{{ isConfigured(p.code) ? '已对接' : '未对接' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="config-list-section">
      <text class="section-title">已对接配置</text>
      <view class="config-card" v-for="cfg in configs" :key="cfg.platform">
        <view class="config-header">
          <text class="config-platform">{{ cfg.platformName || cfg.platform }}</text>
          <view class="config-status" :class="cfg.connected ? 'config-status--on' : 'config-status--off'">
            <text class="config-status-text">{{ cfg.connected ? '已连接' : '未连接' }}</text>
          </view>
        </view>
        <view class="config-body">
          <view class="config-row">
            <text class="config-label">AppKey</text>
            <text class="config-value">{{ cfg.appKey || '--' }}</text>
          </view>
          <view class="config-row">
            <text class="config-label">店铺ID</text>
            <text class="config-value">{{ cfg.shopId || '--' }}</text>
          </view>
          <view class="config-row" v-if="cfg.callbackUrl">
            <text class="config-label">回调地址</text>
            <text class="config-value">{{ cfg.callbackUrl }}</text>
          </view>
        </view>
        <view class="config-actions">
          <button class="btn-sm btn-sm--primary" @tap="onTestConnection(cfg)">测试连接</button>
          <button class="btn-sm btn-sm--warning" @tap="onSyncOrders(cfg)">同步订单</button>
          <button class="btn-sm btn-sm--warning" @tap="onSyncProducts(cfg)">同步商品</button>
          <button class="btn-sm btn-sm--danger" @tap="onDeleteConfig(cfg)">删除</button>
        </view>
      </view>
      <view class="empty-state" v-if="configs.length === 0">
        <text class="empty-text">暂无对接配置，请点击上方平台进行配置</text>
      </view>
    </view>

    <view class="config-modal" v-if="modalVisible" @tap="closeModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">配置{{ currentPlatform?.name }}</text>
          <text class="close-btn" @tap="closeModal">X</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">AppKey</text>
            <input class="form-input" type="text" v-model="editForm.appKey" placeholder="请输入AppKey" />
          </view>
          <view class="form-item">
            <text class="form-label">AppSecret</text>
            <input class="form-input" type="text" v-model="editForm.appSecret" placeholder="请输入AppSecret" />
          </view>
          <view class="form-item">
            <text class="form-label">店铺ID</text>
            <input class="form-input" type="text" v-model="editForm.shopId" placeholder="请输入店铺ID" />
          </view>
          <view class="form-item">
            <text class="form-label">回调地址</text>
            <input class="form-input" type="text" v-model="editForm.callbackUrl" placeholder="请输入回调地址（选填）" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn--primary btn--block" @tap="onSaveConfig">保存配置</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { instantRetailApi, type RetailPlatform, type PlatformConfig } from '@/api/modules/instant-retail'

const platforms = ref<RetailPlatform[]>([])
const configs = ref<PlatformConfig[]>([])
const modalVisible = ref(false)
const currentPlatform = ref<RetailPlatform | null>(null)

const editForm = reactive<PlatformConfig>({
  platform: '',
  appKey: '',
  appSecret: '',
  shopId: '',
  callbackUrl: '',
  status: 1,
})

function isConfigured(code: string): boolean {
  return configs.value.some(c => c.platform === code)
}

async function loadPlatforms() {
  try {
    platforms.value = await instantRetailApi.platforms()
  } catch (err) {
    console.error('加载平台列表失败:', err)
  }
}

async function loadConfigs() {
  try {
    configs.value = await instantRetailApi.configs()
  } catch (err) {
    console.error('加载配置列表失败:', err)
  }
}

function onPlatformTap(p: RetailPlatform) {
  currentPlatform.value = p
  const existing = configs.value.find(c => c.platform === p.code)
  if (existing) {
    Object.assign(editForm, existing)
  } else {
    Object.assign(editForm, {
      platform: p.code,
      platformName: p.name,
      appKey: '',
      appSecret: '',
      shopId: '',
      callbackUrl: '',
      status: 1,
    })
  }
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  currentPlatform.value = null
}

async function onSaveConfig() {
  if (!editForm.appKey || !editForm.appSecret) {
    uni.showToast({ title: '请填写AppKey和AppSecret', icon: 'none' })
    return
  }
  try {
    await instantRetailApi.saveConfig(editForm)
    uni.showToast({ title: '保存成功', icon: 'success' })
    closeModal()
    loadConfigs()
  } catch (err) {
    console.error('保存配置失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

async function onTestConnection(cfg: PlatformConfig) {
  try {
    await instantRetailApi.testConnection(cfg.platform)
    uni.showToast({ title: '连接成功', icon: 'success' })
  } catch (err) {
    console.error('测试连接失败:', err)
    uni.showToast({ title: '连接失败', icon: 'none' })
  }
}

async function onSyncOrders(cfg: PlatformConfig) {
  try {
    await instantRetailApi.syncOrders(cfg.platform)
    uni.showToast({ title: '同步订单成功', icon: 'success' })
  } catch (err) {
    console.error('同步订单失败:', err)
    uni.showToast({ title: '同步失败', icon: 'none' })
  }
}

async function onSyncProducts(cfg: PlatformConfig) {
  try {
    await instantRetailApi.syncProducts(cfg.platform)
    uni.showToast({ title: '同步商品成功', icon: 'success' })
  } catch (err) {
    console.error('同步商品失败:', err)
    uni.showToast({ title: '同步失败', icon: 'none' })
  }
}

function onDeleteConfig(cfg: PlatformConfig) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除${cfg.platformName || cfg.platform}的配置吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await instantRetailApi.deleteConfig(cfg.platform)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadConfigs()
        } catch (err) {
          console.error('删除失败:', err)
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}

loadPlatforms()
loadConfigs()
</script>

<style scoped>
.retail-config-page { min-height: 100vh; background: #f0f5ff; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.platform-section { padding: 24rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: #333; display: block; margin-bottom: 16rpx; }
.platform-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.platform-card { width: calc(33.33% - 12rpx); background: #fff; border-radius: 16rpx; padding: 24rpx 16rpx; display: flex; flex-direction: column; align-items: center; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.platform-icon { width: 80rpx; height: 80rpx; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin-bottom: 12rpx; }
.platform-icon--active { background: rgba(22,119,255,0.1); }
.platform-icon-text { font-size: 32rpx; font-weight: 700; color: #999; }
.platform-icon--active .platform-icon-text { color: #1677FF; }
.platform-name { font-size: 24rpx; color: #333; margin-bottom: 8rpx; }
.platform-status { padding: 2rpx 12rpx; border-radius: 6rpx; background: rgba(0,0,0,0.05); }
.platform-status--on { background: rgba(82,196,26,0.1); }
.platform-status-text { font-size: 20rpx; color: #999; }
.platform-status--on .platform-status-text { color: #52c41a; }
.config-list-section { padding: 0 24rpx 24rpx; }
.config-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid #f0f0f0; }
.config-platform { font-size: 30rpx; font-weight: 600; color: #333; }
.config-status { padding: 4rpx 16rpx; border-radius: 8rpx; }
.config-status--on { background: rgba(82,196,26,0.1); }
.config-status--off { background: rgba(255,77,79,0.1); }
.config-status-text { font-size: 22rpx; }
.config-status--on .config-status-text { color: #52c41a; }
.config-status--off .config-status-text { color: #ff4d4f; }
.config-body { display: flex; flex-direction: column; gap: 8rpx; }
.config-row { display: flex; justify-content: space-between; }
.config-label { font-size: 24rpx; color: #999; }
.config-value { font-size: 26rpx; color: #333; }
.config-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f0f0f0; }
.btn-sm { font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 8rpx; border: none; line-height: 1.8; }
.btn-sm--primary { background: #1677FF; color: #fff; }
.btn-sm--warning { background: rgba(250,173,20,0.1); color: #faad14; }
.btn-sm--danger { background: #fff; color: #ff4d4f; border: 1rpx solid #ff4d4f; }
.empty-state { display: flex; justify-content: center; padding: 80rpx 0; }
.empty-text { font-size: 28rpx; color: #bbb; }
.config-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
.modal-content { width: 90%; max-width: 600rpx; background: #fff; border-radius: 24rpx; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 32rpx; border-bottom: 1rpx solid #f0f0f0; }
.modal-title { font-size: 30rpx; font-weight: 600; color: #333; }
.close-btn { font-size: 32rpx; color: #999; padding: 8rpx 16rpx; }
.modal-body { padding: 24rpx 32rpx; }
.form-item { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.form-label { font-size: 28rpx; color: #333; width: 160rpx; flex-shrink: 0; }
.form-input { flex: 1; height: 60rpx; font-size: 28rpx; color: #333; }
.modal-footer { padding: 16rpx 32rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: #1677FF; color: #fff; }
.btn--block { width: 100%; }
</style>
