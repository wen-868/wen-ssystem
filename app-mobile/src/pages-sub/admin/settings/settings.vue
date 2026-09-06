<template>
  <view class="settings-page">
    <page-header title="系统设置" @back="goBack" />

    <scroll-view class="st-body" scroll-y>
      <view class="st-group" v-for="sec in FEATURE_SECTIONS" :key="sec.id">
        <view class="st-group-hd" @tap="toggleSection(sec.id)">
          <text class="st-group-title">{{ sec.title }}</text>
          <view class="st-group-hd-right">
            <text class="st-group-count">{{ sec.items.length }} 项</text>
            <text class="st-group-chevron" :class="{ 'st-group-chevron--open': expanded[sec.id] }">›</text>
          </view>
        </view>
        <view class="st-group-card" v-if="expanded[sec.id]">
          <view
            class="st-row"
            v-for="item in sec.items"
            :key="item.key"
            :class="{ 'st-row--link': item.control === 'link' }"
            @tap="onRowTap(item)"
          >
            <view class="st-row-info">
              <text class="st-row-label">{{ item.label }}</text>
              <text class="st-row-key" v-if="item.desc && item.control !== 'link'">{{ item.desc }}</text>
            </view>
            <view class="st-row-control">
              <switch
                v-if="item.control === 'switch'"
                :checked="isOn(values[item.key])"
                :color="COLOR_PRIMARY"
                @change="(e: any) => onSwitch(item.key, e)"
              />
              <picker
                v-else-if="item.control === 'select'"
                :range="item.options || []"
                :value="(item.options || []).indexOf(values[item.key] || '')"
                @change="(e: any) => onSelect(item.key, e, item)"
              >
                <view class="st-picker">
                  <text>{{ optionLabel(item, values[item.key]) }}</text>
                  <text class="st-picker-arrow">›</text>
                </view>
              </picker>
              <picker
                v-else-if="item.control === 'time'"
                mode="time"
                :value="values[item.key] || '00:00'"
                @change="(e: any) => onTime(item.key, e)"
              >
                <view class="st-picker">
                  <text>{{ values[item.key] || '00:00' }}</text>
                  <text class="st-picker-arrow">›</text>
                </view>
              </picker>
              <input
                v-else-if="item.control === 'number'"
                class="st-input"
                :value="values[item.key]"
                type="number"
                placeholder="请输入"
                placeholder-class="st-input-placeholder"
                @input="(e: any) => onInput(item.key, e)"
              />
              <text v-else-if="item.control === 'link'" class="st-row-arrow">›</text>
            </view>
          </view>
        </view>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="st-footer">
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
import { sysConfigApi } from '@/api/modules/sys-config'
import { COLOR_PRIMARY } from '@/constants/colors'

type ControlType = 'switch' | 'select' | 'time' | 'number' | 'link'

interface FeatureItem {
  key: string
  label: string
  desc?: string
  control: ControlType
  options?: string[]
  optionLabels?: string[]
  link?: string
}

interface FeatureSection {
  id: string
  title: string
  items: FeatureItem[]
}

/** 策展式功能配置：只呈现商家会设置的项，技术性/平台级配置不在此暴露 */
const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'notify',
    title: '通知提醒',
    items: [
      { key: 'notify_sms', label: '短信通知', desc: '订单、审批、库存变动短信提醒', control: 'switch' },
      { key: 'notify_push', label: 'App 消息推送', desc: '订单、库存、系统消息推送', control: 'switch' },
    ],
  },
  {
    id: 'backup',
    title: '数据与备份',
    items: [
      { key: 'backup_auto', label: '自动备份', desc: '按周期自动备份数据', control: 'switch' },
      {
        key: 'backup_frequency',
        label: '备份周期',
        control: 'select',
        options: ['daily', 'weekly', 'monthly'],
        optionLabels: ['每日', '每周', '每月'],
      },
      { key: 'backup_time', label: '备份时间点', control: 'time' },
      { key: 'backup_retention_days', label: '保留天数', control: 'number' },
    ],
  },
  {
    id: 'biz',
    title: '业务流程',
    items: [
      { key: 'approval_enabled', label: '单据审批', desc: '采购、销售、盘点单据需审批', control: 'switch' },
      { key: 'print', label: '单据打印', desc: '小票、采购、盘点打印设置', control: 'link', link: '/pages-sub/admin/print/print-records' },
    ],
  },
  {
    id: 'sys',
    title: '系统管理',
    items: [
      { key: 'oplog', label: '操作日志', desc: '系统操作记录', control: 'link', link: '/pages-sub/admin/system/operation-logs' },
      { key: 'report_perm', label: '报表权限', desc: '报表数据权限配置', control: 'link', link: '/pages-sub/admin/report-permission/index' },
    ],
  },
]

const DEFAULTS: Record<string, string> = {
  notify_sms: '1',
  notify_push: '1',
  backup_auto: '0',
  backup_frequency: 'daily',
  backup_time: '02:00',
  backup_retention_days: '30',
  approval_enabled: '0',
}

const loading = ref(false)
const saving = ref(false)
const expanded = ref<Record<string, boolean>>({})
const values = ref<Record<string, string>>({})
const originals = ref<Record<string, string>>({})

function toggleSection(id: string) {
  expanded.value[id] = !expanded.value[id]
}

function isOn(v?: string): boolean {
  return v === '1' || v === 'true'
}

function optionLabel(item: FeatureItem, v?: string): string {
  const i = (item.options || []).indexOf(v || '')
  if (i >= 0) return item.optionLabels?.[i] ?? v ?? ''
  return (item.options?.[0] ?? v ?? '')
}

function onSwitch(key: string, e: any) {
  values.value[key] = e.detail.value ? '1' : '0'
}
function onSelect(key: string, e: any, item: FeatureItem) {
  values.value[key] = (item.options || [])[Number(e.detail.value)]
}
function onTime(key: string, e: any) {
  values.value[key] = e.detail.value ?? ''
}
function onInput(key: string, e: any) {
  values.value[key] = e.detail.value ?? ''
}
function onRowTap(item: FeatureItem) {
  if (item.control === 'link' && item.link) uni.navigateTo({ url: item.link })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/functions/functions' })
}

const changedRows = computed(() => {
  const out: Array<{ config_key: string; config_value: string }> = []
  for (const s of FEATURE_SECTIONS) {
    for (const it of s.items) {
      if (it.control === 'link') continue
      if (values.value[it.key] !== originals.value[it.key]) {
        out.push({ config_key: it.key, config_value: values.value[it.key] })
      }
    }
  }
  return out
})

async function loadConfigs() {
  loading.value = true
  try {
    const result = await sysConfigApi.getAll()
    const grouped = result?.grouped ?? {}
    const map: Record<string, string> = {}
    for (const rows of Object.values(grouped) as Array<Array<{ configKey?: string; configValue?: string }>>) {
      for (const row of rows) if (row?.configKey != null) map[row.configKey] = row.configValue ?? ''
    }
    const v: Record<string, string> = {}
    const o: Record<string, string> = {}
    for (const s of FEATURE_SECTIONS) {
      for (const it of s.items) {
        if (it.control === 'link') continue
        const base = map[it.key] ?? DEFAULTS[it.key] ?? ''
        v[it.key] = base
        o[it.key] = base
      }
    }
    values.value = v
    originals.value = o
  } catch (err) {
    console.error('加载系统配置失败:', err)
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (changedRows.value.length === 0 || saving.value) return
  saving.value = true
  try {
    await sysConfigApi.updateBatch(changedRows.value)
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

.st-body {
  height: calc(100vh - 220rpx - var(--safe-top));
  padding: $uni-spacing-md $uni-spacing-base 0;
  box-sizing: border-box;
}

.st-group {
  margin-bottom: $uni-spacing-base;
}

.st-group-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $uni-spacing-xs $uni-spacing-sm;
  cursor: pointer;
}
.st-group-hd:active {
  opacity: 0.7;
}
.st-group-hd-right {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
}

.st-group-title {
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.st-group-count {
  font-size: 22rpx;
  color: $uni-gray-300;
}
.st-group-chevron {
  font-size: 28rpx;
  color: $uni-gray-300;
  transition: transform 0.2s ease;
  transform: rotate(0deg);
}
.st-group-chevron--open {
  transform: rotate(90deg);
}

.st-group-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $uni-spacing-base;
  padding: $uni-spacing-base;
  border-bottom: 1rpx solid $zx-black-40;
}
.st-row:last-child {
  border-bottom: none;
}
.st-row--link {
  cursor: pointer;
}
.st-row--link:active {
  background: $uni-bg-color-page;
}

.st-row-info {
  flex: 1;
  min-width: 0;
}
.st-row-label {
  display: block;
  font-size: 24rpx;
  font-weight: 500;
  color: $uni-text-color;
}
.st-row-key {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-500;
  margin-top: 6rpx;
}

.st-row-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.st-input {
  width: 260rpx;
  height: 68rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-md;
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
  box-sizing: border-box;
}
.st-input-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}

.st-picker {
  min-width: 200rpx;
  height: 68rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-md;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $uni-spacing-xs;
  font-size: 26rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.st-picker-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.st-row-arrow {
  font-size: 34rpx;
  color: $uni-gray-300;
}

.st-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: $uni-spacing-sm $uni-spacing-base calc($uni-spacing-sm + env(safe-area-inset-bottom));
  background: $zx-white-920;
  backdrop-filter: blur(20px);
  border-top: 1rpx solid $zx-black-50;
}
.st-footer-btn {
  height: 88rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 28rpx $zx-primary-280;
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

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
