<script setup lang="ts">
const emit = defineEmits<{ navigate: [page: string] }>()

function goTo(page: string) {
  emit('navigate', page)
}

const quickActions = [
  { label: '快速开单', icon: 'edit', color: 'var(--color-primary)', page: 'create-sale' },
  { label: '销售单据', icon: 'orders-o', color: 'var(--color-success)', page: 'sale-bills' },
  { label: '库存管理', icon: 'cluster-o', color: 'var(--color-warning)', page: 'inventory' },
  { label: '客户管理', icon: 'friends-o', color: 'var(--color-primary)', page: 'customers' },
  { label: '订单配送', icon: 'logistics', color: 'var(--color-success)', page: 'orders' },
  { label: '应收管理', icon: 'balance-o', color: 'var(--color-danger)', page: 'receivables' },
  { label: '库存调整', icon: 'exchange', color: 'var(--color-warning)', page: 'inventory-adjust' },
  { label: '分享收款', icon: 'share-o', color: 'var(--color-primary)', page: 'share-collection' }
]

const dataTools = [
  { label: '经营报表', icon: 'chart-trending-o', color: 'var(--color-primary)', page: 'reports' },
  { label: '商品管理', icon: 'goods-collect-o', color: 'var(--color-success)', page: 'admin-products' },
  { label: '员工管理', icon: 'friends-o', color: 'var(--color-warning)', page: 'admin-staff' },
  { label: '门店设置', icon: 'shop-o', color: 'var(--color-danger)', page: 'admin-stores' }
]
</script>

<template>
  <section class="page">
    <h2 class="page-title">功能中心</h2>

    <!-- 高频操作 8 宫格 -->
    <div class="section-header">
      <van-icon name="fire-o" size="16" color="var(--color-danger)" />
      <span>常用功能</span>
    </div>
    <div class="action-grid">
      <div
        v-for="action in quickActions"
        :key="action.label"
        class="action-item"
        @click="goTo(action.page)"
      >
        <div class="action-icon" :style="{ background: action.color + '12', color: action.color }">
          <van-icon :name="action.icon" size="24" />
        </div>
        <span class="action-label">{{ action.label }}</span>
      </div>
    </div>

    <!-- 数据工具 -->
    <div class="section-header">
      <van-icon name="bar-chart-o" size="16" color="var(--color-primary)" />
      <span>数据工具</span>
    </div>
    <div class="tool-list">
      <div
        v-for="tool in dataTools"
        :key="tool.label"
        class="tool-item"
        @click="goTo(tool.page)"
      >
        <div class="tool-left">
          <div class="tool-icon" :style="{ background: tool.color + '12', color: tool.color }">
            <van-icon :name="tool.icon" size="20" />
          </div>
          <span class="tool-label">{{ tool.label }}</span>
        </div>
        <van-icon name="arrow" size="14" color="var(--text-muted)" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 16px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== 区块标题 ===== */
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== 8 宫格高频操作 ===== */
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s;
}

.action-item:active {
  transform: scale(0.95);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-label {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
}

/* ===== 数据工具列表 ===== */
.tool-list {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.tool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.tool-item:active {
  background: var(--bg-soft);
}

.tool-item + .tool-item {
  border-top: 1px solid var(--border-normal);
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-label {
  font-size: 14px;
  color: var(--text-primary);
}
</style>
