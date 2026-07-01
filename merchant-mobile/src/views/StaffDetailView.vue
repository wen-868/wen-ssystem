<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchEmployeeDetail, type EmployeeDetailRecord } from '../api'

const route = useRoute()
const router = useRouter()
const staffId = Number(route.params.staffId)
const loading = ref(true)
const detail = ref<EmployeeDetailRecord | null>(null)

const roleColorMap: Record<string, string> = {
  admin: 'danger',
  manager: 'warning',
  staff: 'primary'
}

const roleNameMap: Record<string, string> = {
  admin: '管理员',
  manager: '店长',
  staff: '员工'
}

const statusMap: Record<number, { text: string; type: string }> = {
  1: { text: '在职', type: 'success' },
  0: { text: '离职', type: 'default' }
}

async function loadDetail() {
  loading.value = true
  try {
    const res = await fetchEmployeeDetail(staffId)
    detail.value = res.data
  } catch {
    showToast('加载员工详情失败')
  } finally {
    loading.value = false
  }
}

function callPhone() {
  if (!detail.value?.mobile) {
    showToast('暂无手机号')
    return
  }
  window.location.href = `tel:${detail.value.mobile}`
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <section class="page">
    <van-nav-bar
      title="员工详情"
      left-arrow
      @click-left="goBack"
    />

    <div v-if="!loading && detail" class="content">
      <!-- 头像区域 -->
      <div class="avatar-section">
        <div class="avatar-box">
          <van-icon name="manager-o" size="64" color="#fff" />
        </div>
        <h1 class="staff-name">{{ detail.realName }}</h1>
        <van-tag
          :type="roleColorMap[detail.role] || 'default'"
          size="large"
          plain
        >
          {{ detail.roleName || roleNameMap[detail.role] || detail.role }}
        </van-tag>
      </div>

      <!-- 基本信息 -->
      <van-cell-group inset class="info-group">
        <van-cell title="工号" :value="String(detail.staffId)" />
        <van-cell title="姓名" :value="detail.realName" />
        <van-cell
          title="手机号"
          :value="detail.mobile || '-' "
          is-link
          @click="callPhone"
        >
          <template #right-icon>
            <van-icon name="phone-o" />
          </template>
        </van-cell>
        <van-cell title="角色">
          <van-tag
            :type="roleColorMap[detail.role] || 'default'"
            size="medium"
          >
            {{ detail.roleName || roleNameMap[detail.role] || detail.role }}
          </van-tag>
        </van-cell>
        <van-cell title="所属门店" :value="detail.storeName || String(detail.storeId)" />
        <van-cell title="职位" :value="detail.position || '-' " />
        <van-cell title="入职时间" :value="detail.hireDate || detail.createdAt || '-' " />
        <van-cell title="状态">
          <van-tag
            :type="statusMap[detail.status]?.type || 'default'"
            size="medium"
          >
            {{ statusMap[detail.status]?.text || (detail.status === 1 ? '在职' : '离职') }}
          </van-tag>
        </van-cell>
      </van-cell-group>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <van-skeleton
        :rows="8"
        avatar
        :title-width="120"
        :row-widths="['100%', '80%', '90%', '70%', '100%', '85%', '60%']"
      />
    </div>

    <!-- 底部操作栏 -->
    <van-action-bar v-if="!loading && detail && detail.mobile">
      <van-action-bar-button
        type="primary"
        icon="phone-o"
        @click="callPhone"
      >
        拨打员工电话
      </van-action-bar-button>
    </van-action-bar>
  </section>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 60px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 24px;
  background: linear-gradient(135deg, #1989fa 0%, #409eff 100%);
}

.avatar-box {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.staff-name {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.info-group {
  margin: 16px;
  border-radius: 8px;
}

.loading-wrapper {
  padding: 16px;
}

.content {
  padding-bottom: 80px;
}
</style>