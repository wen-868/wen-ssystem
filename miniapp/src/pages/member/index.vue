<template>
  <view class="member-page">
    <!-- 会员等级头部 -->
    <view class="member-header">
      <view class="level-info">
        <view class="level-badge">
          <text class="level-icon">👑</text>
          <text class="level-name">{{ memberInfo.currentLevel?.name || '普通会员' }}</text>
        </view>
        <view class="growth-section">
          <view class="growth-text">
            <text>成长值 {{ memberInfo.growthValue || 0 }}</text>
            <text v-if="memberInfo.nextLevel">
              距{{ memberInfo.nextLevel.name }}还差{{ memberInfo.nextLevel.minGrowth - (memberInfo.growthValue || 0) }}成长值
            </text>
            <text v-else>已达最高等级</text>
          </view>
          <view class="progress-bar">
            <view class="progress-inner" :style="{ width: progressPercent + '%' }"></view>
          </view>
        </view>
      </view>
      <view class="level-benefits-entry" @tap="scrollToBenefits">
        <text>查看全部权益</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 会员权益 -->
    <view class="benefits-section" id="benefits">
      <view class="section-title">
        <text class="title-text">会员权益</text>
        <text class="title-sub">尊享专属特权</text>
      </view>
      <view class="benefits-grid">
        <view class="benefit-item" v-for="benefit in benefitsList" :key="benefit.id">
          <view class="benefit-icon">{{ benefit.icon }}</view>
          <text class="benefit-name">{{ benefit.name }}</text>
          <text class="benefit-desc">{{ benefit.description }}</text>
        </view>
      </view>
    </view>

    <!-- 成长值明细 -->
    <view class="growth-section-wrap">
      <view class="section-title">
        <text class="title-text">成长值明细</text>
        <view class="tab-switch">
          <text 
            class="tab-item" 
            :class="{ active: activeTab === 'all' }"
            @tap="switchTab('all')"
          >全部</text>
          <text 
            class="tab-item" 
            :class="{ active: activeTab === 'EARN' }"
            @tap="switchTab('EARN')"
          >获得</text>
          <text 
            class="tab-item" 
            :class="{ active: activeTab === 'CONSUME' }"
            @tap="switchTab('CONSUME')"
          >消耗</text>
        </view>
      </view>
      <view class="growth-list">
        <view class="growth-item" v-for="record in growthRecords" :key="record.id">
          <view class="growth-left">
            <text class="growth-reason">{{ record.reason }}</text>
            <text class="growth-time">{{ formatTime(record.createdAt) }}</text>
          </view>
          <text class="growth-amount" :class="record.type === 'EARN' ? 'earn' : 'consume'">
            {{ record.type === 'EARN' ? '+' : '-' }}{{ record.amount }}
          </text>
        </view>
        <view class="empty-tip" v-if="growthRecords.length === 0 && !loading">
          <text>暂无成长值记录</text>
        </view>
        <view class="loading-tip" v-if="loading">
          <text>加载中...</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { userApi } from '@/api/user'
import type { MemberLevel, MemberBenefit, GrowthRecord } from '@/api/user'

const loading = ref(false)
const activeTab = ref('all')

const memberInfo = ref<{
  currentLevel?: MemberLevel
  nextLevel?: MemberLevel
  growthValue: number
  benefits: MemberBenefit[]
}>({
  currentLevel: undefined,
  nextLevel: undefined,
  growthValue: 0,
  benefits: []
})

const benefitsList = ref<MemberBenefit[]>([
  { id: 1, name: '折扣特权', icon: '💰', description: '会员专享折扣', levelRequired: 1 },
  { id: 2, name: '生日特权', icon: '🎂', description: '生日专属礼遇', levelRequired: 1 },
  { id: 3, name: '专属客服', icon: '👩‍💼', description: '一对一专属服务', levelRequired: 2 },
  { id: 4, name: '优先发货', icon: '🚚', description: '订单优先处理', levelRequired: 2 },
  { id: 5, name: '积分加倍', icon: '⭐', description: '消费积分翻倍', levelRequired: 3 },
  { id: 6, name: '新品优先', icon: '🆕', description: '新品抢先体验', levelRequired: 3 }
])

const growthRecords = ref<GrowthRecord[]>([])

const progressPercent = computed(() => {
  if (!memberInfo.value.nextLevel) return 100
  const current = memberInfo.value.growthValue || 0
  const nextMin = memberInfo.value.nextLevel.minGrowth
  const currentLevelMin = memberInfo.value.currentLevel?.minGrowth || 0
  const total = nextMin - currentLevelMin
  const progress = current - currentLevelMin
  return Math.min(100, Math.max(0, (progress / total) * 100))
})

const loadMemberInfo = async () => {
  try {
    const result = await userApi.getMemberLevel()
    memberInfo.value = result
  } catch (error) {
    // 接口未实现时使用模拟数据
    memberInfo.value = {
      currentLevel: {
        id: 2,
        name: '黄金会员',
        level: 2,
        icon: '👑',
        minGrowth: 500,
        maxGrowth: 2000,
        discount: 0.95,
        benefits: ['折扣特权', '生日特权', '专属客服']
      },
      nextLevel: {
        id: 3,
        name: '钻石会员',
        level: 3,
        icon: '💎',
        minGrowth: 2000,
        maxGrowth: 5000,
        discount: 0.9,
        benefits: ['折扣特权', '生日特权', '专属客服', '优先发货', '积分加倍']
      },
      growthValue: 1280,
      benefits: benefitsList.value
    }
  }
}

const loadGrowthRecords = async () => {
  loading.value = true
  try {
    const result = await userApi.getGrowthRecords({
      type: activeTab.value === 'all' ? undefined : activeTab.value,
      page: 1,
      pageSize: 20
    })
    growthRecords.value = result.records
  } catch (error) {
    // 接口未实现时使用模拟数据
    growthRecords.value = [
      { id: 1, type: 'EARN', amount: 100, reason: '消费获得', orderNo: 'SO20260710001', createdAt: '2026-07-10 14:30:00' },
      { id: 2, type: 'EARN', amount: 50, reason: '签到奖励', createdAt: '2026-07-09 09:00:00' },
      { id: 3, type: 'EARN', amount: 200, reason: '消费获得', orderNo: 'SO20260708002', createdAt: '2026-07-08 16:20:00' },
      { id: 4, type: 'CONSUME', amount: 50, reason: '积分兑换', createdAt: '2026-07-07 11:00:00' },
      { id: 5, type: 'EARN', amount: 80, reason: '评价奖励', createdAt: '2026-07-06 10:30:00' }
    ].filter(item => {
      if (activeTab.value === 'all') return true
      return item.type === activeTab.value
    })
  } finally {
    loading.value = false
  }
}

const switchTab = (tab: string) => {
  activeTab.value = tab
  loadGrowthRecords()
}

const scrollToBenefits = () => {
  Taro.pageScrollTo({
    selector: '#benefits',
    duration: 300
  })
}

const formatTime = (time: string) => {
  if (!time) return ''
  return time.substring(0, 16)
}

onMounted(() => {
  loadMemberInfo()
  loadGrowthRecords()
})
</script>

<style lang="scss" scoped>
.member-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.member-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  padding: $spacing-xl $spacing-md;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
  color: #fff;
}

.level-info {
  margin-bottom: $spacing-lg;
}

.level-badge {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
}

.level-icon {
  font-size: $font-size-xxl;
  margin-right: $spacing-sm;
}

.level-name {
  font-size: $font-size-xl;
  font-weight: bold;
}

.growth-section {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: $radius-md;
  padding: $spacing-md;
}

.growth-text {
  display: flex;
  justify-content: space-between;
  font-size: $font-size-sm;
  margin-bottom: $spacing-sm;
  opacity: 0.9;
}

.progress-bar {
  height: 12rpx;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ffed4e);
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.level-benefits-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: $radius-md;
  padding: $spacing-md;
  font-size: $font-size-base;
}

.arrow {
  font-size: $font-size-xl;
}

.benefits-section {
  margin: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-lg;
}

.title-text {
  font-size: $font-size-lg;
  font-weight: bold;
  color: $text-primary;
}

.title-sub {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.benefits-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -#{$spacing-sm};
}

.benefit-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md $spacing-sm;
  box-sizing: border-box;
}

.benefit-icon {
  font-size: $font-size-xxl;
  margin-bottom: $spacing-sm;
}

.benefit-name {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: 500;
  margin-bottom: $spacing-xs;
}

.benefit-desc {
  font-size: $font-size-xs;
  color: $text-tertiary;
  text-align: center;
}

.growth-section-wrap {
  margin: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.tab-switch {
  display: flex;
  background-color: $bg-secondary;
  border-radius: $radius-md;
  padding: 4rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-sm $spacing-md;
  font-size: $font-size-sm;
  color: $text-secondary;
  border-radius: $radius-sm;
  transition: all 0.3s ease;

  &.active {
    background-color: $bg-primary;
    color: $primary-color;
    font-weight: 500;
  }
}

.growth-list {
  margin-top: $spacing-md;
}

.growth-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.growth-left {
  display: flex;
  flex-direction: column;
}

.growth-reason {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.growth-time {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.growth-amount {
  font-size: $font-size-lg;
  font-weight: bold;

  &.earn {
    color: $success-color;
  }

  &.consume {
    color: $error-color;
  }
}

.empty-tip,
.loading-tip {
  text-align: center;
  padding: $spacing-xl 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>
