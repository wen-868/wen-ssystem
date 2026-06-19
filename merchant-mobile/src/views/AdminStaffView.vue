<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchAdminStaff,
  type AdminStaffRecord
} from '../api'

const router = useRouter()

const keyword = ref('')
const staffList = ref<AdminStaffRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

/* ========== 新增/编辑弹窗 ========== */
const showStaffPopup = ref(false)
const isEdit = ref(false)
const showRolePicker = ref(false)
const staffForm = ref({
  staffId: 0,
  username: '',
  realName: '',
  mobile: '',
  roleId: '' as string,
  storeId: 0,
  status: 1
})

const roleOptions = [
  { text: '管理员', value: 'admin' },
  { text: '销售员', value: 'sales' },
  { text: '仓管员', value: 'warehouse' },
  { text: '收银员', value: 'cashier' }
]

/* ========== 列表加载 ========== */
async function loadStaff() {
  loading.value = true
  try {
    const res = await fetchAdminStaff()
    const data = res.data.data
    const records = data.records ?? data ?? []
    staffList.value = records
    finished.value = true
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadStaff(true)
}

function onRefresh() {
  refreshing.value = true
  loadStaff(true)
}

function openAddStaff() {
  isEdit.value = false
  staffForm.value = {
    staffId: 0,
    username: '',
    realName: '',
    mobile: '',
    roleId: 'sales',
    storeId: 1,
    status: 1
  }
  showStaffPopup.value = true
}

function openEditStaff(item: AdminStaffRecord) {
  isEdit.value = true
  staffForm.value = {
    staffId: item.staffId,
    username: item.username,
    realName: item.realName,
    mobile: '',
    roleId: 'sales',
    storeId: item.storeId,
    status: item.status
  }
  showStaffPopup.value = true
}

async function submitStaff() {
  if (!staffForm.value.username || !staffForm.value.realName) {
    showSuccessToast({ message: '请填写用户名和姓名', position: 'bottom' })
    return
  }
  try {
    showLoadingToast({ message: '保存中...', forbidClick: true })
    // Simulate API call
    await new Promise(r => setTimeout(r, 500))
    closeToast()
    showSuccessToast(isEdit.value ? '员工信息已更新' : '员工已添加')
    showStaffPopup.value = false
    await loadStaff(true)
  } catch {
    closeToast()
  }
}

function getStatusText(status: number) {
  return status === 1 ? '在职' : '离职'
}

onMounted(() => {
  loadStaff(true)
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <h2 class="page-title">员工管理</h2>
      <span style="width: 20px;"></span>
    </div>

    <van-search
      v-model="keyword"
      placeholder="搜索员工姓名/用户名"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <div class="action-bar">
      <van-button type="primary" size="small" icon="plus" @click="openAddStaff">
        新增员工
      </van-button>
      <span class="record-count">共 {{ staffList.length }} 人</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadStaff"
      >
        <div v-if="staffList.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无员工" />
        </div>
        <van-cell
          v-for="item in staffList"
          :key="item.staffId"
          is-link
          class="staff-cell"
          @click="openEditStaff(item)"
        >
          <template #title>
            <div class="staff-header">
              <span class="staff-name">{{ item.realName || item.username }}</span>
              <van-tag :type="item.status === 1 ? 'success' : 'default'" plain size="medium">
                {{ getStatusText(item.status) }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="staff-meta">
              <span>用户名: {{ item.username }}</span>
              <span>门店ID: {{ item.storeId }}</span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 新增/编辑弹窗 -->
    <van-popup
      v-model:show="showStaffPopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="form-panel">
        <h3>{{ isEdit ? '编辑员工' : '新增员工' }}</h3>
        <van-cell-group inset>
          <van-field
            v-model="staffForm.username"
            label="用户名"
            placeholder="请输入用户名"
            required
          />
          <van-field
            v-model="staffForm.realName"
            label="姓名"
            placeholder="请输入真实姓名"
            required
          />
          <van-field
            v-model="staffForm.mobile"
            label="手机号"
            placeholder="请输入手机号"
            type="tel"
          />
          <van-field
            v-model="staffForm.roleId"
            label="角色"
            placeholder="请选择角色"
            is-link
            readonly
            @click="showRolePicker = true"
          />
          <van-field
            v-model="staffForm.storeId"
            label="门店ID"
            placeholder="所属门店"
            type="number"
          />
        </van-cell-group>
        <div class="form-actions">
          <van-button block type="primary" @click="submitStaff">保存</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.staff-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.staff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.staff-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.staff-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.form-panel,
.price-panel {
  padding: 20px 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.form-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.form-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
