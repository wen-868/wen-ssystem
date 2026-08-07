<template>
  <view class="my-page">
    <!-- 无本地身份时：按提交时填写的手机号查询 -->
    <view class="query-bar" v-if="!identity">
      <input
        class="query-input"
        v-model="queryMobile"
        type="number"
        maxlength="11"
        placeholder="请输入提交申请时填写的手机号"
      />
      <view class="query-btn" @tap="queryByMobile">查询</view>
    </view>

    <view v-if="loading" class="state-tip">加载中...</view>

    <view v-else-if="list.length === 0" class="empty">
      <view class="empty-icon">📋</view>
      <view class="empty-text">暂无订阅申请</view>
      <view class="empty-btn" @tap="goPlans">去查看套餐</view>
    </view>

    <view v-else class="apply-list">
      <view class="apply-card" v-for="item in list" :key="item.id">
        <view class="apply-head">
          <view class="apply-plan">{{ item.planName }}</view>
          <view class="apply-status" :class="statusClass(item.status)">{{ statusText(item.status) }}</view>
        </view>
        <view class="apply-info">公司：{{ item.company }}</view>
        <view class="apply-info">联系人：{{ item.contact }}（{{ item.mobile }}）</view>
        <view class="apply-info" v-if="item.remark">备注：{{ item.remark }}</view>
        <view class="apply-time">{{ item.createdAt }}</view>
        <view class="apply-audit" v-if="item.auditRemark">审核意见：{{ item.auditRemark }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import {
  fetchMyApplications,
  getLocalIdentity,
  saveLocalIdentity,
  type SubscriptionApply
} from '../../api/platform'

const loading = ref(true)
const list = ref<SubscriptionApply[]>([])
const identity = ref<{ openid?: string; mobile?: string } | null>(null)
const queryMobile = ref('')

async function loadList(params: { openid?: string; mobile?: string }) {
  loading.value = true
  try {
    list.value = await fetchMyApplications(params)
  } catch (e: any) {
    Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function queryByMobile() {
  if (!/^1\d{10}$/.test(queryMobile.value)) {
    Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  const mobile = queryMobile.value
  identity.value = { mobile }
  saveLocalIdentity({ mobile })
  await loadList({ mobile })
}

function statusText(status: string): string {
  return ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' } as Record<string, string>)[status] || status
}

function statusClass(status: string): string {
  return ({ PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' } as Record<string, string>)[status] || ''
}

function goPlans() {
  Taro.switchTab({ url: '/pages/plans/index' })
}

onMounted(async () => {
  identity.value = getLocalIdentity()
  if (identity.value) {
    await loadList({ openid: identity.value.openid, mobile: identity.value.mobile })
  } else {
    loading.value = false
  }
})
</script>

<style lang="scss">
.my-page {
  min-height: 100vh;
  background: $bg-page;
  padding: $spacing-xl $spacing-lg $spacing-xxl;
  box-sizing: border-box;
}
.query-bar {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}
.query-input {
  flex: 1;
  background: $bg-primary;
  border-radius: $radius-pill;
  padding: $spacing-md $spacing-lg;
  font-size: $font-size-base;
  color: $text-primary;
}
.query-btn {
  flex-shrink: 0;
  background: $brand-gradient;
  color: #fff;
  padding: 0 $spacing-lg;
  border-radius: $radius-pill;
  font-size: $font-size-base;
  display: flex;
  align-items: center;
}
.state-tip {
  padding: $spacing-xxl 0;
  text-align: center;
  color: $text-tertiary;
}
.empty {
  padding: $spacing-xxl 0;
  text-align: center;
}
.empty-icon {
  font-size: 72rpx;
}
.empty-text {
  margin-top: $spacing-md;
  color: $text-tertiary;
  font-size: $font-size-base;
}
.empty-btn {
  margin: $spacing-lg auto 0;
  width: 320rpx;
  background: $brand-gradient;
  color: #fff;
  padding: $spacing-sm 0;
  border-radius: $radius-pill;
  font-size: $font-size-base;
}
.apply-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}
.apply-card {
  background: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}
.apply-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}
.apply-plan {
  font-size: $font-size-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}
.apply-status {
  font-size: $font-size-sm;
  padding: 4rpx 16rpx;
  border-radius: $radius-pill;
}
.apply-status.pending {
  background: #fef3c7;
  color: #b45309;
}
.apply-status.approved {
  background: #d1fae5;
  color: #047857;
}
.apply-status.rejected {
  background: #fee2e2;
  color: #b91c1c;
}
.apply-info {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.8;
}
.apply-time {
  margin-top: $spacing-sm;
  font-size: $font-size-xs;
  color: $text-tertiary;
}
.apply-audit {
  margin-top: $spacing-sm;
  font-size: $font-size-sm;
  color: $text-secondary;
  background: $bg-secondary;
  padding: $spacing-sm;
  border-radius: $radius-sm;
}
</style>
