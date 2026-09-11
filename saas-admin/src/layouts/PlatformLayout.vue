<template>
  <div class="platform-layout">
    <!-- 左侧深色导航 206px -->
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
          <router-link
            v-for="item in g.items"
            :key="item.path"
            :to="item.path"
            class="pf-nav-item"
            :class="{ 'is-active': isActive(item.path) }"
          >
            <span class="pf-nav-icon"><el-icon><component :is="item.icon" /></el-icon></span>
            <span>{{ item.title }}</span>
          </router-link>
        </template>
      </nav>

      <div class="pf-side-footer">
        <span class="pf-side-dot"></span>
        <span>生产环境</span>
      </div>
    </aside>

    <!-- 右侧主区 -->
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
        <div class="pf-topbar-right">
          <span class="pf-username">{{ authStore.adminInfo?.realName || authStore.adminInfo?.username }}</span>
          <el-button text @click="handleLogout">退出</el-button>
        </div>
      </header>

      <main class="pf-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { platformMenus, findMenuTitleByPath } from '../config/platform-menu'
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

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>
