<template>
  <div class="notification-detail-page">
    <van-nav-bar
      title="通知详情"
      left-arrow
      @click-left="$router.back()"
    />
    <div v-if="notification" class="detail-content">
      <div class="detail-header">
        <div class="detail-icon-wrapper">
          <van-icon :name="iconMap[notification.type] || 'bullhorn-o'" size="24" />
        </div>
        <h2 class="detail-title">{{ notification.title }}</h2>
        <p class="detail-time">{{ notification.createdAt }}</p>
      </div>
      <div class="detail-body">
        <van-cell :value="notification.fullContent || notification.content" />
      </div>
      <div v-if="hasRelatedLink" class="detail-action">
        <van-button
          type="primary"
          block
          @click="goToRelated"
        >
          {{ relatedButtonText }}
        </van-button>
      </div>
    </div>
    <div v-else-if="loading" class="detail-loading">
      <van-loading />
    </div>
    <div v-else class="detail-empty">
      <van-empty description="通知不存在" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchNotifications, type NotificationItem } from '../api'

const route = useRoute()
const router = useRouter()

const iconMap: Record<string, string> = {
  SYSTEM: 'setting-o',
  ORDER: 'orders-o',
  PAYMENT: 'gold-coin-o',
  ALERT: 'warning-o',
  CREDIT: 'shield-o',
  RECALL: 'chat-o'
}

const notification = ref<(NotificationItem & { fullContent?: string; relatedLink?: string }) | null>(null)
const loading = ref(true)

const hasRelatedLink = computed(() => {
  return !!notification.value?.relatedLink
})

const relatedButtonText = computed(() => {
  const type = notification.value?.type
  if (type === 'ORDER') return '查看订单'
  if (type === 'PAYMENT') return '查看收款'
  return '查看详情'
})

async function loadDetail() {
  loading.value = true
  const id = Number(route.params.id)

  try {
    // 先从 query 获取传递的数据
    if (route.query.title) {
      notification.value = {
        id,
        type: (route.query.type as string) || '',
        title: (route.query.title as string) || '',
        content: (route.query.content as string) || '',
        summary: (route.query.summary as string) || '',
        isRead: true,
        relatedId: (route.query.relatedId as string) || '',
        relatedType: (route.query.relatedType as string) || '',
        createdAt: (route.query.createdAt as string) || '',
        fullContent: (route.query.content as string) || '',
        relatedLink: ''
      }
      loading.value = false
      return
    }

    // 从列表数据中查找
    const res = await fetchNotifications({ page: 1, pageSize: 100 })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as NotificationItem[]
    const found = items.find((item: NotificationItem) => item.id === id)
    if (found) {
      notification.value = {
        ...found,
        fullContent: found.content,
        relatedLink: found.relatedType ? `/${found.relatedType.toLowerCase()}/${found.relatedId}` : ''
      }
    } else {
      notification.value = null
    }
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function goToRelated() {
  const type = notification.value?.type
  if (type === 'ORDER') {
    router.push({ path: '/orders' })
  } else if (type === 'PAYMENT') {
    router.push({ path: '/receivables' })
  } else if (notification.value?.relatedLink) {
    router.push({ path: notification.value.relatedLink })
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.notification-detail-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.detail-content {
  background: #fff;
}

.detail-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 20px;
  background: #fff;
}

.detail-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: #f0f2f5;
  border-radius: 50%;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px;
  text-align: center;
}

.detail-time {
  font-size: 13px;
  color: #999;
  margin: 0;
}

.detail-body {
  margin-top: 12px;
}

.detail-action {
  padding: 24px 16px;
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: 100px 0;
}

.detail-empty {
  padding-top: 100px;
}
</style>