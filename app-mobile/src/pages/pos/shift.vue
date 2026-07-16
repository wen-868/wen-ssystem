<template>
  <view class="shift-page">
    <view class="page-header">
      <text class="header-title">交接班</text>
    </view>

    <!-- 当前班次状态卡 -->
    <view class="status-card">
      <view class="status-card-top">
        <view class="status-info">
          <text class="status-label">当前班次</text>
          <text class="status-value" v-if="currentShift">{{ getShiftTypeLabel(currentShift.shiftType) }}</text>
          <text class="status-value status-value--idle" v-else>未开班</text>
        </view>
        <view class="status-action">
          <button
            class="primary-btn"
            v-if="!currentShift"
            :disabled="submitting"
            @tap="onOpenShift"
          >{{ submitting ? '处理中...' : '开班' }}</button>
          <button
            class="primary-btn primary-btn--warn"
            v-else
            :disabled="submitting"
            @tap="showCompletePanel"
          >结班交接</button>
        </view>
      </view>
      <view class="status-card-detail" v-if="currentShift">
        <view class="detail-row">
          <text class="detail-label">开始时间</text>
          <text class="detail-value">{{ currentShift.startTime }}</text>
        </view>
        <view class="detail-row" v-if="currentShift.operatorName">
          <text class="detail-label">操作人</text>
          <text class="detail-value">{{ currentShift.operatorName }}</text>
        </view>
      </view>
    </view>

    <!-- 班次记录列表 -->
    <view class="section-title">
      <text class="section-text">历史记录</text>
    </view>

    <scroll-view
      class="shift-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="shift-card" v-for="item in list" :key="item.id" @tap="goDetail(item)">
        <view class="card-header">
          <view class="shift-type" :class="'type-' + item.shiftType">
            <text class="type-text">{{ getShiftTypeLabel(item.shiftType) }}</text>
          </view>
          <view class="shift-state" :class="'state-' + (item.status || 'completed')">
            <text class="state-text">{{ getStateLabel(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">开始</text>
            <text class="info-value">{{ item.startTime }}</text>
          </view>
          <view class="info-row" v-if="item.endTime">
            <text class="info-label">结束</text>
            <text class="info-value">{{ item.endTime }}</text>
          </view>
          <view class="info-row" v-if="item.operatorName">
            <text class="info-label">操作人</text>
            <text class="info-value">{{ item.operatorName }}</text>
          </view>
          <view class="amount-summary" v-if="item.actualCash != null || item.actualWechat != null">
            <view class="amount-item">
              <text class="amount-label">现金</text>
              <text class="amount-value">¥{{ Number(item.actualCash || 0).toFixed(2) }}</text>
            </view>
            <view class="amount-item">
              <text class="amount-label">微信</text>
              <text class="amount-value">¥{{ Number(item.actualWechat || 0).toFixed(2) }}</text>
            </view>
            <view class="amount-item">
              <text class="amount-label">支付宝</text>
              <text class="amount-value">¥{{ Number(item.actualAlipay || 0).toFixed(2) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="load-tip" v-if="loading">
        <text class="load-tip-text">加载中...</text>
      </view>
      <view class="load-tip" v-else-if="noMore">
        <text class="load-tip-text">没有更多了</text>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无交接班记录</text>
    </view>

    <view class="safe-bottom"></view>

    <!-- 结班面板 -->
    <view class="mask" v-if="completePanelVisible" @tap="hideCompletePanel"></view>
    <view class="complete-panel" :class="{ 'complete-panel--show': completePanelVisible }" v-if="currentShift">
      <view class="panel-header">
        <text class="panel-title">结班交接</text>
        <text class="panel-close" @tap="hideCompletePanel">&#xe615;</text>
      </view>
      <scroll-view class="panel-body" scroll-y>
        <view class="panel-section">
          <text class="panel-section-title">实收金额填写</text>
          <view class="form-row">
            <text class="form-label">现金</text>
            <input class="form-input" v-model="completeForm.actualCash" type="digit" placeholder="0.00" />
          </view>
          <view class="form-row">
            <text class="form-label">微信</text>
            <input class="form-input" v-model="completeForm.actualWechat" type="digit" placeholder="0.00" />
          </view>
          <view class="form-row">
            <text class="form-label">支付宝</text>
            <input class="form-input" v-model="completeForm.actualAlipay" type="digit" placeholder="0.00" />
          </view>
        </view>
        <view class="panel-section">
          <text class="panel-section-title">备注</text>
          <textarea
            class="form-textarea"
            v-model="completeForm.remark"
            placeholder="请输入交接备注（选填）"
            placeholder-class="form-placeholder"
          />
        </view>
      </scroll-view>
      <view class="panel-footer">
        <button class="cancel-btn" @tap="hideCompletePanel">取消</button>
        <button class="primary-btn" :disabled="submitting" @tap="onCompleteShift">
          {{ submitting ? '提交中...' : '确认结班' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { storeApi, type ShiftRecord } from '@/api/modules/store'

const list = ref<ShiftRecord[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
const submitting = ref(false)

const currentShift = ref<ShiftRecord | null>(null)
const completePanelVisible = ref(false)
const completeForm = reactive({
  actualCash: '',
  actualWechat: '',
  actualAlipay: '',
  remark: '',
})

function getShiftTypeLabel(type: string): string {
  const map: Record<string, string> = {
    morning: '早班',
    noon: '午班',
    evening: '晚班',
    day: '全天班',
    night: '夜班',
  }
  return map[type] || type
}

function getStateLabel(status?: string): string {
  const map: Record<string, string> = {
    active: '进行中',
    completed: '已结班',
    ongoing: '进行中',
  }
  return map[status || 'completed'] || status || '已结班'
}

function goDetail(item: ShiftRecord) {
  uni.navigateTo({ url: `/pages/pos/shift?shiftId=${item.id}` })
}

async function loadShifts() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchShifts({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
    // 找出进行中的班次
    const active = rows.find((r: ShiftRecord) => r.status === 'active' || r.status === 'ongoing')
    if (active) currentShift.value = active
  } catch (err) {
    console.error('加载交接班记录失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadShifts()
}

async function onOpenShift() {
  const now = new Date()
  const hour = now.getHours()
  let shiftType = 'morning'
  if (hour >= 11 && hour < 14) shiftType = 'noon'
  else if (hour >= 14 && hour < 18) shiftType = 'evening'
  else if (hour >= 18) shiftType = 'night'

  uni.showModal({
    title: '确认开班',
    content: `当前时段为「${getShiftTypeLabel(shiftType)}」，确认开班吗？`,
    success: async (res) => {
      if (!res.confirm) return
      submitting.value = true
      try {
        uni.showLoading({ title: '开班中...' })
        const record = await storeApi.createShift({
          shiftType,
          startTime: formatTime(now),
        })
        currentShift.value = record
        uni.showToast({ title: '开班成功', icon: 'success' })
        page.value = 1
        loadShifts()
      } catch (err) {
        console.error('开班失败:', err)
      } finally {
        submitting.value = false
        uni.hideLoading()
      }
    },
  })
}

function showCompletePanel() {
  completeForm.actualCash = ''
  completeForm.actualWechat = ''
  completeForm.actualAlipay = ''
  completeForm.remark = ''
  completePanelVisible.value = true
}

function hideCompletePanel() {
  completePanelVisible.value = false
}

async function onCompleteShift() {
  if (!currentShift.value) return
  submitting.value = true
  try {
    uni.showLoading({ title: '提交中...' })
    await storeApi.completeShift(currentShift.value.id, {
      endTime: formatTime(new Date()),
      actualCash: completeForm.actualCash ? Number(completeForm.actualCash) : undefined,
      actualWechat: completeForm.actualWechat ? Number(completeForm.actualWechat) : undefined,
      actualAlipay: completeForm.actualAlipay ? Number(completeForm.actualAlipay) : undefined,
      remark: completeForm.remark || undefined,
    })
    uni.showToast({ title: '结班成功', icon: 'success' })
    currentShift.value = null
    completePanelVisible.value = false
    page.value = 1
    loadShifts()
  } catch (err) {
    console.error('结班失败:', err)
  } finally {
    submitting.value = false
    uni.hideLoading()
  }
}

function formatTime(date: Date): string {
  const pad = (n: number) => n < 10 ? '0' + n : '' + n
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

onMounted(() => { loadShifts() })
</script>

<style scoped>
.shift-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.status-card {
  margin: 16rpx 24rpx; background: #fff;
  border-radius: 16rpx; padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.status-card-top {
  display: flex; justify-content: space-between; align-items: center;
}
.status-info { display: flex; flex-direction: column; gap: 8rpx; }
.status-label { font-size: 24rpx; color: #999; }
.status-value { font-size: 36rpx; color: #333; font-weight: 700; }
.status-value--idle { color: #bbb; }
.primary-btn {
  height: 72rpx; padding: 0 40rpx; line-height: 72rpx;
  background: #fa8c16; color: #fff; border-radius: 36rpx;
  font-size: 28rpx; border: none;
}
.primary-btn--warn { background: #ff4d4f; }
.primary-btn[disabled] { background: #ccc; color: #fff; }
.status-card-detail {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  display: flex; flex-direction: column; gap: 10rpx;
}
.detail-row { display: flex; justify-content: space-between; }
.detail-label { font-size: 24rpx; color: #999; }
.detail-value { font-size: 26rpx; color: #333; }

.section-title { padding: 24rpx 32rpx 8rpx; }
.section-text { font-size: 28rpx; color: #666; font-weight: 600; }

.shift-list { padding: 0 24rpx; height: calc(100vh - 460rpx); }
.shift-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.shift-type { padding: 4rpx 16rpx; border-radius: 8rpx; background: #e6f7ff; }
.shift-type .type-text { color: #1677FF; font-size: 22rpx; }
.type-morning { background: #fff7e6; }
.type-morning .type-text { color: #fa8c16; }
.type-noon { background: #fff2e8; }
.type-noon .type-text { color: #ff7a45; }
.type-evening { background: #f0f5ff; }
.type-evening .type-text { color: #2f54eb; }
.type-night { background: #f9f0ff; }
.type-night .type-text { color: #722ed1; }
.shift-state { padding: 4rpx 16rpx; border-radius: 20rpx; }
.state-active, .state-ongoing { background: #fff7e6; }
.state-active .state-text, .state-ongoing .state-text { color: #fa8c16; }
.state-completed { background: #f6ffed; }
.state-completed .state-text { color: #52c41a; }
.state-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.amount-summary {
  display: flex; gap: 16rpx; margin-top: 16rpx;
  padding: 16rpx; background: #fafafa; border-radius: 12rpx;
}
.amount-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.amount-label { font-size: 22rpx; color: #999; }
.amount-value { font-size: 26rpx; color: #fa8c16; font-weight: 600; }

.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }

.mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); z-index: 200;
}
.complete-panel {
  position: fixed; left: 0; right: 0; bottom: 0;
  max-height: 80vh; background: #fff;
  border-radius: 24rpx 24rpx 0 0; z-index: 201;
  display: flex; flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx; border-bottom: 1rpx solid #f0f0f0;
}
.panel-title { font-size: 30rpx; color: #333; font-weight: 600; }
.panel-close { font-size: 36rpx; color: #999; }
.panel-body { padding: 24rpx; max-height: 50vh; }
.panel-section { margin-bottom: 24rpx; }
.panel-section-title {
  font-size: 26rpx; color: #666; font-weight: 600;
  margin-bottom: 16rpx; display: block;
}
.form-row {
  display: flex; align-items: center;
  height: 80rpx; margin-bottom: 12rpx;
  background: #f5f7fa; border-radius: 12rpx; padding: 0 24rpx;
}
.form-label { font-size: 26rpx; color: #666; width: 120rpx; }
.form-input { flex: 1; font-size: 28rpx; color: #333; }
.form-textarea {
  width: 100%; height: 120rpx; padding: 16rpx 24rpx;
  background: #f5f7fa; border-radius: 12rpx;
  font-size: 26rpx; color: #333; box-sizing: border-box;
}
.form-placeholder { color: #bbb; }
.panel-footer {
  display: flex; gap: 16rpx; padding: 16rpx 24rpx 24rpx;
  border-top: 1rpx solid #f0f0f0;
}
.cancel-btn {
  flex: 1; height: 80rpx; line-height: 80rpx;
  background: #f5f7fa; color: #666; border-radius: 40rpx;
  font-size: 28rpx; border: none;
}
</style>
