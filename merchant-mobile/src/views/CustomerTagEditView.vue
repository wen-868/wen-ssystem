<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchCustomerTags, fetchAllTags, addCustomerTag, removeCustomerTag, fetchCustomerProfile, type CustomerTag, type CustomerProfile } from '../api'

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.customerId)

const myTags = ref<CustomerTag[]>([])
const allTags = ref<CustomerTag[]>([])
const profile = ref<CustomerProfile | null>(null)
const loading = ref(true)

const TAG_COLORS: Record<string, string> = {
  '#f5222d': '#fff1f0',
  '#fa541c': '#fff2e8',
  '#fa8c16': '#fff7e6',
  '#faad14': '#fffbe6',
  '#52c41a': '#f6ffed',
  '#13c2c2': '#e6fffb',
  '#1890ff': '#e6f7ff',
  '#722ed1': '#f9f0ff',
  '#eb2f96': '#fff0f6',
}

function getTagStyle(color: string) {
  return { background: TAG_COLORS[color] || '#f0f0f0', color: color || '#666' }
}

function isMyTag(tagId: number) {
  return myTags.value.some(t => t.tagId === tagId)
}

async function loadData() {
  loading.value = true
  try {
    const [tags, all, prof] = await Promise.all([
      fetchCustomerTags(customerId),
      fetchAllTags(),
      fetchCustomerProfile(customerId).catch(() => ({ data: null }))
    ])
    const tData = (tags.data as any)?.records ?? tags.data
    myTags.value = Array.isArray(tData) ? tData : []
    const aData = (all.data as any)?.records ?? all.data
    allTags.value = Array.isArray(aData) ? aData : []
    profile.value = prof.data as CustomerProfile
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function toggleTag(tag: CustomerTag) {
  if (isMyTag(tag.id)) {
    try {
      await removeCustomerTag(customerId, tag.id)
      myTags.value = myTags.value.filter(t => t.tagId !== tag.id)
    } catch { showToast('移除失败') }
  } else {
    try {
      await addCustomerTag(customerId, tag.id)
      myTags.value.push({ ...tag, tagId: tag.id })
    } catch { showToast('添加失败') }
  }
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="customer-tag-view">
    <van-nav-bar title="编辑标签" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else>
      <!-- 客户画像 -->
      <div class="section-card" v-if="profile">
        <h3 class="section-title">客户画像</h3>
        <div class="profile-grid">
          <div class="profile-item">
            <div class="profile-label">偏好</div>
            <div class="profile-value">{{ profile.customerType }}</div>
          </div>
          <div class="profile-item">
            <div class="profile-label">消费次数</div>
            <div class="profile-value">{{ profile.orderCount }} 次</div>
          </div>
          <div class="profile-item">
            <div class="profile-label">平均客单价</div>
            <div class="profile-value">¥{{ profile.avgOrderAmount?.toFixed(2) ?? '0.00' }}</div>
          </div>
          <div class="profile-item">
            <div class="profile-label">积分</div>
            <div class="profile-value">{{ profile.points }}</div>
          </div>
        </div>
      </div>

      <!-- 已打标签 -->
      <div class="section-card">
        <h3 class="section-title">已打标签</h3>
        <div class="tag-cloud">
          <span v-for="t in myTags" :key="t.id" class="tag-chip" :style="getTagStyle(t.color)" @click="toggleTag(t)">
            {{ t.tagName }} <van-icon name="cross" size="10" />
          </span>
          <van-empty v-if="myTags.length === 0" description="暂无标签" />
        </div>
      </div>

      <!-- 可选标签 -->
      <div class="section-card">
        <h3 class="section-title">可选标签</h3>
        <div v-for="(group, gid) in [...new Set(allTags.map(t => t.groupName))]" :key="gid" class="tag-group">
          <div class="tag-group-name">{{ group || '默认分组' }}</div>
          <div class="tag-cloud">
            <span
              v-for="t in allTags.filter(t => t.groupName === group)"
              :key="t.id"
              class="tag-chip"
              :class="{ active: isMyTag(t.id) }"
              :style="getTagStyle(t.color)"
              @click="toggleTag(t)"
            >
              {{ isMyTag(t.id) ? '✓ ' : '' }}{{ t.tagName }}
            </span>
          </div>
        </div>
        <van-empty v-if="allTags.length === 0" description="暂无可选标签" />
      </div>
    </template>

    <!-- 保存 -->
    <div class="save-section">
      <van-button type="primary" size="large" round block @click="router.back()">完成</van-button>
    </div>
  </div>
</template>

<style scoped>
.customer-tag-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }
.loading-center { padding: 60px 0; display: flex; justify-content: center; }

.section-card { margin: 0 16px 12px; background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-card); }
.section-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; }

.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.profile-item { background: var(--bg-page); border-radius: 8px; padding: 10px; text-align: center; }
.profile-label { font-size: 11px; color: var(--text-hint); }
.profile-value { font-size: 15px; font-weight: 600; color: var(--color-primary); margin-top: 2px; }

.tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-chip { padding: 4px 12px; border-radius: 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
.tag-chip.active { border: 2px solid var(--color-primary); }

.tag-group { margin-bottom: 12px; }
.tag-group-name { font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500; }

.save-section { padding: 16px; }
</style>