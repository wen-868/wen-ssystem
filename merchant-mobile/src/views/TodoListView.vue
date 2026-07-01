<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchTodos,
  fetchTodoStats,
  completeTodo,
  ignoreTodo,
  createTodo,
  type TodoItem,
  type TodoStats
} from '../api'

const router = useRouter()

/* ========== 常量映射 ========== */

const PRIORITY_MAP: Record<string, { label: string; color: string; type: string }> = {
  HIGH: { label: '高', color: '#E2231A', type: 'danger' },
  MEDIUM: { label: '中', color: '#FF6B35', type: 'warning' },
  LOW: { label: '低', color: '#999', type: 'default' }
}

const TYPE_MAP: Record<string, { label: string; icon: string; bgColor: string }> = {
  INVENTORY: { label: '库存预警', icon: 'warning-o', bgColor: '#FFF0F0' },
  ORDER: { label: '订单处理', icon: 'orders-o', bgColor: '#E8F4FD' },
  CUSTOMER: { label: '客户跟进', icon: 'friends-o', bgColor: '#E6F7FF' },
  RECEIVABLE: { label: '收款提醒', icon: 'gold-coin-o', bgColor: '#FFF7E6' },
  SYSTEM: { label: '系统通知', icon: 'setting-o', bgColor: '#F0F2F5' },
  OTHER: { label: '其他', icon: 'bullhorn-o', bgColor: '#F0F2F5' }
}

const PRIORITY_OPTIONS = [
  { text: '高', value: 'HIGH' },
  { text: '中', value: 'MEDIUM' },
  { text: '低', value: 'LOW' }
]

const TYPE_OPTIONS = [
  { text: '库存预警', value: 'INVENTORY' },
  { text: '订单处理', value: 'ORDER' },
  { text: '客户跟进', value: 'CUSTOMER' },
  { text: '收款提醒', value: 'RECEIVABLE' },
  { text: '系统通知', value: 'SYSTEM' },
  { text: '其他', value: 'OTHER' }
]

const priorityFilterOptions = [
  { text: '全部', value: '' },
  { text: '高', value: 'HIGH' },
  { text: '中', value: 'MEDIUM' },
  { text: '低', value: 'LOW' }
]

const statusFilterOptions = [
  { text: '全部', value: '' },
  { text: '待处理', value: 'PENDING' },
  { text: '已完成', value: 'DONE' },
  { text: '已忽略', value: 'IGNORED' }
]

/* ========== 类型统计 ========== */

const stats = ref<TodoStats | null>(null)
const activeType = ref('ALL')

const typeTabs = computed(() => {
  const tabs = [{ type: 'ALL', label: '全部', icon: 'label-o', count: stats.value?.totalCount ?? 0 }]
  if (stats.value?.typeStats) {
    for (const s of stats.value.typeStats) {
      const t = TYPE_MAP[s.type]
      tabs.push({
        type: s.type,
        label: s.label || t?.label || s.type,
        icon: t?.icon || 'label-o',
        count: s.count
      })
    }
  }
  return tabs
})

async function loadStats() {
  try {
    const res = await fetchTodoStats()
    stats.value = (res.data as TodoStats) ?? null
  } catch {
    // ignore
  }
}

function selectType(type: string) {
  activeType.value = type
  loadTodos(true)
}

/* ========== 筛选 ========== */

const filterPriority = ref('')
const filterStatus = ref('')

function onFilterChange() {
  loadTodos(true)
}

/* ========== 列表 ========== */

const todos = ref<TodoItem[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

async function loadTodos(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchTodos({
      page: page.value,
      pageSize: 20,
      type: activeType.value === 'ALL' ? undefined : activeType.value,
      priority: filterPriority.value || undefined,
      status: filterStatus.value || undefined
    })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as TodoItem[]
    if (reset) {
      todos.value = items
    } else {
      todos.value.push(...items)
    }
    const total = data?.total ?? items.length
    if (todos.value.length >= total) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadTodos(true)
}

/* ========== 相对时间 ========== */

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const target = new Date(dateStr).getTime()
  if (isNaN(target)) return ''
  const diff = target - now
  const absDiff = Math.abs(diff)
  const minutes = Math.floor(absDiff / 60000)
  const hours = Math.floor(absDiff / 3600000)
  const days = Math.floor(absDiff / 86400000)

  if (diff < 0) {
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return '已过期'
  }
  if (minutes < 1) return '即将到期'
  if (minutes < 60) return `${minutes}分钟后`
  if (hours < 24) return `${hours}小时后`
  if (days < 30) return `${days}天后`
  return '未来'
}

/* ========== 操作 ========== */

async function onComplete(item: TodoItem) {
  showLoadingToast({ message: '处理中...', forbidClick: true })
  try {
    await completeTodo(item.id)
    closeToast()
    showSuccessToast('已完成')
    loadTodos(true)
    loadStats()
  } catch {
    closeToast()
    showToast('操作失败')
  }
}

async function onIgnore(item: TodoItem) {
  showLoadingToast({ message: '处理中...', forbidClick: true })
  try {
    await ignoreTodo(item.id)
    closeToast()
    showSuccessToast('已忽略')
    loadTodos(true)
    loadStats()
  } catch {
    closeToast()
    showToast('操作失败')
  }
}

function goToRelated(item: TodoItem) {
  const map: Record<string, string> = {
    INVENTORY: '/inventory',
    ORDER: '/orders',
    CUSTOMER: '/customers',
    RECEIVABLE: '/receivables',
    SYSTEM: '/notifications'
  }
  const path = map[item.relatedType] || '/'
  router.push(path)
}

/* ========== 新建待办 ========== */

const showCreatePopup = ref(false)
const showTypePicker = ref(false)
const showPriorityPicker = ref(false)
const showDatePicker = ref(false)

const createForm = ref({
  title: '',
  type: 'INVENTORY',
  priority: 'MEDIUM',
  dueDate: '',
  remark: ''
})

const submitting = ref(false)

const minDate = new Date()
const maxDate = new Date()
maxDate.setFullYear(maxDate.getFullYear() + 1)

function openCreate() {
  createForm.value = { title: '', type: 'INVENTORY', priority: 'MEDIUM', dueDate: '', remark: '' }
  showCreatePopup.value = true
}

function onTypeConfirm({ selectedOptions }: any) {
  createForm.value.type = selectedOptions[0]?.value || 'INVENTORY'
  showTypePicker.value = false
}

function onPriorityConfirm({ selectedOptions }: any) {
  createForm.value.priority = selectedOptions[0]?.value || 'MEDIUM'
  showPriorityPicker.value = false
}

function onDateConfirm({ selectedValues }: any) {
  const [year, month, day] = selectedValues
  createForm.value.dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  showDatePicker.value = false
}

async function onSubmitCreate() {
  if (!createForm.value.title.trim()) {
    showToast('请输入标题')
    return
  }
  submitting.value = true
  showLoadingToast({ message: '创建中...', forbidClick: true })
  try {
    await createTodo({
      title: createForm.value.title,
      type: createForm.value.type,
      priority: createForm.value.priority,
      dueDate: createForm.value.dueDate || undefined,
      remark: createForm.value.remark || undefined
    })
    showCreatePopup.value = false
    closeToast()
    showSuccessToast('创建成功')
    loadTodos(true)
    loadStats()
  } catch (e: any) {
    closeToast()
    showToast(e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

/* ========== Lifecycle ========== */

onMounted(() => {
  loadStats()
  loadTodos(true)
})
</script>

<template>
  <div class="todo-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="待办事项"
      left-arrow
      @click-left="router.back"
    >
      <template #right>
        <van-button size="small" type="primary" @click="openCreate">新建</van-button>
      </template>
    </van-nav-bar>

    <!-- 类型统计标签栏 -->
    <div class="type-tabs-wrapper">
      <div class="type-tabs">
        <div
          v-for="tab in typeTabs"
          :key="tab.type"
          class="type-tab"
          :class="{ active: activeType === tab.type }"
          @click="selectType(tab.type)"
        >
          <van-icon :name="tab.icon" size="16" />
          <span class="type-tab-label">{{ tab.label }}</span>
          <span class="type-tab-count">{{ tab.count }}</span>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <van-dropdown-menu>
      <van-dropdown-item
        v-model="filterPriority"
        :options="priorityFilterOptions"
        title="优先级"
        @change="onFilterChange"
      />
      <van-dropdown-item
        v-model="filterStatus"
        :options="statusFilterOptions"
        title="状态"
        @change="onFilterChange"
      />
    </van-dropdown-menu>

    <!-- 待办列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadTodos(false)"
      >
        <!-- 空状态 -->
        <div v-if="todos.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无待办事项，经营状态良好" />
        </div>

        <van-swipe-cell v-for="item in todos" :key="item.id">
          <van-cell
            class="todo-cell"
            :border="false"
            @click="goToRelated(item)"
          >
            <template #title>
              <div class="todo-item">
                <!-- 优先级色标 -->
                <div
                  class="priority-bar"
                  :style="{ background: PRIORITY_MAP[item.priority]?.color || '#999' }"
                />
                <!-- 类型图标 -->
                <div
                  class="type-icon"
                  :style="{ background: TYPE_MAP[item.type]?.bgColor || '#F0F2F5' }"
                >
                  <van-icon
                    :name="TYPE_MAP[item.type]?.icon || 'label-o'"
                    size="18"
                    :color="PRIORITY_MAP[item.priority]?.color || '#999'"
                  />
                </div>
                <!-- 内容 -->
                <div class="todo-content">
                  <div class="todo-title">
                    <span class="title-text">{{ item.title }}</span>
                    <van-tag
                      :type="(PRIORITY_MAP[item.priority]?.type as any) || 'default'"
                      :size="('small' as any)"
                      plain
                    >
                      {{ PRIORITY_MAP[item.priority]?.label || item.priority }}
                    </van-tag>
                  </div>
                  <div class="todo-summary">
                    <span class="todo-type-label">{{ TYPE_MAP[item.type]?.label || item.type }}</span>
                    <span v-if="item.summary" class="todo-summary-text">{{ item.summary }}</span>
                  </div>
                </div>
                <!-- 截止日期 -->
                <div class="todo-due">
                  <span class="due-date">{{ formatRelativeTime(item.dueDate) }}</span>
                </div>
              </div>
            </template>
          </van-cell>

          <template #right>
            <van-button
              square
              type="success"
              text="完成"
              class="swipe-btn swipe-btn-done"
              @click="onComplete(item)"
            />
            <van-button
              square
              type="default"
              text="忽略"
              class="swipe-btn swipe-btn-ignore"
              @click="onIgnore(item)"
            />
          </template>
        </van-swipe-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 浮动按钮 -->
    <van-floating-bubble icon="plus" @click="openCreate" />

    <!-- 新建待办弹窗 -->
    <van-popup v-model:show="showCreatePopup" position="bottom" round :style="{ height: '70%' }">
      <div class="create-popup">
        <h3 class="popup-title">新建待办</h3>
        <van-form @submit="onSubmitCreate">
          <van-cell-group inset>
            <van-field
              v-model="createForm.title"
              name="title"
              label="标题"
              placeholder="请输入待办标题"
              :rules="[{ required: true, message: '请输入标题' }]"
            />
            <van-field
              v-model="createForm.type"
              name="type"
              label="类型"
              is-link
              readonly
              clickable
              @click="showTypePicker = true"
            />
            <van-field
              v-model="createForm.priority"
              name="priority"
              label="优先级"
              is-link
              readonly
              clickable
              @click="showPriorityPicker = true"
            />
            <van-field
              v-model="createForm.dueDate"
              name="dueDate"
              label="截止日期"
              is-link
              readonly
              clickable
              placeholder="请选择截止日期"
              @click="showDatePicker = true"
            />
            <van-field
              v-model="createForm.remark"
              name="remark"
              label="备注"
              type="textarea"
              placeholder="请输入备注"
              rows="3"
              autosize
            />
          </van-cell-group>
          <div style="margin: 16px">
            <van-button round block type="primary" native-type="submit" :loading="submitting">
              提交
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 类型选择器 -->
    <van-popup v-model:show="showTypePicker" position="bottom">
      <van-picker
        :columns="TYPE_OPTIONS"
        @confirm="onTypeConfirm"
        @cancel="showTypePicker = false"
      />
    </van-popup>

    <!-- 优先级选择器 -->
    <van-popup v-model:show="showPriorityPicker" position="bottom">
      <van-picker
        :columns="PRIORITY_OPTIONS"
        @confirm="onPriorityConfirm"
        @cancel="showPriorityPicker = false"
      />
    </van-popup>

    <!-- 日期选择器 -->
    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-datetime-picker
        type="date"
        title="选择截止日期"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.todo-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 80px;
}

/* ========== 类型统计标签栏 ========== */

.type-tabs-wrapper {
  background: var(--bg-card);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.type-tabs-wrapper::-webkit-scrollbar {
  display: none;
}

.type-tabs {
  display: flex;
  gap: 8px;
  padding: 10px var(--space-page-padding);
  white-space: nowrap;
}

.type-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--bg-soft);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.type-tab.active {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.type-tab-label {
  font-size: 13px;
}

.type-tab-count {
  font-size: 12px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.08);
  padding: 0 5px;
}

.type-tab.active .type-tab-count {
  background: rgba(255, 255, 255, 0.25);
}

/* ========== 待办列表 ========== */

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.todo-cell {
  margin: 8px var(--space-page-padding);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.priority-bar {
  width: 3px;
  height: 40px;
  border-radius: 2px;
  flex-shrink: 0;
}

.type-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-type-label {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.todo-summary-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-due {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.due-date {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ========== 滑动操作 ========== */

.swipe-btn {
  height: 100%;
  min-width: 64px;
  font-size: 14px;
}

.swipe-btn-done {
  background: var(--color-success);
}

.swipe-btn-ignore {
  background: #C0C4CC;
}

/* ========== 新建弹窗 ========== */

.create-popup {
  padding: 20px 0;
}

.popup-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}
</style>