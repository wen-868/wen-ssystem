<template>
  <view class="categories-page">
    <page-header title="商品分类" @back="goBack" />

    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索分类名称"
          placeholder-class="search-placeholder"
          @confirm="loadCategories"
        />
        <image class="search-clear ic" v-if="keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <scroll-view class="tree-scroll" scroll-y v-if="treeList.length > 0">
      <view class="tree-list">
        <view
          v-for="node in filteredList"
          :key="node.id"
          class="tree-node"
          :style="{ paddingLeft: (32 + node.level * 32) + 'rpx' }"
        >
          <view class="node-content" @tap="toggleExpand(node)">
            <image
              class="expand-icon ic"
              v-if="node.children && node.children.length > 0"
              :src="node.expanded ? '/static/icons/ic/chevron-down.svg' : '/static/icons/ic/chevron-right.svg'"
              mode="aspectFit"
            />
            <text class="expand-icon expand-icon--leaf" v-else></text>
            <text class="node-name">{{ node.name }}</text>
            <view class="offline-badge" v-if="node.allowOnlineSale === 0">
              <text class="offline-badge-text">仅线下</text>
            </view>
            <text class="node-sort" v-if="node.sortNo != null">序{{ node.sortNo }}</text>
          </view>
          <view class="node-actions">
            <text class="action-text edit" @tap.stop="goEdit(node.id)">编辑</text>
            <text class="action-text sort" @tap.stop="goSort(node)">排序</text>
            <text class="action-text add-sub" v-if="node.level < 2" @tap.stop="goAddSub(node.id)">添加子级</text>
            <text class="action-text delete" @tap.stop="onDelete(node)">删除</text>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无分类数据</text>
    </view>

    <view class="fab-btn" @tap="goAddRoot">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, computed, onMounted } from 'vue'
import { categoriesApi, type CategoryInfo } from '@/api/modules/categories'

interface TreeNode extends CategoryInfo {
  level: number
  expanded: boolean
}

const keyword = ref('')
const loading = ref(false)
const rawList = ref<CategoryInfo[]>([])

/** 将扁平分类列表构建为树 */
function buildTree(list: CategoryInfo[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []
  // 初始化所有节点
  list.forEach((c) => {
    map.set(c.id, { ...c, level: 0, expanded: true })
  })
  // 构建父子关系
  list.forEach((c) => {
    const node = map.get(c.id)!
    if (c.parentId && map.has(c.parentId)) {
      const parent = map.get(c.parentId)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  // 设置层级
  const setLevel = (nodes: TreeNode[], level: number) => {
    nodes.forEach((n) => {
      n.level = level
      if (n.children && n.children.length > 0) {
        setLevel(n.children as TreeNode[], level + 1)
      }
    })
  }
  setLevel(roots, 0)
  return roots
}

const treeList = ref<TreeNode[]>([])

/** 树转扁平（保留层级信息，用于展示） */
function flatten(nodes: TreeNode[], result: TreeNode[] = []): TreeNode[] {
  nodes.forEach((n) => {
    result.push(n)
    if (n.expanded && n.children && n.children.length > 0) {
      flatten(n.children as TreeNode[], result)
    }
  })
  return result
}

const filteredList = computed(() => {
  if (!keyword.value) return flatten(treeList.value)
  // 搜索时展开所有节点并过滤
  const all = flatten(treeList.value)
  return all.filter((n) => n.name.includes(keyword.value))
})

function toggleExpand(node: TreeNode) {
  if (node.children && node.children.length > 0) {
    node.expanded = !node.expanded
  }
}

async function loadCategories() {
  loading.value = true
  try {
    const list = await categoriesApi.list()
    rawList.value = list
    treeList.value = buildTree(list)
  } catch (err) {
    console.error('加载分类失败:', err)
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  loadCategories()
}

function goAddRoot() {
  uni.navigateTo({ url: '/pages-sub/product/categories/category-edit' })
}

function goAddSub(parentId: number) {
  uni.navigateTo({ url: `/pages-sub/product/categories/category-edit?parentId=${parentId}` })
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages-sub/product/categories/category-edit?id=${id}` })
}

function goSort(node: TreeNode) {
  uni.showActionSheet({
    itemList: ['上移', '下移', '置顶', '置底'],
    success: async (res) => {
      const currentSort = node.sortNo ?? 0
      let newSort = currentSort
      if (res.tapIndex === 0) newSort = currentSort - 1
      else if (res.tapIndex === 1) newSort = currentSort + 1
      else if (res.tapIndex === 2) newSort = 0
      else if (res.tapIndex === 3) newSort = 9999
      try {
        await categoriesApi.sort(node.id, newSort)
        uni.showToast({ title: '排序已更新', icon: 'success' })
        loadCategories()
      } catch (err) {
        console.error('排序失败:', err)
      }
    },
  })
}

function onDelete(node: TreeNode) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除分类「${node.name}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await categoriesApi.remove(node.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadCategories()
        } catch (err) {
          console.error('删除失败:', err)
        }
      }
    },
  })
}

onMounted(() => {
  loadCategories()
})
</script>

<style lang="scss" scoped>
.categories-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  display: flex;
  flex-direction: column;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center; height: 72rpx;
  background: $uni-bg-color-page; border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.tree-scroll { flex: 1; padding: 16rpx 24rpx; }
.tree-list { background: $uni-bg-color; border-radius: 16rpx; overflow: hidden; }
.tree-node {
  border-bottom: 1rpx solid $uni-bg-color-grey;
  padding: 20rpx 24rpx;
}
.tree-node:last-child { border-bottom: none; }
.node-content {
  display: flex; align-items: center; margin-bottom: 12rpx;
}
.expand-icon {
  font-size: 28rpx; color: $uni-color-primary; width: 40rpx;
  display: inline-block; text-align: center;
}
.expand-icon--leaf { width: 40rpx; }
.node-name { font-size: 30rpx; color: $uni-gray-700; font-weight: 500; flex: 1; }
.offline-badge {
  padding: 2rpx 12rpx; background: rgba(255,77,79,0.1);
  border-radius: 6rpx; margin-left: 12rpx;
}
.offline-badge-text { font-size: 20rpx; color: $uni-color-error; }
.node-sort { font-size: 22rpx; color: $uni-gray-300; margin-left: 12rpx; }
.node-actions { display: flex; gap: 20rpx; padding-left: 40rpx; }
.action-text { font-size: 24rpx; }
.action-text.edit { color: $uni-color-primary; }
.action-text.sort { color: $uni-color-success; }
.action-text.add-sub { color: $uni-color-warning; }
.action-text.delete { color: $uni-color-error; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn {
  position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.4);
}
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
