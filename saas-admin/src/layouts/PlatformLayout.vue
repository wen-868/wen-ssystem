<template>
  <div class="platform-layout">
    <!-- 左侧浅色导航 206px（设计稿 .sh-side） -->
    <aside class="pf-aside">
      <div class="pf-brand">
        <span class="pf-brand-logo">智</span>
        <span>
          <b class="pf-brand-name">智享全链</b>
          <i class="pf-brand-sub">平台总后台</i>
        </span>
      </div>

      <nav class="pf-nav">
        <template v-for="g in platformMenus" :key="g.group">
          <div class="pf-nav-group">{{ g.group }}</div>
          <template v-for="item in g.items" :key="item.path">
            <router-link
              v-if="!item.pending"
              :to="item.path"
              class="pf-nav-item"
              :class="{ 'is-active': isActive(item.path) }"
            >
              <span class="pf-nav-icon"><el-icon><component :is="item.icon" /></el-icon></span>
              <span>{{ item.title }}</span>
            </router-link>
            <!-- 设计稿有菜单项但无界面规范：置灰不可点，避免 404 -->
            <span v-else class="pf-nav-item is-pending" :title="item.title + ' · 设计稿未提供界面规范，待补充'">
              <span class="pf-nav-icon"><el-icon><component :is="item.icon" /></el-icon></span>
              <span>{{ item.title }}</span>
            </span>
          </template>
        </template>
      </nav>

      <div class="pf-side-footer">
        <span class="pf-side-dot"></span>
        <span>生产环境 · {{ PLATFORM_VERSION }}</span>
      </div>
    </aside>

    <!-- 右侧主区（设计稿 .sh-r） -->
    <div class="pf-body">
      <header class="pf-topbar">
        <div class="pf-crumb">
          <template v-if="currentMenu">
            {{ currentMenu.group }} / <b>{{ currentMenu.title }}</b>
          </template>
          <template v-else>
            <b>{{ route.meta.title || '平台总后台' }}</b>
          </template>
        </div>

        <div class="pf-tools">
          <div class="pf-sbox" role="search">
            <el-icon><Search /></el-icon>
            <span>搜索租户 / 账单 / 工单</span>
            <kbd>Ctrl K</kbd>
          </div>
          <span class="pf-bell" role="button" aria-label="通知">
            <el-icon><Bell /></el-icon>
            <b v-if="unreadCount > 0">{{ unreadCount }}</b>
          </span>
          <span class="pf-ava">{{ avatarChar }}</span>
          <span class="pf-uname">{{ userLabel }}</span>
          <el-button text size="small" @click="handleLogout">退出</el-button>
        </div>
      </header>

      <main class="pf-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Bell } from '@element-plus/icons-vue'
import { platformMenus, findMenuTitleByPath } from '../config/platform-menu'
import { PLATFORM_VERSION } from '../config/platform'
import { useAuthStore } from '../stores/auth'
import '../styles/layout.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

/**
 * 选中判定：先精确匹配，再前缀匹配（覆盖 /tenants/:id、/packages/:id/edit 等详情/编辑页），
 * 前缀匹配取最长路径，避免 /tenants 与 /tenant-usage 互相误命中。
 */
function isActive(path: string): boolean {
  const cur = route.path
  if (cur === path) return true
  if (!cur.startsWith(path + '/')) return false
  const longer = platformMenus
    .flatMap((g) => g.items.map((i) => i.path))
    .filter((p) => p !== path && cur.startsWith(p + '/') && p.length > path.length)
  return longer.length === 0
}

const currentMenu = computed(() => findMenuTitleByPath(route.path))

/** 登录管理员信息：store 中该字段类型为 Ref，用 unref 兼容「Ref / 已解包」两种形态 */
const adminInfo = computed(() => unref(authStore.adminInfo))

/** 头像首字（设计稿 .ava 显示姓氏） */
const avatarChar = computed(() => {
  const name = adminInfo.value?.realName || adminInfo.value?.username || ''
  return name ? name.slice(0, 1) : '—'
})

/** 用户名 + 角色（设计稿 .uname：陈默 · 超级管理员） */
const userLabel = computed(() => {
  const info = adminInfo.value
  if (!info) return '未登录'
  return `${info.realName || info.username} · 超级管理员`
})

/** 通知未读数：待接入真实接口后填充，当前不虚构数据 */
const unreadCount = computed(() => 0)

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>
