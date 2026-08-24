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
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/stores/stores')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-store.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">门店信息</text>
            <text class="li-desc">{{ storeName || '门店设置与管理' }}</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/admin/employees')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-staff.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">员工管理</text>
            <text class="li-desc">在职员工管理</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="showBusinessHours">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-clock.svg" mode="aspectFit" /></view>
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
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/settings/settings')">
          <view class="li-ico li-ico--blue"><image class="li-ico-img" src="/static/icons/prf-setting.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">系统设置</text>
            <text class="li-desc">打印、权限、通知设置</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/roles/roles')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-staff.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">角色管理</text>
            <text class="li-desc">角色与权限分配</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/system/operation-logs')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-consume.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">操作日志</text>
            <text class="li-desc">系统操作记录</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages-sub/admin/report-permission/index')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-setting.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">报表权限</text>
            <text class="li-desc">报表数据权限配置</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="navigateTo('/pages/notifications/notifications')">
          <view class="li-ico li-ico--dark"><image class="li-ico-img" src="/static/icons/prf-consume.svg" mode="aspectFit" /></view>
          <view class="li-body">
            <text class="li-title">消息推送</text>
            <text class="li-desc">订单、库存、系统消息中心</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
        <view class="list-item" @tap="showCustomerService">
          <view class="li-ico li-ico--blue"><image class="li-ico-img" src="/static/icons/prf-service.svg" mode="aspectFit" /></view>
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
            <text class="li-desc">AI 助手模型与参数配置</text>
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
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import CustomTabBar from '@/components/custom-tab-bar.vue'
import { storesApi } from '@/api/modules/stores'
import { sysConfigApi, type TenantInfo } from '@/api/modules/sys-config'
import manifest from '@/manifest.json'
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
  { icon: '/static/icons/prf-todo.svg', label: '库存预警', path: '/pages-sub/product/stock-warning/stock-warning', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/prf-recon.svg', label: '对账', path: '/pages-sub/finance/reconciliation/reconciliation', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/prf-print.svg', label: '单据打印', path: '/pages-sub/admin/print/print-records', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
]

/** 真实数据：门店营业时间 / 租户联系方式 / 应用版本 */
const businessHours = ref('')
const tenantContact = ref<TenantInfo | null>(null)
const appVersion = (manifest as any)?.versionName || ''

async function loadProfileExtras() {
  if (userStore.storeId) {
    try {
      const store = await storesApi.detail(userStore.storeId)
      businessHours.value = (store as any)?.businessHours || ''
    } catch {
      businessHours.value = ''
    }
  }
  try {
    tenantContact.value = await sysConfigApi.getTenantInfo()
  } catch {
    tenantContact.value = null
  }
}

function showBusinessHours() {
  uni.showModal({
    title: '营业时间',
    content: businessHours.value
      ? `门店营业时间：${businessHours.value}（可在门店管理中调整）`
      : '暂未设置营业时间，可在门店管理中维护',
    showCancel: false,
  })
}

function showCustomerService() {
  const t = tenantContact.value
  uni.showModal({
    title: '客服帮助',
    content: t?.contactMobile
      ? `联系人：${t.contactPerson || '—'}\n电话：${t.contactMobile}\n帮助中心：https://www.onepan.cn`
      : '帮助中心：https://www.onepan.cn（联系方式可在系统设置中维护）',
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

/** AI 设置：跳转 AI 助手页（顶部模型选择/参数配置为真实功能） */
function openAiSettings() {
  navigateTo('/pages/ai-chat/ai-chat')
}

function showAbout() {
  uni.showModal({
    title: '关于',
    content: `智享全链管理系统 v${appVersion}\n粤ICP备2026103101号-2A\n粤公网安备44030002015715号`,
    showCancel: false,
  })
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

onMounted(() => {
  loadProfileExtras()
})

</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

/* 用户卡 */
/* 用户卡（原稿：白卡 + 渐变蓝头像 + 深色文字 + 绿色营业徽章） */
.prof-card {
  margin: $uni-spacing-base $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xl;
  padding: 44rpx;
  padding-top: calc(44rpx + env(safe-area-inset-top));
  display: flex;
  align-items: center;
  gap: $uni-spacing-lg;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  position: relative;
  overflow: hidden;
}

.prof-avatar {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  overflow: hidden;
  border: none;
  margin-right: 0;
  flex-shrink: 0;
  background: linear-gradient(135deg, $uni-color-primary-light, #E0E7FF);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.1);
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 40rpx;
  font-weight: 800;
  color: $uni-color-primary;
}

.prof-info {
  flex: 1;
  min-width: 0;
}

.prof-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
  letter-spacing: -0.4rpx;
  display: block;
}

.prof-role-row {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  margin-top: $uni-spacing-xs;
}

.prof-role {
  font-size: 22rpx;
  color: $uni-gray-500;
  font-weight: 500;
}

.prof-id {
  font-size: 22rpx;
  color: $uni-gray-500;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.prof-store {
  display: block;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-top: 4rpx;
}

/* 营业中徽章（原稿：绿色 pill + 脉冲点） */
.prof-status {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #ECFDF5;
  border: 1rpx solid rgba(5, 150, 105, 0.1);
  border-radius: 999rpx;
  padding: 8rpx 24rpx;
  flex-shrink: 0;
}

.prof-status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #047857;
  animation: pulse-dot 2s infinite;
}

.prof-status-text {
  font-size: 22rpx;
  color: #047857;
  font-weight: 600;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 快捷入口（原稿：统一蓝底浅蓝图标） */
.prof-shortcuts {
  margin: $uni-spacing-base $uni-spacing-base 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 36rpx $uni-spacing-sm;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.prof-sc-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-sm;
}

.prof-sc-item:active {
  transform: scale(0.94);
}

.ps-ico {
  width: 76rpx;
  height: 76rpx;
  border-radius: $uni-border-radius-sm;
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

/* 分区（原稿：标题 12px 灰 + 大写间距，列表 20px 圆角） */
.prof-section {
  margin: 36rpx $uni-spacing-base 0;
}

.prof-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
  padding: 0 $uni-spacing-xs $uni-spacing-md;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.prof-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.list-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-base $uni-spacing-base;
  gap: $uni-spacing-md;
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
  border-radius: $uni-border-radius-sm;
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
  margin: 40rpx $uni-spacing-base 0;
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
