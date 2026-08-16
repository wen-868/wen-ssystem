<template>
  <scroll-view class="profile-page" scroll-y>
    <!-- 用户卡 -->
    <view class="prof-card">
      <view class="prof-avatar" @tap="navigateTo('/pages/profile/edit')">
        <image v-if="userStore.user?.avatar" class="avatar-img" :src="userStore.user.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-text">{{ initialChar }}</text>
        </view>
      </view>
      <view class="prof-info">
        <text class="prof-name">{{ userName }}</text>
        <view class="prof-role-row">
          <text class="prof-role">{{ roleText }}</text>
          <text class="prof-id" v-if="userStore.user?.id">ID: {{ userStore.user.id }}</text>
        </view>
        <text class="prof-store">{{ storeName }}</text>
      </view>
      <view class="prof-status">
        <text class="prof-status-dot"></text>
        <text class="prof-status-text">营业中</text>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="prof-shortcuts">
      <view class="prof-sc-item" v-for="item in shortcuts" :key="item.label" @tap="goto(item.path)">
        <view class="ps-ico" :style="{ background: item.bg }">
          <image v-if="item.icon.startsWith('/static')" class="ps-ico-img" :src="item.icon" mode="aspectFit" />
          <text v-else class="ps-ico-text">{{ item.icon }}</text>
        </view>
        <text class="ps-label">{{ item.label }}</text>
      </view>
    </view>

    <!-- 门店管理 -->
    <view class="prof-section">
      <text class="prof-section-title">门店管理</text>
      <view class="prof-list">
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/stores/stores')" v-if="userStore.isAdmin">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-store.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">门店信息</text>
            <text class="li-desc">{{ storeName || '门店设置与管理' }}</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/admin/employees')" v-if="userStore.isAdmin">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-staff.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">员工管理</text>
            <text class="li-desc">在职员工管理</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="showBusinessHours">
          <view class="li-ico li-ico--dark"><text class="li-ico-text">时</text></view>
          <view class="li-body">
            <text class="li-title">营业时间</text>
            <text class="li-desc">门店营业时间</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 系统 -->
    <view class="prof-section">
      <text class="prof-section-title">系统</text>
      <view class="prof-list">
        <view class="list-item">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-consume.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">消息推送</text>
            <text class="li-desc">接收订单、库存、系统消息推送</text>
          </view>
          <switch :checked="pushEnabled" color="#6366F1" @change="onPushToggle" style="transform:scale(.8)" />
        </view>
        <view class="list-item" @tap="showCustomerService">
          <view class="li-ico li-ico--blue"><text class="li-ico-text">客</text></view>
          <view class="li-body">
            <text class="li-title">客服帮助</text>
            <text class="li-desc">在线客服 · 帮助中心</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="openAiSettings">
          <view class="li-ico li-ico--ai"><text class="li-ico-text ai">AI</text></view>
          <view class="li-body">
            <text class="li-title">AI 设置</text>
            <text class="li-desc">AI 助手配置</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="showAbout">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-close.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">关于</text>
            <text class="li-desc">智享全链</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <view class="logout-btn" @tap="handleLogout">
        <text class="logout-text">退出登录</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
    <custom-tab-bar :current="'profile'" />
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import CustomTabBar from '@/components/custom-tab-bar.vue'
import {
  AI_BG_SOFT,
  AI_TAB_ACTIVE,
  AI_SUCCESS_SOFT,
  AI_SUCCESS,
  AI_WARNING_SOFT,
  AI_WARNING,
  AI_DANGER_SOFT,
  AI_DANGER,
  AI_BG_GAP,
  AI_TEXT_MID,
} from '@/constants/colors'

const userStore = useUserStore()

const userName = computed(() => userStore.user?.realName || userStore.user?.name || '未登录')
const storeName = computed(() => userStore.user?.storeName || '')

const initialChar = computed(() => {
  const name = userName.value
  return name && name !== '未登录' ? name.charAt(0) : 'U'
})

const roleText = computed(() => {
  const map: Record<string, string> = {
    SUPER_ADMIN: '超级管理员',
    ADMIN: '管理员',
    STORE_MANAGER: '店长',
    STAFF: '员工'
  }
  const roles = userStore.user?.roles
  return roles && roles.length > 0 ? map[roles[0]] || roles[0] : ''
})

const shortcuts = [
  { icon: '/static/icons/prf-work.svg', label: '工作记录', path: '/pages/todos/todos', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/prf-todo.svg', label: '库存预警', path: '/pages-sub/product/stock-warning/stock-warning', bg: AI_DANGER_SOFT, color: AI_DANGER },
  { icon: '账', label: '对账', path: '/pages-sub/finance/reconciliation/reconciliation', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '印', label: '单据打印', path: '/pages-sub/admin/print/print-records', bg: AI_BG_GAP, color: AI_TEXT_MID },
]

const pushEnabled = ref(true)

function onPushToggle(e: any) {
  pushEnabled.value = !!e.detail?.value
  uni.showToast({ title: pushEnabled.value ? '已开启消息推送' : '已关闭消息推送', icon: 'none' })
}

function showBusinessHours() {
  uni.showModal({
    title: '营业时间',
    content: '门店营业时间：08:00 - 22:00（可在门店管理中调整）',
    showCancel: false,
  })
}

function showCustomerService() {
  uni.showModal({
    title: '客服帮助',
    content: '在线客服：13410954557\n帮助中心：https://www.onepan.cn',
    showCancel: false,
  })
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function goto(path: string) {
  if (path) {
    uni.navigateTo({ url: path })
  } else {
    uni.showToast({ title: '页面不存在', icon: 'none' })
  }
}

function openAiSettings() {
  uni.showToast({ title: 'AI 设置即将上线', icon: 'none' })
}

function showAbout() {
  uni.showModal({ title: '关于', content: '智享全链管理系统 v1.0', showCancel: false })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    }
  })
}

</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

/* 用户卡 */
.prof-card {
  margin: 28rpx 28rpx 0;
  background: $uni-gradient-blue;
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 32rpx rgba(37, 99, 235, 0.25);
  position: relative;
  overflow: hidden;
}

.prof-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 4rpx solid rgba(255, 255, 255, 0.4);
  margin-right: 24rpx;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 44rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

.prof-info {
  flex: 1;
  min-width: 0;
}

.prof-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
  display: block;
}

.prof-role-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 8rpx;
}

.prof-role {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.2);
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.prof-id {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.7);
}

.prof-store {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 10rpx;
}

.prof-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999rpx;
  padding: 8rpx 20rpx;
  flex-shrink: 0;
}

.prof-status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #4ADE80;
  animation: pulse-dot 2s infinite;
}

.prof-status-text {
  font-size: 22rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 快捷入口 */
.prof-shortcuts {
  margin: 28rpx 28rpx 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 28rpx 12rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.prof-sc-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.prof-sc-item:active {
  transform: scale(0.94);
}

.ps-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ps-ico-text {
  font-size: 30rpx;
  font-weight: 700;
}

.ps-ico-img {
  width: 40rpx;
  height: 40rpx;
}

.ps-label {
  font-size: 22rpx;
  color: $uni-gray-600;
  font-weight: 500;
}

/* 分区 */
.prof-section {
  margin: 36rpx 28rpx 0;
}

.prof-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-400;
  padding: 0 8rpx 16rpx;
  letter-spacing: 1rpx;
}

.prof-list {
  background: $uni-bg-color;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.list-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  gap: 20rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:active {
  background: $uni-bg-color-grey;
}

.li-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.li-ico--blue { background: $uni-color-primary-soft; color: $uni-color-primary; }
.li-ico--orange { background: $uni-color-warning-soft; color: $uni-color-warning; }
.li-ico--purple { background: $uni-color-purple-soft; color: $uni-color-purple; }
.li-ico--dark { background: $uni-bg-color-grey; color: $uni-gray-500; }
.li-ico--ai {
  background: $uni-gradient-blue;
  color: $uni-text-color-inverse;
}

.li-ico-text {
  font-size: 28rpx;
  font-weight: 700;
}

.li-ico-img {
  width: 40rpx;
  height: 40rpx;
}

.li-ico-text.ai {
  font-size: 22rpx;
}

.li-body {
  flex: 1;
  min-width: 0;
}

.li-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.li-desc {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 6rpx;
}

.li-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.menu-badge {
  min-width: 36rpx;
  height: 36rpx;
  background: $uni-color-error;
  border-radius: 18rpx;
  font-size: 20rpx;
  color: $uni-text-color-inverse;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10rpx;
}

/* 退出登录 */
.logout-section {
  margin: 40rpx 28rpx 0;
}

.logout-btn {
  height: 88rpx;
  background: $uni-bg-color;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid $uni-color-error-soft;
  box-shadow: $uni-shadow-card;
}

.logout-btn:active {
  background: $uni-color-error-soft;
}

.logout-text {
  font-size: 30rpx;
  color: $uni-color-error;
  font-weight: 500;
}

.safe-bottom {
  height: 40rpx;
}
</style>
