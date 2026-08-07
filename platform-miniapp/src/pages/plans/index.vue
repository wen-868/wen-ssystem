<template>
  <view class="plans-page">
    <view class="page-head">
      <view class="page-title">选择适合你的套餐</view>
      <view class="page-sub">按月订阅，随时可升级；提交申请后由专属顾问跟进开通</view>
    </view>

    <view v-if="loading" class="state-tip">套餐加载中...</view>
    <view v-else-if="plans.length === 0" class="state-tip">暂无可用套餐</view>

    <view v-else class="plan-list">
      <view class="plan-card" v-for="plan in plans" :key="plan.id">
        <view class="plan-name">{{ plan.name }}</view>
        <view class="plan-price">
          <text class="price-symbol">¥</text>
          <text class="price-num">{{ formatPrice(plan.price) }}</text>
          <text class="price-cycle">/{{ plan.cycle }}</text>
        </view>
        <view class="plan-desc">{{ plan.description }}</view>
        <view class="plan-features" v-if="featureList(plan).length">
          <view class="feature-line" v-for="(f, i) in featureList(plan)" :key="i">✓ {{ f }}</view>
        </view>
        <view class="plan-btn" @tap="subscribe(plan)">立即订阅</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { fetchPlans, type PlatformPlan } from '../../api/platform'

const loading = ref(true)
const plans = ref<PlatformPlan[]>([])

function formatPrice(price: number): string {
  return Number(price || 0).toFixed(2)
}

function featureList(plan: PlatformPlan): string[] {
  const f = plan.features
  if (Array.isArray(f)) return f.map((x: unknown) => String(x))
  if (typeof f === 'string' && f) return f.split(/[,，、]/).filter(Boolean)
  return []
}

function subscribe(plan: PlatformPlan) {
  Taro.navigateTo({ url: `/pages/subscribe/index?planId=${plan.id}` })
}

onMounted(async () => {
  try {
    plans.value = await fetchPlans()
  } catch (e: any) {
    Taro.showToast({ title: e?.message || '套餐加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss">
.plans-page {
  min-height: 100vh;
  background: $bg-page;
  padding: $spacing-xl $spacing-lg $spacing-xxl;
  box-sizing: border-box;
}
.page-head {
  padding: $spacing-md 0 $spacing-lg;
}
.page-title {
  font-size: $font-size-xxl;
  font-weight: $font-bold;
  color: $text-primary;
}
.page-sub {
  margin-top: $spacing-xs;
  font-size: $font-size-sm;
  color: $text-tertiary;
  line-height: 1.6;
}
.state-tip {
  padding: $spacing-xxl 0;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-base;
}
.plan-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}
.plan-card {
  background: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}
.plan-name {
  font-size: $font-size-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}
.plan-price {
  margin-top: $spacing-sm;
  display: flex;
  align-items: baseline;
}
.price-symbol {
  font-size: $font-size-base;
  color: $brand-primary;
  font-weight: $font-semibold;
}
.price-num {
  font-size: $font-size-xxl;
  font-weight: $font-bold;
  color: $brand-primary;
}
.price-cycle {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-left: $spacing-xs;
}
.plan-desc {
  margin-top: $spacing-sm;
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.6;
}
.plan-features {
  margin-top: $spacing-md;
}
.feature-line {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.9;
}
.plan-btn {
  margin-top: $spacing-lg;
  background: $brand-gradient;
  color: #fff;
  text-align: center;
  padding: $spacing-md 0;
  border-radius: $radius-pill;
  font-size: $font-size-base;
  font-weight: $font-semibold;
}
</style>
