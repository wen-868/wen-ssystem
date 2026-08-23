<template>
  <view class="role-edit-page">
    <page-header :title="isEdit ? '编辑角色' : '新建角色'" @back="goBack" />

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">角色名称</text>
        <input class="form-input" type="text" v-model="form.name" placeholder="请输入角色名称" />
      </view>
      <view class="form-item">
        <text class="form-label">角色编码</text>
        <input class="form-input" type="text" v-model="form.code" placeholder="请输入角色编码" :disabled="isEdit" />
      </view>
      <view class="form-item form-item--textarea">
        <text class="form-label">备注</text>
        <textarea class="form-textarea" v-model="form.remark" placeholder="请输入备注（选填）" />
      </view>
      <view class="form-item form-item--switch">
        <text class="form-label">状态</text>
        <switch :checked="form.status === 1" @change="onStatusChange" :color="COLOR_PRIMARY" />
        <text class="switch-text">{{ form.status === 1 ? '启用' : '禁用' }}</text>
      </view>
    </view>

    <view class="permission-section">
      <view class="section-title">
        <text>权限配置</text>
        <view class="expand-all" @tap="toggleExpandAll">
          <text class="expand-text">{{ allExpanded ? '全部收起' : '全部展开' }}</text>
        </view>
      </view>

      <view class="permission-tree">
        <view class="perm-node" v-for="node in permissionTree" :key="node.id">
          <view class="perm-header" @tap="toggleExpand(node.id)">
            <view class="perm-check">
              <checkbox
                :checked="isNodeChecked(node)"
                @tap.stop="toggleNodeCheck(node)"
                :color="COLOR_PRIMARY"
              />
            </view>
            <text class="perm-name">{{ node.name }}</text>
            <text class="expand-icon">{{ expandedSet.has(node.id) ? '-' : '+' }}</text>
          </view>
          <view class="perm-children" v-if="expandedSet.has(node.id) && node.children">
            <view class="perm-child" v-for="child in node.children" :key="child.id">
              <view class="perm-check">
                <checkbox
                  :checked="selectedPerms.has(child.id)"
                  @tap.stop="togglePerm(child.id)"
                  :color="COLOR_PRIMARY"
                />
              </view>
              <text class="perm-child-name">{{ child.name }}</text>
            </view>
          </view>
        </view>
        <view class="empty-state" v-if="permissionTree.length === 0">
          <text class="empty-text">暂无权限数据</text>
        </view>
      </view>
    </view>

    <view class="bottom-bar">
      <button class="btn btn--primary btn--block" @tap="onSave">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { COLOR_PRIMARY } from '@/constants/colors'
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { rolesApi, type RoleForm, type PermissionNode } from '@/api/modules/roles'

const isEdit = ref(false)
const roleId = ref(0)

const form = reactive<RoleForm>({
  name: '',
  code: '',
  remark: '',
  status: 1,
  permissions: [],
})

const permissionTree = ref<PermissionNode[]>([])
const selectedPerms = ref<Set<string>>(new Set())
const expandedSet = ref<Set<string>>(new Set())
const allExpanded = ref(false)

function onStatusChange(e: any) {
  form.status = e.detail.value ? 1 : 0
}

function toggleExpand(id: string) {
  if (expandedSet.value.has(id)) {
    expandedSet.value.delete(id)
  } else {
    expandedSet.value.add(id)
  }
}

function toggleExpandAll() {
  allExpanded.value = !allExpanded.value
  if (allExpanded.value) {
    permissionTree.value.forEach(node => expandedSet.value.add(node.id))
  } else {
    expandedSet.value.clear()
  }
}

function isNodeChecked(node: PermissionNode): boolean {
  if (!node.children || node.children.length === 0) {
    return selectedPerms.value.has(node.id)
  }
  return node.children.every(child => selectedPerms.value.has(child.id))
}

function toggleNodeCheck(node: PermissionNode) {
  const checked = isNodeChecked(node)
  const ids: string[] = [node.id]
  if (node.children) {
    node.children.forEach(child => ids.push(child.id))
  }
  ids.forEach(id => {
    if (checked) {
      selectedPerms.value.delete(id)
    } else {
      selectedPerms.value.add(id)
    }
  })
}

function togglePerm(id: string) {
  if (selectedPerms.value.has(id)) {
    selectedPerms.value.delete(id)
  } else {
    selectedPerms.value.add(id)
  }
}

function buildPermissionTree(perms: string[]): PermissionNode[] {
  const moduleMap: Record<string, PermissionNode> = {}
  perms.forEach(perm => {
    const parts = perm.split(':')
    const module = parts[0] || perm
    const action = parts[1] || ''
    if (!moduleMap[module]) {
      moduleMap[module] = { id: module, name: getModuleName(module), children: [] }
    }
    if (action) {
      moduleMap[module].children!.push({
        id: perm,
        name: getActionName(action),
      })
    }
  })
  return Object.values(moduleMap)
}

function getModuleName(code: string): string {
  const map: Record<string, string> = {
    product: '商品管理', order: '订单管理', customer: '客户管理',
    supplier: '供应商管理', inventory: '库存管理', finance: '财务管理',
    marketing: '营销管理', report: '报表统计', system: '系统设置',
    store: '门店管理', role: '角色权限',
  }
  return map[code] ?? code
}

function getActionName(code: string): string {
  const map: Record<string, string> = {
    view: '查看', create: '新增', edit: '编辑', delete: '删除',
    export: '导出', import: '导入', audit: '审核', print: '打印',
  }
  return map[code] ?? code
}

async function loadRole(id: number) {
  try {
    const role = await rolesApi.detail(id)
    isEdit.value = true
    roleId.value = id
    Object.assign(form, {
      name: role.name,
      code: role.code,
      remark: role.remark ?? '',
      status: role.status ?? 1,
      permissions: role.permissions ?? [],
    })
    if (role.permissions) {
      role.permissions.forEach(p => selectedPerms.value.add(p))
      permissionTree.value = buildPermissionTree(role.permissions)
    }
  } catch (err) {
    console.error('加载角色失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function validate(): boolean {
  if (!form.name || !form.name.trim()) {
    uni.showToast({ title: '请输入角色名称', icon: 'none' })
    return false
  }
  if (!form.code || !form.code.trim()) {
    uni.showToast({ title: '请输入角色编码', icon: 'none' })
    return false
  }
  return true
}

async function onSave() {
  if (!validate()) return
  const data: RoleForm = {
    ...form,
    permissions: Array.from(selectedPerms.value),
  }
  try {
    if (isEdit.value) {
      await rolesApi.update(roleId.value, data)
    } else {
      await rolesApi.create(data)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (err) {
    console.error('保存失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

onLoad((options: any) => {
  if (options.id) {
    loadRole(Number(options.id))
  }
})
</script>

<style lang="scss" scoped>
.role-edit-page { min-height: 100vh; background: $uni-color-primary-soft; padding-bottom: 140rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.form-section { background: $uni-bg-color; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 8rpx 32rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.form-item { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.form-item:last-child { border-bottom: none; }
.form-item--textarea { flex-direction: column; align-items: stretch; }
.form-item--switch { gap: 16rpx; }
.form-label { font-size: 28rpx; color: $uni-gray-700; width: 160rpx; flex-shrink: 0; }
.form-item--textarea .form-label { margin-bottom: 16rpx; width: auto; }
.form-input { flex: 1; height: 60rpx; font-size: 28rpx; color: $uni-gray-700; }
.form-textarea { width: 100%; min-height: 100rpx; font-size: 28rpx; color: $uni-gray-700; }
.switch-text { font-size: 26rpx; color: $uni-gray-400; }
.permission-section { background: $uni-bg-color; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.section-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.section-title text { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.expand-all { }
.expand-text { font-size: 24rpx; color: $uni-color-primary; }
.permission-tree { }
.perm-node { margin-bottom: 8rpx; }
.perm-header { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.perm-check { }
.perm-name { flex: 1; font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }
.expand-icon { font-size: 28rpx; color: $uni-gray-400; width: 40rpx; text-align: center; }
.perm-children { padding-left: 48rpx; }
.perm-child { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 0; }
.perm-child-name { font-size: 26rpx; color: $uni-gray-500; }
.empty-state { display: flex; justify-content: center; padding: 60rpx 0; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: $uni-bg-color; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.btn--block { width: 100%; }
</style>
