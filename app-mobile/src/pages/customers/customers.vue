<template>
  <view class="customers-page">
    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索客户名称 / 电话"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
        </view>
      </view>
    </form>

    <scroll-view class="customer-list" scroll-y v-if="list.length > 0">
      <view class="customer-card" v-for="customer in list" :key="customer.id">
        <view class="card-left">
          <view class="avatar-circle">
            <text class="avatar-text">{{ customer.name.charAt(0) }}</text>
          </view>
        </view>
        <view class="card-right">
          <view class="customer-header">
            <text class="customer-name">{{ customer.name }}</text>
            <view class="customer-type-tag">
              <text class="type-text">{{ customer.type }}</text>
            </view>
          </view>
          <view class="customer-info">
            <text class="customer-phone" v-if="customer.phone">{{ customer.phone }}</text>
            <text class="customer-address" v-if="customer.address">{{ customer.address }}</text>
          </view>
          <view class="customer-footer">
            <text class="debt-label">欠款金额</text>
            <text class="debt-amount" :class="{ 'debt-zero': customer.debtAmount === 0 }">
              ¥{{ customer.debtAmount.toFixed(2) }}
            </text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe608;</text>
      <text class="empty-text">暂无客户数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

// 搜索表单三件套：ref + :model + :rules
const formRef = ref<any>(null)
const searchForm = reactive({
  keyword: '',
})

const searchRules: Rules = {
  keyword: [
    { minLength: 1, message: '输入至少1个字符', required: false },
  ],
}

const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const list = ref<CustomerInfo[]>([])
const loading = ref(false)

function onSearch() {
  loadCustomers()
}

function clearSearch() {
  searchForm.keyword = ''
  loadCustomers()
}

async function loadCustomers() {
  loading.value = true
  try {
    const result = await customersApi.list({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载客户失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCustomers()
})
</script>

<style scoped>
.customers-page {
  min-height: 100vh;
  background: #f0f5ff;
}

/* 搜索栏 */
.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: #bbb;
  padding: 4rpx;
}

/* 客户列表 */
.customer-list {
  padding: 16rpx 24rpx;
}

.customer-card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-left {
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar-circle {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #e6f4ff, #bae0ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 36rpx;
  font-weight: 700;
  color: #1677FF;
}

.card-right {
  flex: 1;
}

.customer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.customer-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.customer-type-tag {
  padding: 4rpx 14rpx;
  background: #e6f4ff;
  border-radius: 8rpx;
}

.type-text {
  font-size: 22rpx;
  color: #1677FF;
}

.customer-info {
  display: flex;
  flex-direction: column;
  margin-bottom: 12rpx;
}

.customer-phone {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 4rpx;
}

.customer-address {
  font-size: 24rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 1rpx solid #f5f5f5;
}

.debt-label {
  font-size: 24rpx;
  color: #999;
}

.debt-amount {
  font-size: 28rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.debt-zero {
  color: #52c41a;
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
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>