<template>
  <view class="todos-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">待办事项</text>
    </view>

    <scroll-view class="todo-list" scroll-y v-if="list.length > 0">
      <view
        class="todo-item"
        v-for="item in list"
        :key="item.id"
        :class="{ 'todo-item--done': item.status === 'done' }"
      >
        <view class="todo-status-icon" :class="item.status === 'done' ? 'status-done' : 'status-pending'">
          <text class="status-dot">{{ item.status === 'done' ? '\ue650' : '\ue651' }}</text>
        </view>
        <view class="todo-content">
          <text class="todo-title" :class="{ 'todo-title--done': item.status === 'done' }">{{ item.title }}</text>
          <view class="todo-meta">
            <text class="todo-status-text" :class="'status-text-' + item.status">
              {{ item.status === 'done' ? '已完成' : '待处理' }}
            </text>
            <text class="todo-deadline" v-if="item.deadline">截止：{{ item.deadline }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe617;</text>
      <text class="empty-text">暂无待办事项</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi, type TodoItem } from '@/api/modules/dashboard'

const list = ref<TodoItem[]>([])
const loading = ref(false)

async function loadTodos() {
  loading.value = true
  try {
    list.value = await dashboardApi.getTodos()
  } catch (err) {
    console.error('加载待办失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTodos()
})
</script>

<style scoped>
.todos-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

.todo-list {
  padding: 16rpx 24rpx;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.todo-item--done {
  opacity: 0.7;
}

.todo-status-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  margin-top: 4rpx;
  flex-shrink: 0;
}

.status-pending {
  background: #e6f4ff;
}

.status-done {
  background: #f6ffed;
}

.status-dot {
  font-size: 24rpx;
  color: #1677FF;
}

.status-done .status-dot {
  color: #52c41a;
}

.todo-content {
  flex: 1;
}

.todo-title {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.todo-title--done {
  text-decoration: line-through;
  color: #bbb;
}

.todo-meta {
  display: flex;
  align-items: center;
}

.todo-status-text {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  margin-right: 16rpx;
}

.status-text-pending { background: #e6f4ff; color: #1677FF; }
.status-text-done { background: #f6ffed; color: #52c41a; }

.todo-deadline {
  font-size: 24rpx;
  color: #999;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>