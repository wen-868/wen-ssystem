<template>
  <view class="settings-page">
    <!-- Tab 导航 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <view class="page-body">
      <!-- 公司信息 -->
      <view v-if="activeTab === 'company'" class="section">
        <view class="section-title">
          <text class="title-text">公司信息</text>
          <text class="title-tip">注册时自动填充，如需修改请联系总台</text>
        </view>
        <view class="info-card" v-if="companyInfo">
          <view class="info-row">
            <text class="info-label">公司名称</text>
            <text class="info-value">{{ companyInfo.companyName || '—' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">负责人</text>
            <text class="info-value">{{ companyInfo.contactPerson || '—' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">联系电话</text>
            <text class="info-value">{{ companyInfo.contactMobile || '—' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">营业执照</text>
            <text class="info-value">{{ companyInfo.businessLicense || '—' }}</text>
          </view>
        </view>
        <view class="empty-state" v-else>
          <text class="empty-text">加载中...</text>
        </view>
      </view>

      <!-- 基本设置 / 通知设置：预警阈值配置 -->
      <view v-if="activeTab === 'basic' || activeTab === 'notification'" class="section">
        <view class="section-title">
          <text class="title-text">{{ activeTab === 'basic' ? '基本设置' : '通知设置' }}</text>
          <text class="title-tip">{{ activeTab === 'basic' ? '库存与过期预警阈值' : '预警触发后通过站内通知与推送提醒' }}</text>
        </view>
        <view class="form-card">
          <view class="form-row" v-for="field in configFields" :key="field.key">
            <text class="form-label">{{ field.label }}</text>
            <input
              class="form-input"
              v-model="configValues[field.key]"
              type="number"
              :placeholder="field.placeholder"
              placeholder-class="form-placeholder"
            />
            <text class="form-unit">{{ field.unit }}</text>
          </view>
          <view class="save-bar">
            <button class="save-btn" :loading="saving" :disabled="saving" @tap="saveConfigs">保存</button>
          </view>
        </view>
      </view>

      <!-- 关于系统 -->
      <view v-if="activeTab === 'about'" class="section">
        <view class="about-card">
          <view class="about-logo">
            <text class="logo-text">智享</text>
          </view>
          <text class="about-name">智享全链</text>
          <text class="about-version">版本 v{{ version }}</text>
          <text class="about-desc">面向酒水批发/零售的一体化经营管理平台</text>
          <view class="about-row">
            <text class="about-label">服务端</text>
            <text class="about-value">{{ apiBase }}</text>
          </view>
          <view class="about-row">
            <text class="about-label">更新状态</text>
            <text class="about-value">{{ versionNote }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { sysConfigApi, type SysConfigItem } from '@/api/modules/sys-config'

const tabs = [
  { label: '公司信息', value: 'company' },
  { label: '基本设置', value: 'basic' },
  { label: '通知设置', value: 'notification' },
  { label: '关于系统', value: 'about' },
]

const activeTab = ref('company')
const companyInfo = ref<any>(null)
const configFields = [
  { key: 'low_stock_threshold', label: '低库存预警阈值', placeholder: '库存低于该值触发预警', unit: '件' },
  { key: 'low_stock_critical', label: '低库存紧急阈值', placeholder: '库存低于该值触发紧急提醒', unit: '件' },
  { key: 'expiry_warning_days', label: '过期预警天数', placeholder: '临期商品提前提醒天数', unit: '天' },
  { key: 'expiry_critical_days', label: '过期紧急天数', placeholder: '临期商品紧急提醒天数', unit: '天' },
]
const configValues = reactive<Record<string, string>>({})
const saving = ref(false)

const version = '1.0.0'
const versionNote = ref('已是最新版本')
const apiBase = (() => {
  // #ifdef H5
  return import.meta.env.VITE_API_BASE || '/api'
  // #endif
  // #ifndef H5
  return 'https://api.onepan.cn/api'
  // #endif
})()

function switchTab(val: string) {
  activeTab.value = val
}

async function loadCompanyInfo() {
  try {
    const res: any = await sysConfigApi.getTenantInfo()
    companyInfo.value = res ?? null
  } catch (err) {
    console.error('加载公司信息失败:', err)
  }
}

async function loadConfigs() {
  try {
    const result: any = await sysConfigApi.getAll()
    const all: SysConfigItem[] = result?.all ?? []
    for (const field of configFields) {
      const found = all.find((c) => c.configKey === field.key)
      configValues[field.key] = found ? String(found.configValue ?? '') : ''
    }
  } catch (err) {
    console.error('加载系统配置失败:', err)
    uni.showToast({ title: '配置加载失败', icon: 'none' })
  }
}

async function saveConfigs() {
  saving.value = true
  try {
    const items = configFields
      .filter((field) => configValues[field.key] !== undefined && configValues[field.key] !== '')
      .map((field) => ({
        config_key: field.key,
        config_value: configValues[field.key],
      }))
    if (items.length === 0) {
      uni.showToast({ title: '暂无可保存的配置', icon: 'none' })
      return
    }
    await sysConfigApi.updateBatch(items)
    uni.showToast({ title: '保存成功', icon: 'none' })
  } catch (err) {
    console.error('保存系统配置失败:', err)
    uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const tab = current?.options?.tab
  if (tab && tabs.some((t) => t.value === tab)) {
    activeTab.value = tab
  }
  loadCompanyInfo()
  loadConfigs()
})
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.tab-bar {
  display: flex;
  background: $uni-bg-color;
  padding: 16rpx 24rpx;
  gap: 12rpx;
}
.tab-item {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 32rpx;
}
.tab-item--active {
  background: $uni-color-warning;
}
.tab-item--active .tab-text {
  color: $uni-text-color-inverse;
}
.tab-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}
.page-body {
  padding: 24rpx;
}
.section-title {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-bottom: 16rpx;
}
.title-text {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.title-tip {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.info-card,
.form-card,
.about-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 12rpx 24rpx;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-page;
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}
.info-value {
  font-size: 26rpx;
  color: $uni-gray-700;
  max-width: 60%;
  text-align: right;
}
.form-row {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-page;
}
.form-row:last-of-type {
  border-bottom: none;
}
.form-label {
  width: 200rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
}
.form-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 0 20rpx;
}
.form-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}
.form-unit {
  width: 60rpx;
  text-align: right;
  font-size: 24rpx;
  color: $uni-gray-400;
}
.save-bar {
  padding: 24rpx 0;
}
.save-btn {
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  color: $uni-text-color-inverse;
  background: $uni-color-warning;
  border-radius: 38rpx;
}
.empty-state {
  padding: 80rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}
.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx;
}
.about-logo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 28rpx;
  background: $uni-color-warning;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}
.logo-text {
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}
.about-name {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
  margin-bottom: 8rpx;
}
.about-version {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: 16rpx;
}
.about-desc {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: 32rpx;
}
.about-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-top: 1rpx solid $uni-bg-color-page;
}
.about-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}
.about-value {
  font-size: 24rpx;
  color: $uni-gray-700;
  max-width: 70%;
  text-align: right;
}
.safe-bottom {
  height: calc(env(safe-area-inset-bottom) + 24rpx);
}
</style>
