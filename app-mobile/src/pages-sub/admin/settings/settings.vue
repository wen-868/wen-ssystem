<template>
  <view class="settings-page">
    <!-- 页头 -->
    <page-header title="系统设置" @back="goBack" />

    <!-- 配置分组 -->
    <scroll-view class="st-body" scroll-y v-if="groups.length > 0">
      <view class="st-group" v-for="group in groups" :key="group.key">
        <view class="st-group-hd">
          <text class="st-group-title">{{ groupLabel(group.key) }}</text>
          <text class="st-group-count">{{ group.items.length }} 项</text>
        </view>
        <view class="st-group-card">
          <view class="st-row" v-for="row in group.items" :key="row.key">
            <view class="st-row-info">
              <text class="st-row-label">{{ row.description || row.key }}</text>
              <text class="st-row-key">{{ row.key }}</text>
            </view>
            <view class="st-row-control">
              <switch
                v-if="isBooleanValue(row.original)"
                :checked="isOn(row.value)"
                :color="COLOR_PRIMARY"
                @change="(e: any) => onToggle(row, e)"
              />
              <input
                v-else
                class="st-input"
                :value="row.value"
                type="text"
                :placeholder="row.original || '请输入'"
                placeholder-class="st-input-placeholder"
                @input="(e: any) => onInput(row, e)"
              />
            </view>
          </view>
        </view>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无系统配置</text>
    </view>

    <!-- 保存栏 -->
    <view class="st-footer" v-if="groups.length > 0">
      <view class="st-footer-btn" :class="{ 'st-footer-btn--disabled': changedRows.length === 0 || saving }" @tap="onSave">
        <text class="st-footer-text">
          {{ saving ? '保存中...' : changedRows.length > 0 ? `保存 ${changedRows.length} 项修改` : '保存' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { sysConfigApi, type SysConfigItem } from '@/api/modules/sys-config'
import { COLOR_PRIMARY } from '@/constants/colors'

interface ConfigRow {
  key: string
  group: string
  description: string
  original: string
  value: string
}

interface ConfigGroup {
  key: string
  items: ConfigRow[]
}

const GROUP_LABEL_MAP: Record<string, string> = {
  system: '系统',
  wechat: '微信',
  payment: '支付',
  enterprise: '企业信息',
  print: '打印',
  permission: '权限',
  notification: '通知',
  other: '其他',
}

const groups = ref<ConfigGroup[]>([])
const loading = ref(false)
const saving = ref(false)

const changedRows = computed(() => {
  const changed: ConfigRow[] = []
  for (const group of groups.value) {
    for (const row of group.items) {
      if (row.value !== row.original) changed.push(row)
    }
  }
  return changed
})

function groupLabel(key: string): string {
  return GROUP_LABEL_MAP[key] || key
}

function isBooleanValue(value: string): boolean {
  return /^(0|1|true|false)$/i.test(value.trim())
}

function isOn(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true'
}

function onInput(row: ConfigRow, e: any) {
  row.value = e.detail.value ?? ''
}

function onToggle(row: ConfigRow, e: any) {
  row.value = e.detail.value ? '1' : '0'
}

function toRows(items: SysConfigItem[]): ConfigRow[] {
  return items.map((item) => ({
    key: item.configKey,
    group: item.configGroup,
    description: item.description || '',
    original: item.configValue ?? '',
    value: item.configValue ?? '',
  }))
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/functions/functions' })
  }
}

async function loadConfigs() {
  loading.value = true
  try {
    const result = await sysConfigApi.getAll()
    const grouped = result?.grouped ?? {}
    const groupKeys = Object.keys(grouped)
    groups.value = groupKeys.map((key) => ({
      key,
      items: toRows(grouped[key] ?? []),
    }))
  } catch (err) {
    console.error('加载系统配置失败:', err)
    groups.value = []
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (changedRows.value.length === 0 || saving.value) return
  saving.value = true
  try {
    const items = changedRows.value.map((row) => ({
      config_key: row.key,
      config_value: row.value,
    }))
    await sysConfigApi.updateBatch(items)
    uni.showToast({ title: '保存成功', icon: 'success' })
    await loadConfigs()
  } catch (err) {
    console.error('保存系统配置失败:', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

/* 页头 */
.st-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
}

/* 分组 */
.st-body {
  height: calc(100vh - 220rpx - env(safe-area-inset-top));
  padding: 20rpx 28rpx 0;
  box-sizing: border-box;
}

.st-group {
  margin-bottom: 28rpx;
}

.st-group-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 14rpx;
}

.st-group-title {
  font-size: 26rpx;
  font-weight: 700;
  color: $uni-gray-700;
}

.st-group-count {
  font-size: 22rpx;
  color: $uni-gray-300;
}

.st-group-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 24rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.st-row:last-child {
  border-bottom: none;
}

.st-row-info {
  flex: 1;
  min-width: 0;
}

.st-row-label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.st-row-key {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-300;
  margin-top: 6rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.st-row-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.st-input {
  width: 300rpx;
  height: 68rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
  box-sizing: border-box;
}

.st-input-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}

/* 保存栏 */
.st-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
}

.st-footer-btn {
  height: 88rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 28rpx rgba(37, 99, 235, 0.28);
}

.st-footer-btn:active {
  transform: scale(0.98);
}

.st-footer-btn--disabled {
  opacity: 0.5;
  box-shadow: none;
}

.st-footer-text {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
