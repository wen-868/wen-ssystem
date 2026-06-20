<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { showSuccessToast, showDialog } from 'vant'
import { api } from '../api'

// 角色中文化映射
const ROLE_MAP: Record<string, string> = {
  STAFF: '店员',
  MANAGER: '店长',
  ADMIN: '管理员'
}

const me = ref({
  realName: '',
  storeId: 1,
  role: '',
  permissions: [] as string[],
  storeName: '',
  storeAddress: ''
})
const loading = ref(false)

const roleLabel = computed(() => {
  return ROLE_MAP[me.value.role] || me.value.role || '未知角色'
})

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
      storeAddress: data.storeAddress || ''
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
  // 待后端接口就绪后取消下方注释
  // try {
  //   showLoadingToast({ message: '提交中...', forbidClick: true })
  //   await api.post('/store/auth/change-password', {
  //     oldPassword: oldPassword.value,
  //     newPassword: newPassword.value
  //   })
  //   closeToast()
  //   showSuccessToast('密码修改成功')
  //   showPasswordDialog.value = false
  // } catch {
  //   closeToast()
  // }
  showSuccessToast({ message: '功能开发中，敬请期待', position: 'bottom' })
  showPasswordDialog.value = false
}

// 关于弹窗
const showAboutDialog = ref(false)
</script>

<template>
  <section class="page">
    <!-- 用户信息卡片 -->
    <div class="card profile-card">
      <div class="profile-header">
        <van-icon name="manager-o" size="48" color="var(--color-primary)" />
        <div class="profile-info">
          <h2>{{ me.realName }}</h2>
          <van-tag v-if="me.role" plain size="medium">{{ roleLabel }}</van-tag>
        </div>
      </div>
      <van-cell-group inset>
        <van-cell title="门店ID" :value="String(me.storeId)" />
        <van-cell title="权限数" :value="`${me.permissions.length} 项`" />
      </van-cell-group>
    </div>

    <!-- 门店信息区域 -->
    <div class="card store-info-card">
      <div class="section-title">
        <van-icon name="shop-o" size="18" color="var(--color-primary)" />
        <span>门店信息</span>
      </div>
      <van-cell-group inset>
        <van-cell title="门店名称" :value="me.storeName || '暂无'" />
        <van-cell title="门店地址" :value="me.storeAddress || '暂无'" />
      </van-cell-group>
    </div>

    <!-- 功能入口 -->
    <div class="card">
      <van-cell-group inset>
        <van-cell
          title="修改密码"
          icon="lock"
          is-link
          @click="openPasswordDialog"
        />
        <van-cell
          title="关于"
          icon="info-o"
          is-link
          @click="showAboutDialog = true"
        />
      </van-cell-group>
    </div>

    <!-- 退出登录 -->
    <div class="logout-section">
      <van-button block type="danger" plain @click="logout">退出登录</van-button>
    </div>

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
      </div>
    </van-dialog>
  </section>
</template>

<style scoped>
.profile-card {
  text-align: center;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.profile-info h2 {
  margin: 8px 0 4px;
  font-size: 18px;
  color: var(--text-primary);
}

/* 门店信息区域 */
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

/* 修改密码表单 */
.password-form {
  padding: 8px 0;
}

/* 关于弹窗 */
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
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

/* 退出登录 */
.logout-section {
  margin-top: 24px;
}
</style>
