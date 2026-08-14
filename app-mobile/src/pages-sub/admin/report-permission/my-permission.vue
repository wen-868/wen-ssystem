<template>
  <view class="my-permission-page">
    <!-- 顶部用户信息 -->
    <view class="user-header">
      <view class="user-avatar">
        <text class="avatar-text">{{ userName.charAt(0) }}</text>
      </view>
      <view class="user-info">
        <text class="user-name">{{ userName }}</text>
        <text class="user-account">{{ userAccount }}</text>
      </view>
    </view>

    <!-- 角色标签 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">我的角色</text>
        <text class="section-count">{{ myPermission.roles.length }}个</text>
      </view>
      <view class="role-tags">
        <view class="role-tag" v-for="role in myPermission.roles" :key="role.id">
          <text class="role-tag-text">{{ role.name }}</text>
        </view>
        <view class="role-empty" v-if="myPermission.roles.length === 0">
          <text class="empty-text">暂无角色</text>
        </view>
      </view>
    </view>

    <!-- 数据范围 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">数据权限范围</text>
      </view>
      <view class="scope-card">
        <view class="scope-icon">
          <text class="icon-text">&#xe623;</text>
        </view>
        <view class="scope-info">
          <text class="scope-name">{{ scopeText }}</text>
          <text class="scope-desc">
            {{ dataScope === 'ALL' ? '可查看所有门店数据' : dataScope === 'SELECTED' ? '可查看指定门店数据' : '仅可查看所属门店数据' }}
          </text>
        </view>
      </view>

      <!-- 门店列表 -->
      <view class="store-list-wrap" v-if="dataScope === 'SELECTED' || dataScope === 'ALL'">
        <view class="store-list-title">
          <text class="title-text">可访问门店</text>
          <text class="store-count">共{{ myPermission.stores.length }}个</text>
        </view>
        <view class="store-list">
          <view class="store-item" v-for="store in myPermission.stores" :key="store.id">
            <view class="store-dot"></view>
            <view class="store-info">
              <text class="store-name">{{ store.name }}</text>
              <text class="store-code">{{ store.code }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 报表权限 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">报表权限</text>
        <text class="section-count">{{ viewableCount }}个可查看 / {{ exportableCount }}个可导出</text>
      </view>

      <!-- 分类筛选 -->
      <scroll-view class="category-scroll" scroll-x v-if="categories.length > 0">
        <view class="category-list">
          <view
            class="category-item"
            :class="{ active: activeCategory === '' }"
            @tap="activeCategory = ''"
          >
            <text class="category-text">全部</text>
          </view>
          <view
            class="category-item"
            :class="{ active: activeCategory === cat.key }"
            v-for="cat in categories"
            :key="cat.key"
            @tap="activeCategory = cat.key"
          >
            <text class="category-text">{{ cat.name }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 权限列表 -->
      <view class="perm-list">
        <view class="perm-item" v-for="perm in filteredPermissions" :key="perm.reportId">
          <view class="perm-info">
            <text class="perm-name">{{ perm.reportName }}</text>
          </view>
          <view class="perm-status">
            <view class="status-tag" :class="{ active: perm.canView }">
              <text class="status-text">查看</text>
            </view>
            <view class="status-tag" :class="{ active: perm.canExport, disabled: !perm.canView }">
              <text class="status-text">导出</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reportPermissionApi, type MyPermission } from '@/api/modules/report-permission'
import { getUser } from '@/api/storage'

const myPermission = ref<MyPermission>({
  roles: [],
  reportPermissions: [],
  dataScope: 'SELF',
  stores: [],
})

const userName = ref('用户')
const userAccount = ref('')
const activeCategory = ref('')

const dataScope = computed(() => myPermission.value.dataScope)

const scopeText = computed(() => {
  const map: Record<string, string> = {
    ALL: '全部门店',
    SELECTED: '指定门店',
    SELF: '仅本店',
  }
  return map[dataScope.value] || '仅本店'
})

const categories = computed(() => {
  const catMap = new Map<string, string>()
  // 从报表ID推断分类
  const categoryMap: Record<string, string> = {
    sales: '销售报表',
    inventory: '库存报表',
    purchase: '采购报表',
    finance: '财务报表',
    customer: '客户报表',
  }
  myPermission.value.reportPermissions.forEach(p => {
    const cat = p.reportId.split('_')[0]
    if (cat && categoryMap[cat]) {
      catMap.set(cat, categoryMap[cat])
    }
  })
  return Array.from(catMap.entries()).map(([key, name]) => ({ key, name }))
})

const filteredPermissions = computed(() => {
  if (!activeCategory.value) return myPermission.value.reportPermissions
  return myPermission.value.reportPermissions.filter(p =>
    p.reportId.startsWith(activeCategory.value)
  )
})

const viewableCount = computed(() =>
  myPermission.value.reportPermissions.filter(p => p.canView).length
)

const exportableCount = computed(() =>
  myPermission.value.reportPermissions.filter(p => p.canExport).length
)

async function loadMyPermission() {
  try {
    const data = await reportPermissionApi.getMyPermission()
    myPermission.value = data
  } catch (err) {
    console.error('加载我的权限失败:', err)
  }
}

onMounted(() => {
  // 当前登录用户信息（登录后由 storage 加密保存，展示真实姓名与账号）
  const user = getUser()
  userName.value = user?.realName || user?.name || user?.username || '未知用户'
  userAccount.value = user?.username || user?.account || ''
  loadMyPermission()
})
</script>

<style lang="scss" scoped>
.my-permission-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
}

.user-header {
  display: flex;
  align-items: center;
  padding: 48rpx 32rpx;
  padding-top: calc(48rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  gap: 24rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 40rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

.user-account {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section {
  margin: 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.section-count {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 24rpx;
}

.role-tag {
  padding: 12rpx 28rpx;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.1), rgba(64, 150, 255, 0.1));
  border-radius: 32rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.2);
}

.role-tag-text {
  font-size: 26rpx;
  color: $uni-color-primary;
  font-weight: 500;
}

.role-empty {
  width: 100%;
  text-align: center;
  padding: 20rpx 0;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-300;
}

.scope-card {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 20rpx;
}

.scope-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-text {
  font-size: 32rpx;
  color: $uni-text-color-inverse;
}

.scope-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.scope-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.scope-desc {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.store-list-wrap {
  padding: 0 24rpx 24rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.store-list-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.title-text {
  font-size: 26rpx;
  color: $uni-gray-500;
  font-weight: 500;
}

.store-count {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.store-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.store-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  width: calc(50% - 6rpx);
  padding: 12rpx 16rpx;
  background: $uni-gray-50;
  border-radius: 12rpx;
}

.store-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $uni-color-success;
  flex-shrink: 0;
}

.store-info {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.store-name {
  font-size: 24rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-code {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.category-scroll {
  white-space: nowrap;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.category-list {
  display: inline-flex;
  padding: 16rpx 24rpx;
  gap: 12rpx;
}

.category-item {
  padding: 10rpx 24rpx;
  background: $uni-bg-color-grey;
  border-radius: 24rpx;
}

.category-item.active {
  background: $uni-color-primary-soft;
}

.category-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.category-item.active .category-text {
  color: $uni-color-primary;
}

.perm-list {
  padding: 8rpx 0;
}

.perm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.perm-item:last-child {
  border-bottom: none;
}

.perm-info {
  flex: 1;
  min-width: 0;
}

.perm-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.perm-status {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  background: $uni-bg-color-grey;
}

.status-tag.active {
  background: rgba(22, 119, 255, 0.1);
}

.status-tag.disabled {
  opacity: 0.4;
}

.status-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.status-tag.active .status-text {
  color: $uni-color-primary;
}

.safe-bottom {
  height: 40rpx;
}
</style>
