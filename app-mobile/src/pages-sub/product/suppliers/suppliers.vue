<template>
  <view class="suppliers-page">
    <view class="page-header">
      <text class="header-title">供应商</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索供应商名称 / 编码"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 供应商列表 -->
    <scroll-view class="supplier-list" scroll-y v-if="list.length > 0">
      <view class="supplier-card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <view class="card-header">
          <text class="supplier-name">{{ item.name }}</text>
          <text class="supplier-code">{{ item.supplierCode }}</text>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">联系人</text>
            <text class="info-value">{{ item.contactName || '--' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">电话</text>
            <text class="info-value">{{ item.contactPhone || '--' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">账期</text>
            <text class="info-value">{{ item.paymentDays ? item.paymentDays + '天' : '--' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">结算方式</text>
            <text class="info-value">{{ item.settlementType || '--' }}</text>
          </view>
        </view>
        <view class="card-footer">
          <button class="action-btn order-btn" @tap.stop="viewOrders(item)">采购订单</button>
          <button class="action-btn statement-btn" @tap.stop="viewStatements(item)">对账单</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无供应商数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { supplierApi, type Supplier } from '@/api/modules/suppliers'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const list = ref<Supplier[]>([])
const loading = ref(false)

function onSearch() { loadSuppliers() }
function clearSearch() { searchForm.keyword = ''; loadSuppliers() }
function goDetail(id: number) { uni.navigateTo({ url: `/pages-sub/product/suppliers/detail?id=${id}` }) }

function viewOrders(item: Supplier) {
  uni.navigateTo({ url: `/pages-sub/finance/purchase/orders?supplierId=${item.id}` })
}

function viewStatements(item: Supplier) {
  uni.navigateTo({ url: `/pages-sub/finance/statements/statements?supplierId=${item.id}` })
}

async function loadSuppliers() {
  loading.value = true
  try {
    const res = await supplierApi.getList({
      page: 1,
      pageSize: 100,
      keyword: searchForm.keyword || undefined
    })
    list.value = res.list || []
  } catch (err) {
    console.error('加载供应商失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadSuppliers() })
</script>

<style lang="scss" scoped>
.suppliers-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.supplier-list { padding: 16rpx 24rpx; }
.supplier-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.supplier-name { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.supplier-code { font-size: 24rpx; color: $uni-gray-400; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.card-footer {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-gray-100;
  display: flex;
  gap: 16rpx;
}
.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.order-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.statement-btn { background: $uni-bg-color-grey; color: $uni-gray-700; }
.action-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>