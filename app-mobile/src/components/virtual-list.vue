<template>
  <!--
    虚拟滚动列表组件
    - 适用于 uni-app（H5 / 小程序 / App）
    - 外层 scroll-view 提供滚动能力
    - 内层 phantom view 撑起总高度，content view 用 translateY 偏移到正确位置
    - 仅渲染可见区域 + buffer 缓冲行，DOM 数量稳定，支持万级数据流畅滚动
  -->
  <scroll-view
    class="virtual-list"
    :style="containerStyle"
    scroll-y
    :scroll-with-animation="false"
    :lower-threshold="loadMoreThreshold"
    :refresher-enabled="refresherEnabled"
    :refresher-triggered="refresherTriggered"
    @scroll="onScroll"
    @scrolltolower="onScrollToLower"
    @refresherrefresh="onRefresherRefresh"
  >
    <view class="virtual-list-phantom" :style="{ height: totalHeight + 'px', position: 'relative' }">
      <view
        class="virtual-list-content"
        :style="{
          transform: `translate3d(0, ${offsetY}px, 0)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }"
      >
        <view
          v-for="(item, idx) in visibleItems"
          :key="getKey(item, startIndex + idx)"
          class="virtual-list-item"
          :style="{ height: itemSize + 'px' }"
        >
          <slot :item="item" :index="startIndex + idx" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

/**
 * VirtualList 组件 Props
 */
interface Props {
  /** 数据源 */
  data: any[]
  /** 单行高度（px），默认 80 */
  itemSize?: number
  /**
   * 列表容器高度（px），默认 600
   * 传 0 时使用 flex:1 + height:0 自适应剩余空间
   */
  height?: number
  /** 上下额外渲染行数，默认 5 */
  buffer?: number
  /** 行唯一标识字段名（用于 :key），未传则使用索引 */
  itemKey?: string
  /**
   * 触发 load-more 的阈值（px），默认为 itemSize * 3
   * 即距离底部 itemSize * 3 时触发 scrolltolower
   */
  threshold?: number
  /** 是否开启下拉刷新，默认 false */
  refresherEnabled?: boolean
  /** 当前下拉刷新状态（受控），默认 false */
  refresherTriggered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  itemSize: 80,
  height: 600,
  buffer: 5,
  itemKey: '',
  threshold: 0,
  refresherEnabled: false,
  refresherTriggered: false
})

/**
 * Events
 * - load-more: 滚动到底部时触发（分页加载）
 * - scroll: 滚动事件，暴露 scrollTop
 * - refresh: 下拉刷新触发
 */
const emit = defineEmits<{
  (e: 'load-more'): void
  (e: 'scroll', scrollTop: number): void
  (e: 'refresh'): void
}>()

/** 当前滚动位置（px） */
const scrollTop = ref(0)

/**
 * 容器样式
 * - height > 0：使用具体高度
 * - height <= 0：使用 flex:1 + height:0 自适应剩余空间
 */
const containerStyle = computed(() => {
  if (props.height > 0) {
    return { height: props.height + 'px' }
  }
  return { flex: '1 1 0%', height: '0' }
})

/** 触发 load-more 的阈值 */
const loadMoreThreshold = computed(() => {
  return props.threshold > 0 ? props.threshold : props.itemSize * 3
})

/** 可见行数 = 向上取整(容器高度/行高) + 上下 buffer */
const visibleCount = computed(() => {
  const safeHeight = props.height > 0 ? props.height : 600
  return Math.ceil(safeHeight / props.itemSize) + props.buffer * 2
})

/** 起始索引 = max(0, floor(scrollTop / itemSize) - buffer) */
const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.itemSize) - props.buffer)
})

/** 结束索引 = min(data.length, startIndex + visibleCount) */
const endIndex = computed(() => {
  return Math.min(props.data.length, startIndex.value + visibleCount.value)
})

/** 可见数据切片 */
const visibleItems = computed(() => {
  return props.data.slice(startIndex.value, endIndex.value)
})

/** 内容偏移量 = startIndex * itemSize */
const offsetY = computed(() => {
  return startIndex.value * props.itemSize
})

/** 总高度 = data.length * itemSize */
const totalHeight = computed(() => {
  return props.data.length * props.itemSize
})

/**
 * 获取行 key
 * - 优先使用 itemKey 字段
 * - 未配置或字段值缺失时回退到索引
 */
function getKey(item: any, index: number): string | number {
  if (props.itemKey && item && item[props.itemKey] != null) {
    return item[props.itemKey]
  }
  return index
}

/**
 * 滚动事件处理（节流）
 * - 使用 16ms 节流（≈60fps）
 * - 同时向父组件暴露原始 scrollTop
 */
let ticking = false
function onScroll(e: any) {
  const top: number = e?.detail?.scrollTop ?? 0
  emit('scroll', top)
  if (!ticking) {
    ticking = true
    setTimeout(() => {
      scrollTop.value = top
      ticking = false
    }, 16)
  }
}

/** scroll-view 触发 scrolltolower 事件时通知父组件加载更多 */
function onScrollToLower() {
  emit('load-more')
}

/** 下拉刷新触发时通知父组件 */
function onRefresherRefresh() {
  emit('refresh')
}

/**
 * 监听数据长度变化
 * - 数据减少（重置/筛选切换）时重置滚动位置到顶部，避免空白
 */
watch(
  () => props.data.length,
  (newLen, oldLen) => {
    if (newLen < (oldLen ?? 0)) {
      scrollTop.value = 0
    }
  }
)
</script>

<style scoped>
.virtual-list {
  width: 100%;
  position: relative;
  overflow: hidden;
}

.virtual-list-phantom {
  width: 100%;
}

.virtual-list-content {
  width: 100%;
  will-change: transform;
}

.virtual-list-item {
  width: 100%;
  box-sizing: border-box;
}
</style>
