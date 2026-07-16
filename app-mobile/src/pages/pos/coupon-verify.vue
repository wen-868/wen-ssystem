<template>
  <view class="coupon-verify-page">
    <view class="page-header">
      <text class="header-title">优惠券核销</text>
    </view>

    <!-- 核销入口 -->
    <view class="verify-entry">
      <view class="entry-card" @tap="onScanCode">
        <text class="entry-icon">&#xe617;</text>
        <text class="entry-title">扫码核销</text>
        <text class="entry-desc">扫描顾客优惠券二维码</text>
      </view>
      <view class="entry-card" @tap="showManualPanel">
        <text class="entry-icon">&#xe614;</text>
        <text class="entry-title">手动核销</text>
        <text class="entry-desc">输入券码进行核销</text>
      </view>
    </view>

    <!-- 核销结果 -->
    <view class="verify-result" v-if="verifyResult">
      <view class="result-card" :class="{ 'result-card--valid': verifyResult.valid, 'result-card--invalid': !verifyResult.valid }">
        <view class="result-status">
          <text class="status-icon">{{ verifyResult.valid ? '&#xe618;' : '&#xe619;' }}</text>
          <text class="status-text">{{ verifyResult.valid ? '核销成功' : '核销失败' }}</text>
        </view>
        <view class="result-detail">
          <view class="detail-row" v-if="verifyResult.code">
            <text class="detail-label">券码</text>
            <text class="detail-value">{{ verifyResult.code }}</text>
          </view>
          <view class="detail-row" v-if="verifyResult.name">
            <text class="detail-label">名称</text>
            <text class="detail-value">{{ verifyResult.name }}</text>
          </view>
          <view class="detail-row" v-if="verifyResult.faceValue != null">
            <text class="detail-label">面值</text>
            <text class="detail-value info-value--price">¥{{ Number(verifyResult.faceValue).toFixed(2) }}</text>
          </view>
          <view class="detail-row" v-if="verifyResult.minValue != null">
            <text class="detail-label">最低消费</text>
            <text class="detail-value">¥{{ Number(verifyResult.minValue).toFixed(2) }}</text>
          </view>
          <view class="detail-row" v-if="verifyResult.expireAt">
            <text class="detail-label">有效期</text>
            <text class="detail-value">{{ verifyResult.expireAt }}</text>
          </view>
          <view class="detail-row" v-if="verifyResult.message">
            <text class="detail-label">提示</text>
            <text class="detail-value">{{ verifyResult.message }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 优惠券记录 -->
    <view class="section-title">
      <text class="section-text">核销记录</text>
    </view>

    <scroll-view
      class="coupon-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="coupon-card" v-for="item in list" :key="item.id">
        <view class="coupon-left">
          <text class="coupon-value">¥{{ Number(item.faceValue || 0).toFixed(2) }}</text>
          <text class="coupon-min" v-if="item.minValue">满{{ item.minValue }}可用</text>
        </view>
        <view class="coupon-right">
          <text class="coupon-name">{{ item.name || item.code }}</text>
          <text class="coupon-code" v-if="item.code">券码：{{ item.code }}</text>
          <text class="coupon-status" :class="'status-' + item.status">{{ getCouponStatusLabel(item.status) }}</text>
          <text class="coupon-time" v-if="item.usedAt">核销：{{ item.usedAt }}</text>
          <text class="coupon-time" v-else-if="item.expireAt">到期：{{ item.expireAt }}</text>
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
      <text class="empty-text">暂无优惠券记录</text>
    </view>

    <view class="safe-bottom"></view>

    <!-- 手动核销面板 -->
    <view class="mask" v-if="manualPanelVisible" @tap="hideManualPanel"></view>
    <view class="manual-panel" :class="{ 'manual-panel--show': manualPanelVisible }">
      <view class="panel-header">
        <text class="panel-title">手动核销</text>
        <text class="panel-close" @tap="hideManualPanel">&#xe615;</text>
      </view>
      <view class="panel-body">
        <view class="form-row">
          <text class="form-label">券码</text>
          <input
            class="form-input"
            v-model="manualCode"
            type="text"
            placeholder="请输入优惠券码"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-row">
          <text class="form-label">关联单号</text>
          <input
            class="form-input"
            v-model="manualBillNo"
            type="text"
            placeholder="选填，关联销售单号"
            placeholder-class="form-placeholder"
          />
        </view>
      </view>
      <view class="panel-footer">
        <button class="cancel-btn" @tap="hideManualPanel">取消</button>
        <button class="primary-btn" :disabled="verifying" @tap="onManualVerify">
          {{ verifying ? '核销中...' : '确认核销' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { storeApi, type StoreCoupon, type CouponVerifyResult } from '@/api/modules/store'

const verifyResult = ref<CouponVerifyResult | null>(null)
const manualPanelVisible = ref(false)
const manualCode = ref('')
const manualBillNo = ref('')
const verifying = ref(false)

const list = ref<StoreCoupon[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function getCouponStatusLabel(status: string): string {
  const map: Record<string, string> = {
    unused: '未使用',
    used: '已核销',
    expired: '已过期',
    disabled: '已作废',
  }
  return map[status] || status
}

function showManualPanel() {
  manualCode.value = ''
  manualBillNo.value = ''
  verifyResult.value = null
  manualPanelVisible.value = true
}

function hideManualPanel() {
  manualPanelVisible.value = false
}

function onScanCode() {
  uni.scanCode?.({
    onlyFromCamera: false,
    success: async (res: any) => {
      const code = res.result || ''
      if (!code) {
        uni.showToast({ title: '未识别到券码', icon: 'none' })
        return
      }
      await doVerify(code)
    },
    fail: () => {
      uni.showToast({ title: '扫码取消或失败', icon: 'none' })
    },
  })
}

async function onManualVerify() {
  if (!manualCode.value.trim()) {
    uni.showToast({ title: '请输入券码', icon: 'none' })
    return
  }
  await doVerify(manualCode.value.trim(), manualBillNo.value.trim() || undefined)
}

async function doVerify(code: string, saleBillNo?: string) {
  verifying.value = true
  try {
    uni.showLoading({ title: '核销中...' })
    const result = saleBillNo
      ? await storeApi.manualVerifyCoupon({ couponCode: code, saleBillNo })
      : await storeApi.verifyCoupon(code)
    verifyResult.value = result
    if (result.valid) {
      uni.showToast({ title: '核销成功', icon: 'success' })
      hideManualPanel()
      // 刷新记录
      page.value = 1
      loadCoupons()
    } else {
      uni.showToast({ title: result.message || '核销失败', icon: 'none' })
    }
  } catch (err) {
    console.error('核销失败:', err)
  } finally {
    verifying.value = false
    uni.hideLoading()
  }
}

async function loadCoupons() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchCoupons({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载优惠券记录失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadCoupons()
}

onMounted(() => { loadCoupons() })
</script>

<style scoped>
.coupon-verify-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.verify-entry {
  display: flex; gap: 16rpx;
  padding: 16rpx 24rpx;
}
.entry-card {
  flex: 1; background: #fff; border-radius: 16rpx;
  padding: 32rpx 24rpx; display: flex; flex-direction: column;
  align-items: center; gap: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.entry-icon { font-size: 56rpx; color: #fa8c16; }
.entry-title { font-size: 28rpx; color: #333; font-weight: 600; }
.entry-desc { font-size: 22rpx; color: #999; }

.verify-result { padding: 0 24rpx; }
.result-card {
  border-radius: 16rpx; padding: 32rpx;
  margin-bottom: 16rpx;
}
.result-card--valid { background: #f6ffed; border: 2rpx solid #52c41a; }
.result-card--invalid { background: #fff2f0; border: 2rpx solid #ff4d4f; }
.result-status {
  display: flex; align-items: center; gap: 12rpx;
  padding-bottom: 16rpx; margin-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
}
.status-icon { font-size: 40rpx; }
.result-card--valid .status-icon, .result-card--valid .status-text { color: #52c41a; }
.result-card--invalid .status-icon, .result-card--invalid .status-text { color: #ff4d4f; }
.status-text { font-size: 32rpx; font-weight: 600; }
.result-detail { display: flex; flex-direction: column; gap: 12rpx; }
.detail-row { display: flex; justify-content: space-between; }
.detail-label { font-size: 24rpx; color: #666; }
.detail-value { font-size: 26rpx; color: #333; }
.info-value--price { color: #fa8c16; font-weight: 600; }

.section-title { padding: 24rpx 32rpx 8rpx; }
.section-text { font-size: 28rpx; color: #666; font-weight: 600; }

.coupon-list { padding: 0 24rpx; height: calc(100vh - 560rpx); }
.coupon-card {
  display: flex; background: #fff; border-radius: 16rpx;
  margin-bottom: 16rpx; overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.coupon-left {
  width: 200rpx; background: linear-gradient(135deg, #fa8c16, #ffa940);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 24rpx; gap: 8rpx;
}
.coupon-value { font-size: 40rpx; color: #fff; font-weight: 700; }
.coupon-min { font-size: 20rpx; color: rgba(255,255,255,0.85); }
.coupon-right {
  flex: 1; padding: 24rpx;
  display: flex; flex-direction: column; gap: 6rpx;
}
.coupon-name { font-size: 28rpx; color: #333; font-weight: 600; }
.coupon-code { font-size: 22rpx; color: #999; }
.coupon-status { align-self: flex-start; padding: 2rpx 12rpx; border-radius: 8rpx; font-size: 20rpx; }
.status-unused { background: #e6f7ff; color: #1677FF; }
.status-used { background: #f6ffed; color: #52c41a; }
.status-expired, .status-disabled { background: #fff2f0; color: #ff4d4f; }
.coupon-time { font-size: 20rpx; color: #bbb; }

.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 160rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }

.mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); z-index: 200;
}
.manual-panel {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: #fff; border-radius: 24rpx 24rpx 0 0; z-index: 201;
  display: flex; flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx; border-bottom: 1rpx solid #f0f0f0;
}
.panel-title { font-size: 30rpx; color: #333; font-weight: 600; }
.panel-close { font-size: 36rpx; color: #999; }
.panel-body { padding: 24rpx; }
.form-row {
  display: flex; align-items: center;
  height: 80rpx; margin-bottom: 16rpx;
  background: #f5f7fa; border-radius: 12rpx; padding: 0 24rpx;
}
.form-label { font-size: 26rpx; color: #666; width: 160rpx; }
.form-input { flex: 1; font-size: 28rpx; color: #333; }
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
.primary-btn {
  flex: 1; height: 80rpx; line-height: 80rpx;
  background: #fa8c16; color: #fff; border-radius: 40rpx;
  font-size: 28rpx; border: none;
}
.primary-btn[disabled] { background: #ccc; }
</style>
