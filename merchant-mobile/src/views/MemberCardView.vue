<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMemberCard, fetchMemberBenefits, type MemberCardData, type MemberBenefit } from '../api'

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.customerId)

const card = ref<MemberCardData | null>(null)
const benefits = ref<MemberBenefit[]>([])
const loading = ref(true)

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}
function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

const LEVEL_ICONS: Record<string, string> = {
  NORMAL: 'user-o',
  VIP: 'vip-card-o',
  GOLD: 'gold-coin-o',
  DIAMOND: 'diamond-o',
  WHOLESALE: 'shop-o'
}

onMounted(async () => {
  try {
    const [cardRes, benefitsRes] = await Promise.all([
      fetchMemberCard(customerId),
      fetchMemberBenefits().catch(() => ({ data: [] }))
    ])
    card.value = cardRes.data as MemberCardData
    benefits.value = (benefitsRes.data as MemberBenefit[]) ?? []
  } catch { /* ignore */ }
  finally { loading.value = false }
})
</script>

<template>
  <div class="member-card-view">
    <van-nav-bar title="会员卡" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="card">
      <!-- 会员卡正面 -->
      <div class="card-box">
        <div class="card-front">
          <div class="card-level-badge">
            <van-icon :name="LEVEL_ICONS[card.levelCode] || 'vip-card-o'" size="20" />
            <span>{{ card.levelName }}</span>
          </div>
          <div class="card-name">{{ card.name }}</div>
          <div class="card-points">{{ card.points }} 积分</div>
          <div class="card-discount">消费享 {{ card.discount }}% 折扣</div>
          <div class="card-validity">有效期至 {{ card.status === 1 ? '永久有效' : '-' }}</div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="quick-actions">
        <div class="quick-btn" @click="router.push(`/customer-points/${customerId}`)">
          <van-icon name="points" size="20" color="var(--color-primary)" />
          <span>积分</span>
        </div>
        <div class="quick-btn" @click="router.push(`/store-value-card/${customerId}`)">
          <van-icon name="balance-o" size="20" color="var(--color-primary)" />
          <span>储值卡</span>
        </div>
      </div>

      <!-- 会员权益 -->
      <div class="section-card" v-if="benefits.length > 0 || card.benefits.length > 0">
        <h3 class="section-title">会员权益</h3>
        <div class="benefits-list">
          <div v-for="(b, idx) in (card!.benefits.length > 0 ? card!.benefits : benefits.find(b => b.code === card!.levelCode)?.benefits ?? [])" :key="idx" class="benefit-item">
            <van-icon name="checked" size="14" color="var(--color-success)" />
            <span>{{ b }}</span>
          </div>
        </div>
      </div>

      <!-- 等级说明 -->
      <div class="section-card" v-if="benefits.length > 0">
        <h3 class="section-title">等级说明</h3>
        <div v-for="b in benefits" :key="b.code" class="level-row">
          <div class="level-info">
            <van-icon :name="LEVEL_ICONS[b.code] || 'vip-card-o'" size="18" />
            <span class="level-name">{{ b.name }}</span>
            <span class="level-discount">{{ b.discount }}%</span>
          </div>
          <div class="level-min">≥{{ b.minPoints }} 积分</div>
        </div>
      </div>

      <!-- 最近消费 -->
      <div class="section-card" v-if="card.recentOrders?.length > 0">
        <h3 class="section-title">最近消费</h3>
        <div v-for="o in card.recentOrders" :key="o.id" class="order-item">
          <div class="order-no">{{ o.saleNo || '#' + o.id }}</div>
          <div class="order-amount">¥{{ formatPrice(o.receivableAmount) }}</div>
          <div class="order-date">{{ formatDate(o.createdAt) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.member-card-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }
.loading-center { padding: 60px 0; display: flex; justify-content: center; }

.card-box { padding: 12px 16px; }
.card-front {
  padding: 24px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 16px;
  color: #fff;
  text-align: center;
}

.card-level-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 14px; border-radius: 20px;
  background: rgba(255,255,255,.15); font-size: 13px;
}

.card-name { font-size: 22px; font-weight: 700; margin: 12px 0 6px; }
.card-points { font-size: 28px; font-weight: 700; color: #ffd700; }
.card-discount { font-size: 13px; opacity: 0.85; margin-top: 4px; }
.card-validity { font-size: 11px; opacity: 0.6; margin-top: 6px; }

.quick-actions {
  display: flex; gap: 10px; padding: 12px 16px;
}

.quick-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px; background: var(--bg-card); border-radius: 12px;
  font-size: 12px; color: var(--text-secondary);
  box-shadow: var(--shadow-card);
}

.section-card { margin: 0 16px 12px; background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-card); }
.section-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; }

.benefits-list { display: flex; flex-direction: column; gap: 8px; }
.benefit-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }

.level-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.level-row:last-child { border-bottom: none; }
.level-info { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.level-name { color: var(--text-primary); font-weight: 500; }
.level-discount { color: var(--color-primary); font-weight: 600; }
.level-min { font-size: 12px; color: var(--text-hint); }

.order-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.order-no { color: var(--text-primary); }
.order-amount { color: var(--color-primary); font-weight: 600; }
.order-date { color: var(--text-hint); font-size: 12px; }
</style>