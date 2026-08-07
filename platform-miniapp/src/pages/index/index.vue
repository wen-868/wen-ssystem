<template>
  <view class="home-page">
    <!-- Hero -->
    <view class="hero">
      <view class="hero-badge">酒水行业一站式数字化管理</view>
      <view class="hero-title">让酒水生意<br />更简单</view>
      <view class="hero-desc">批零一体 · 即时零售 · AI 助手 · 多门店连锁 · 数据报表，一部手机管好生意</view>
      <view class="hero-actions">
        <view class="hero-btn" @tap="goPlans">查看套餐</view>
        <view class="hero-btn ghost" @tap="goAbout">了解我们</view>
      </view>
    </view>

    <!-- 能力亮点 -->
    <view class="section">
      <view class="section-head">
        <view class="section-title">全链路数字化管理</view>
        <view class="section-sub">从商品到财务，一站式覆盖经营全流程</view>
      </view>
      <view class="feature-grid">
        <view class="feature-card" v-for="f in features" :key="f.title">
          <view class="feature-icon" :style="{ background: f.bg, color: f.color }">{{ f.icon }}</view>
          <view class="feature-title">{{ f.title }}</view>
          <view class="feature-desc">{{ f.desc }}</view>
        </view>
      </view>
    </view>

    <!-- 核心差异化 -->
    <view class="section">
      <view class="section-head">
        <view class="section-title">为什么选择智享全链</view>
        <view class="section-sub">深耕酒水零售行业，理解你的业务痛点</view>
      </view>
      <view class="diff-list">
        <view class="diff-item" v-for="d in diffs" :key="d.title">
          <view class="diff-index">{{ d.index }}</view>
          <view class="diff-body">
            <view class="diff-title">{{ d.title }}</view>
            <view class="diff-desc">{{ d.desc }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- CTA -->
    <view class="cta">
      <view class="cta-title">免费体验 30 天</view>
      <view class="cta-desc">无需信用卡，随时可取消，专业团队在线支持</view>
      <view class="cta-btn" @tap="goPlans">立即查看套餐</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import Taro from '@tarojs/taro'

const features = [
  { icon: '批', title: '批零一体', desc: '批发零售同一单据体系，客户分级差异化定价', color: '#2563eb', bg: '#dbeafe' },
  { icon: '店', title: '多门店连锁', desc: '多门店统一管理，库存实时同步，总部统一调配', color: '#7c3aed', bg: '#ede9fe' },
  { icon: '零', title: '即时零售', desc: '对接美团、饿了么等平台，自动接单、库存同步', color: '#059669', bg: '#d1fae5' },
  { icon: 'AI', title: 'AI 助手', desc: '智能开单、经营分析、库存诊断，越用越懂生意', color: '#0891b2', bg: '#cffafe' },
  { icon: '库', title: '智能库存', desc: '批次追踪、效期预警、盘点调拨，库存准确率 99.8%', color: '#ca8a04', bg: '#fef9c3' },
  { icon: '客', title: '客户管理', desc: '客户档案、标签分组、授信额度、客户专属价', color: '#dc2626', bg: '#fee2e2' },
  { icon: '报', title: '数据报表', desc: '销售、采购、库存、财务多维度分析，决策有依据', color: '#4f46e5', bg: '#e0e7ff' },
  { icon: '营', title: '营销管理', desc: '优惠券、满减、秒杀、积分商城，助力销量增长', color: '#ea580c', bg: '#fff7ed' }
]

const diffs = [
  { index: '01', title: '为酒水行业而生', desc: '多规格 SKU、箱规换算、批次效期、烟草类目合规，行业细节开箱即用' },
  { index: '02', title: '多端数据实时同步', desc: 'PC 管理后台、手机工作台、门店终端、微信小程序多端协同' },
  { index: '03', title: '多租户 SaaS 架构', desc: '数据隔离、按需订阅，从单店到连锁规模化经营轻松扩展' },
  { index: '04', title: '7×24 专业支持', desc: '500+ 酒水企业共同选择，稳定运行，持续迭代' }
]

const goPlans = () => {
  Taro.switchTab({ url: '/pages/plans/index' })
}

const goAbout = () => {
  Taro.navigateTo({ url: '/pages/about/index' })
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  padding-bottom: $spacing-xxl;
  background: $bg-page;
}

.hero {
  padding: $spacing-xxl $spacing-lg $spacing-xl;
  background: linear-gradient(150deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%);
  color: #fff;
}

.hero-badge {
  display: inline-flex;
  padding: 8rpx 24rpx;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.22);
  font-size: $font-size-xs;
  letter-spacing: 1rpx;
}

.hero-title {
  margin-top: $spacing-lg;
  font-size: 76rpx;
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -2rpx;
}

.hero-desc {
  margin-top: $spacing-md;
  font-size: $font-size-sm;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.82);
}

.hero-actions {
  display: flex;
  gap: $spacing-md;
  margin-top: $spacing-xl;
}

.hero-btn {
  padding: 20rpx 48rpx;
  border-radius: $radius-full;
  background: #fff;
  color: $brand-primary-dark;
  font-size: $font-size-base;
  font-weight: 600;
}

.hero-btn.ghost {
  background: transparent;
  color: #fff;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.section {
  margin-top: $spacing-md;
  padding: $spacing-xl $spacing-lg;
  background: $bg-card;
}

.section-head {
  margin-bottom: $spacing-lg;
}

.section-title {
  font-size: $font-size-xl;
  font-weight: 700;
  color: $text-primary;
}

.section-sub {
  margin-top: 8rpx;
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.feature-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.feature-card {
  width: calc(50% - 12rpx);
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  background: $bg-page;
  border-radius: $radius-md;
  box-sizing: border-box;
}

.feature-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-md;
  font-weight: 700;
}

.feature-title {
  margin-top: $spacing-md;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.feature-desc {
  margin-top: 8rpx;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $text-secondary;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.diff-item {
  display: flex;
  gap: $spacing-md;
}

.diff-index {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: $bg-soft;
  color: $brand-primary;
  font-size: $font-size-sm;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diff-body {
  flex: 1;
}

.diff-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.diff-desc {
  margin-top: 6rpx;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $text-secondary;
}

.cta {
  margin: $spacing-xl $spacing-lg 0;
  padding: $spacing-xl;
  border-radius: $radius-lg;
  background: $brand-gradient;
  color: #fff;
  text-align: center;
}

.cta-title {
  font-size: $font-size-xl;
  font-weight: 700;
}

.cta-desc {
  margin-top: 8rpx;
  font-size: $font-size-xs;
  color: rgba(255, 255, 255, 0.8);
}

.cta-btn {
  margin-top: $spacing-lg;
  padding: 20rpx 0;
  border-radius: $radius-full;
  background: #fff;
  color: $brand-primary-dark;
  font-size: $font-size-base;
  font-weight: 600;
}
</style>
