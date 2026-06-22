<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { showSuccessToast, showDialog } from 'vant'
import { api, fetchAdminStores } from '../api'

// 角色中文化映射
const ROLE_MAP: Record<string, string> = {
  STAFF: '店员',
  MANAGER: '店长',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员'
}

const me = ref({
  realName: '',
  storeId: 1,
  role: '',
  permissions: [] as string[],
  storeName: '',
  storeAddress: '',
  mobile: ''
})
const loading = ref(false)

const roleLabel = computed(() => {
  return ROLE_MAP[me.value.role] || me.value.role || '未知角色'
})

// 门店列表
const stores = ref<Array<{ id: number; name: string; address?: string }>>([])
const showStorePicker = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/store/me')
    const data = res.data || {}
    me.value = {
      realName: data.realName || '商家用户',
      storeId: data.storeId || 1,
      role: data.role || '',
      permissions: data.permissions || [],
      storeName: data.storeName || '',
      storeAddress: data.storeAddress || '',
      mobile: data.mobile || ''
    }
  } catch {
    // 使用本地缓存
    const savedUser = localStorage.getItem('merchant_user')
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        me.value.realName = parsed.name || '商家用户'
        me.value.role = parsed.role || ''
      } catch {
        // ignore
      }
    }
  } finally {
    loading.value = false
  }

  // 加载门店列表（仅管理员可见）
  if (me.value.role === 'ADMIN' || me.value.role === 'SUPER_ADMIN') {
    try {
      const res = await fetchAdminStores({ page: 1, pageSize: 100 })
      const data = res.data
      stores.value = data?.records ?? data ?? []
    } catch {
      // ignore
    }
  }
})

function logout() {
  showDialog({
    title: '确认退出',
    message: '确定要退出登录吗？',
    showCancelButton: true,
    confirmButtonText: '确定退出',
    cancelButtonText: '取消'
  }).then(() => {
    localStorage.removeItem('merchant_token')
    localStorage.removeItem('merchant_user')
    window.dispatchEvent(new Event('auth:logout'))
  }).catch(() => {
    // 用户取消
  })
}

// 门店切换
function openStorePicker() {
  if (stores.value.length === 0) {
    showSuccessToast({ message: '暂无可切换的门店', position: 'bottom' })
    return
  }
  showStorePicker.value = true
}

function switchStore(storeId: number) {
  me.value.storeId = storeId
  const store = stores.value.find(s => s.id === storeId)
  if (store) {
    me.value.storeName = store.name
    me.value.storeAddress = store.address || ''
  }
  showStorePicker.value = false
  showSuccessToast({ message: '门店已切换', position: 'bottom' })
}

// 修改密码弹窗
const showPasswordDialog = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

function openPasswordDialog() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordDialog.value = true
}

async function submitChangePassword() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    showSuccessToast({ message: '请填写完整信息', position: 'bottom' })
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    showSuccessToast({ message: '两次密码输入不一致', position: 'bottom' })
    return
  }
  if (newPassword.value.length < 6) {
    showSuccessToast({ message: '新密码至少6位', position: 'bottom' })
    return
  }
  // TODO: 后端尚未实现 /store/auth/change-password，暂不调用 API
  showSuccessToast({ message: '功能开发中，敬请期待', position: 'bottom' })
  showPasswordDialog.value = false
}

// 关于弹窗
const showAboutDialog = ref(false)

// 系统设置菜单
const settingsMenu = [
  { label: '修改密码', icon: 'lock', action: 'password' },
  { label: '关于系统', icon: 'info-o', action: 'about' }
]

function handleSettingsClick(action: string) {
  if (action === 'password') {
    openPasswordDialog()
  } else if (action === 'about') {
    showAboutDialog.value = true
  }
}
</script>

<template>
  <section class="page">
    <!-- 用户信息卡片 -->
    <div class="card profile-card">
      <div class="profile-header">
        <div class="avatar-wrapper">
          <van-icon name="manager-o" size="56" color="var(--color-primary)" />
        </div>
        <div class="profile-info">
          <h2>{{ me.realName }}</h2>
          <div class="profile-meta">
            <van-tag v-if="me.role" plain size="medium" type="primary">{{ roleLabel }}</van-tag>
            <span v-if="me.mobile" class="mobile-text">{{ me.mobile }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 门店信息区域 -->
    <div class="card store-info-card">
      <div class="section-title">
        <van-icon name="shop-o" size="18" color="var(--color-primary)" />
        <span>门店信息</span>
      </div>
      <van-cell-group inset>
        <van-cell
          title="当前门店"
          :value="me.storeName || '暂无'"
          is-link
          @click="openStorePicker"
        />
        <van-cell title="门店地址" :value="me.storeAddress || '暂无'" />
        <van-cell title="门店ID" :value="String(me.storeId)" />
        <van-cell title="权限数" :value="`${me.permissions.length} 项`" />
      </van-cell-group>
    </div>

    <!-- 系统设置 -->
    <div class="card settings-card">
      <div class="section-title">
        <van-icon name="setting-o" size="18" color="var(--color-primary)" />
        <span>系统设置</span>
      </div>
      <van-cell-group inset>
        <van-cell
          v-for="item in settingsMenu"
          :key="item.action"
          :title="item.label"
          :icon="item.icon"
          is-link
          @click="handleSettingsClick(item.action)"
        />
      </van-cell-group>
    </div>

    <!-- 退出登录 -->
    <div class="logout-section">
      <van-button block type="danger" plain @click="logout">退出登录</van-button>
    </div>

    <!-- 门店切换弹窗 -->
    <van-popup
      v-model:show="showStorePicker"
      position="bottom"
      round
      :style="{ maxHeight: '60%' }"
    >
      <div class="store-picker-panel">
        <h3>切换门店</h3>
        <van-cell-group inset>
          <van-cell
            v-for="store in stores"
            :key="store.id"
            :title="store.name"
            :label="store.address || '-'"
            :icon="store.id === me.storeId ? 'success' : ''"
            is-link
            @click="switchStore(store.id)"
          />
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 修改密码弹窗 -->
    <van-dialog
      v-model:show="showPasswordDialog"
      title="修改密码"
      show-cancel-button
      confirm-button-text="确认修改"
      @confirm="submitChangePassword"
    >
      <div class="password-form">
        <van-field
          v-model="oldPassword"
          label="旧密码"
          type="password"
          placeholder="请输入旧密码"
        />
        <van-field
          v-model="newPassword"
          label="新密码"
          type="password"
          placeholder="请输入新密码（至少6位）"
        />
        <van-field
          v-model="confirmPassword"
          label="确认密码"
          type="password"
          placeholder="请再次输入新密码"
        />
      </div>
    </van-dialog>

    <!-- 关于弹窗 -->
    <van-dialog
      v-model:show="showAboutDialog"
      title="关于"
      confirm-button-text="知道了"
    >
      <div class="about-content">
        <div class="about-icon">
          <van-icon name="gem-o" size="48" color="var(--color-primary)" />
        </div>
        <h3 class="about-name">智享营销系统</h3>
        <p class="about-version">版本号：v1.0.0</p>
        <p class="about-desc">酒水行业进销存 + 营销管理系统</p>
      </div>
    </van-dialog>
  </section>
</template>

<style scoped>
/* ===== 用户信息卡片 ===== */
.profile-card {
  text-align: center;
  padding: 24px 16px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.avatar-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-info h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-text {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ===== 门店信息区域 ===== */
.store-info-card {
  margin-top: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== 系统设置 ===== */
.settings-card {
  margin-top: 12px;
}

/* ===== 修改密码表单 ===== */
.password-form {
  padding: 8px 0;
}

/* ===== 关于弹窗 ===== */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
}

.about-icon {
  margin-bottom: 12px;
}

.about-name {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.about-version {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--text-secondary);
}

.about-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== 门店切换弹窗 ===== */
.store-picker-panel {
  padding: 20px 16px;
}

.store-picker-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

/* ===== 退出登录 ===== */
.logout-section {
  margin-top: 24px;
}
</style>
