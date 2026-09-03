<template>
  <view class="stored-card-page">
    <page-header title="储值卡管理" @back="goBack" />
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索卡号 / 会员姓名"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <view class="tabs">
      <view class="tab-item" :class="{ active: activeTab === 'all' }" @tap="switchTab('all')">
        <text>全部</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'active' }" @tap="switchTab('active')">
        <text>正常</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'locked' }" @tap="switchTab('locked')">
        <text>锁定</text>
      </view>
    </view>

    <scroll-view class="card-list" scroll-y v-if="list.length > 0">
      <view class="card-item" v-for="item in list" :key="item.id">
        <view class="card-header">
          <text class="card-no">{{ item.cardNo }}</text>
          <view class="status-tag" :class="'status-' + item.status">
            <text>{{ item.statusText }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="member-info">
            <text class="member-name">{{ item.memberName }}</text>
            <text class="member-mobile">{{ item.memberMobile }}</text>
          </view>
          <view class="balance-info">
            <text class="balance-label">余额</text>
            <text class="balance-value">¥{{ item.balance.toFixed(2) }}</text>
          </view>
        </view>
        <view class="card-footer">
          <view class="footer-btn" @tap="goRecharge(item)">
            <text>充值</text>
          </view>
          <view class="footer-btn" @tap="goRecords(item.cardNo)">
            <text>记录</text>
          </view>
          <view class="footer-btn" @tap="toggleLock(item)" v-if="item.status === 'active'">
            <text>锁定</text>
          </view>
          <view class="footer-btn" @tap="toggleLock(item)" v-else-if="item.status === 'locked'">
            <text>解锁</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无储值卡数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
import { ref, reactive, onMounted } from 'vue'
import { storedCardApi, type StoredCard } from '@/api/modules/stored-cards'

const searchForm = reactive({
  keyword: '',
})

const activeTab = ref('all')
const list = ref<StoredCard[]>([])

function onSearch() {
  loadCards()
}

function clearSearch() {
  searchForm.keyword = ''
  loadCards()
}

function switchTab(tab: string) {
  activeTab.value = tab
  loadCards()
}

function goRecharge(item: StoredCard) {
  uni.showModal({
    title: '充值',
    editable: true,
    placeholderText: '请输入充值金额',
    success: async (res) => {
      if (res.confirm && res.content) {
        const amount = parseFloat(res.content)
        if (amount > 0) {
          try {
            await storedCardApi.recharge(item.cardNo, amount)
            uni.showToast({ title: '充值成功', icon: 'success' })
            loadCards()
          } catch (err) {
            uni.showToast({ title: '充值失败', icon: 'none' })
          }
        }
      }
    }
  })
}

function goRecords(cardNo: string) {
  uni.navigateTo({
    url: `/pages-sub/marketing/stored-cards/recharge-records?cardNo=${cardNo}`
  })
}

async function toggleLock(item: StoredCard) {
  const action = item.status === 'active' ? '锁定' : '解锁'
  uni.showModal({
    title: `${action}确认`,
    content: `确定要${action}该储值卡吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          if (item.status === 'active') {
            await storedCardApi.lock(item.cardNo)
          } else {
            await storedCardApi.unlock(item.cardNo)
          }
          uni.showToast({ title: `${action}成功`, icon: 'success' })
          loadCards()
        } catch (err) {
          uni.showToast({ title: `${action}失败`, icon: 'none' })
        }
      }
    }
  })
}

async function loadCards() {
  try {
    const result = await storedCardApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value === 'all' ? undefined : activeTab.value,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载储值卡失败:', err)
  }
}

onMounted(() => {
  loadCards()
})
</script>

<style lang="scss" scoped>
.stored-card-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 0 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.tab-item {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 28rpx;
  color: $uni-gray-400;
  position: relative;
}

.tab-item.active {
  color: $uni-color-primary;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 2rpx;
}

.card-list {
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.card-item {
  background: linear-gradient(135deg, $uni-bg-color, $uni-gray-50);
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
  border: 1rpx solid $uni-color-primary-soft;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx dashed $uni-gray-200;
}

.card-no {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-gray-700;
  font-family: monospace;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-active { background: $uni-color-success-soft; color: $uni-color-success; }
.status-locked { background: $uni-color-warning-soft; color: $uni-color-warning; }
.status-disabled { background: $uni-bg-color-grey; color: $uni-gray-400; }

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $uni-spacing-md;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-xs;
}

.member-mobile {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.balance-info {
  text-align: right;
}

.balance-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  display: block;
  margin-bottom: 4rpx;
}

.balance-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.card-footer {
  display: flex;
  gap: $uni-spacing-sm;
}

.footer-btn {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
}

.footer-btn:active {
  background: $uni-gray-200;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: $uni-spacing-md;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
