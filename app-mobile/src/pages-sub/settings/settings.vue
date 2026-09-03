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

      <!-- 账号安全（双因素认证） -->
      <view v-if="activeTab === 'security'" class="section">
        <view class="section-title">
          <text class="title-text">账号安全</text>
          <text class="title-tip">开启后登录需输入动态验证码（TOTP，支持主流验证器 App）</text>
        </view>
        <view class="form-card">
          <view class="mfa-status-row">
            <text class="mfa-status-label">双因素认证</text>
            <text class="mfa-status-value" :class="mfa.enabled ? 'on' : 'off'">
              {{ mfa.enabled ? '已开启' : '未开启' }}
            </text>
          </view>

          <!-- 未开启：绑定流程 -->
          <template v-if="!mfa.enabled">
            <view class="mfa-secret-box" v-if="mfa.setupData">
              <text class="mfa-secret-title">1. 在验证器 App 中添加密钥</text>
              <text class="mfa-secret-key" selectable>{{ mfa.setupData.secret }}</text>
              <text class="mfa-secret-hint">或使用验证器扫码（otpauth 地址）</text>
              <text class="mfa-secret-hint">{{ mfa.setupData.otpauthUrl }}</text>
              <text class="mfa-secret-title">2. 输入 App 生成的 6 位验证码确认</text>
              <input
                class="form-input mfa-code-input"
                v-model="mfaCode"
                type="number"
                maxlength="6"
                placeholder="6 位动态验证码"
                placeholder-class="form-placeholder"
              />
              <button class="save-btn mfa-btn" :loading="mfaBusy" @tap="confirmMfa">确认开启</button>
            </view>
            <button v-else class="save-btn mfa-btn" :loading="mfaBusy" @tap="startSetup">开启双因素认证</button>
          </template>

          <!-- 已开启：关闭流程 -->
          <template v-else>
            <view class="mfa-secret-box">
              <text class="mfa-secret-title">关闭需输入当前动态验证码</text>
              <input
                class="form-input mfa-code-input"
                v-model="mfaCode"
                type="number"
                maxlength="6"
                placeholder="6 位动态验证码"
                placeholder-class="form-placeholder"
              />
              <button class="save-btn mfa-btn mfa-btn--danger" :loading="mfaBusy" @tap="closeMfa">关闭双因素认证</button>
            </view>
          </template>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { sysConfigApi, type SysConfigItem } from '@/api/modules/sys-config'
import { authApi } from '@/api/modules/auth'
import { API_BASE_H5, API_BASE_NATIVE } from '@/config/env'

const tabs = [
  { label: '公司信息', value: 'company' },
  { label: '基本设置', value: 'basic' },
  { label: '通知设置', value: 'notification' },
  { label: '账号安全', value: 'security' },
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
const mfa = reactive<{ enabled: boolean; setupData: { secret: string; otpauthUrl: string } | null }>({
  enabled: false,
  setupData: null,
})
const mfaCode = ref('')
const mfaBusy = ref(false)

const version = '1.0.0'
const versionNote = ref('已是最新版本')
const apiBase = (() => {
  // #ifdef H5
  return API_BASE_H5
  // #endif
  // #ifndef H5
  return API_BASE_NATIVE
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

async function loadMfaStatus() {
  try {
    const res = await authApi.getMfaStatus()
    mfa.enabled = res.enabled
  } catch (err) {
    console.error('加载 MFA 状态失败:', err)
  }
}

async function startSetup() {
  mfaBusy.value = true
  try {
    const res = await authApi.setupMfa()
    mfa.setupData = { secret: res.secret, otpauthUrl: res.otpauthUrl }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '开启失败', icon: 'none' })
  } finally {
    mfaBusy.value = false
  }
}

async function confirmMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    uni.showToast({ title: '请输入 6 位验证码', icon: 'none' })
    return
  }
  mfaBusy.value = true
  try {
    await authApi.confirmMfa(mfaCode.value)
    mfa.enabled = true
    mfa.setupData = null
    mfaCode.value = ''
    uni.showToast({ title: '双因素认证已开启', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '验证失败', icon: 'none' })
  } finally {
    mfaBusy.value = false
  }
}

async function closeMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    uni.showToast({ title: '请输入 6 位验证码', icon: 'none' })
    return
  }
  uni.showModal({
    title: '关闭双因素认证',
    content: '关闭后账号仅凭密码登录，安全性降低，确认关闭？',
    success: async (res) => {
      if (!res.confirm) return
      mfaBusy.value = true
      try {
        await authApi.disableMfa(mfaCode.value)
        mfa.enabled = false
        mfaCode.value = ''
        uni.showToast({ title: '已关闭', icon: 'success' })
      } catch (err: any) {
        uni.showToast({ title: err?.message || '关闭失败', icon: 'none' })
      } finally {
        mfaBusy.value = false
      }
    },
  })
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
  loadMfaStatus()
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
.mfa-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-page;
}
.mfa-status-label {
  font-size: 26rpx;
  color: $uni-gray-700;
}
.mfa-status-value {
  font-size: 26rpx;
  font-weight: 600;
}
.mfa-status-value.on {
  color: $uni-color-success;
}
.mfa-status-value.off {
  color: $uni-gray-400;
}
.mfa-secret-box {
  padding: 20rpx 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.mfa-secret-title {
  font-size: 24rpx;
  color: $uni-gray-700;
  margin-top: 8rpx;
}
.mfa-secret-key {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-color-primary;
  letter-spacing: 2rpx;
}
.mfa-secret-hint {
  font-size: 20rpx;
  color: $uni-gray-400;
  word-break: break-all;
}
.mfa-code-input {
  margin-top: 8rpx;
}
.mfa-btn {
  margin-top: 8rpx;
}
.mfa-btn--danger {
  background: $uni-color-error;
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
