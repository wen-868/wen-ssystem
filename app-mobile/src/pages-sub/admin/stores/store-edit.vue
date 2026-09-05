<template>
  <view class="store-edit-page">
    <page-header :title="pageTitle" @back="goBack">
      <template #right>
        <view class="hd-status" :class="editMode ? 'hd-status--draft' : 'hd-status--saved'">
          <text>{{ editMode ? (dirty ? '未保存' : '编辑中') : '已保存' }}</text>
        </view>
      </template>
    </page-header>

    <!-- 概览头（对齐原稿 ov-head） -->
    <view class="pd-group">
      <view class="ov-head">
        <view class="ov-ico" :class="isWarehouse ? 'ov-ico--wh' : 'ov-ico--store'">
          <text class="ov-ico-text">{{ isWarehouse ? '仓' : '店' }}</text>
        </view>
        <view class="ov-info">
          <view class="ov-name">{{ form.name || `未命名${isWarehouse ? '仓库' : '门店'}` }}</view>
          <view class="ov-meta">
            <text class="ty-badge" :class="isWarehouse ? 'ty-wh' : 'ty-store'">{{ isWarehouse ? '仓库' : '门店' }}</text>
            <text v-if="form.code" class="ov-code">{{ form.code }}</text>
            <text v-if="form.isDefault" class="ov-tag ov-tag--def">默认</text>
            <text v-if="form.status !== 1" class="ov-tag ov-tag--off">已停用</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 基本信息（对齐原稿：类型 chips + 编码 + 名称） -->
    <view class="pd-group">
      <view class="pd-gtitle"><view class="gt-bar"></view><text>基本信息</text></view>
      <view class="chips-row">
        <text class="chips-lb">类型</text>
        <view
          class="chip"
          v-for="t in typeOptions"
          :key="t.k"
          :class="{ 'chip--on': form.storeType === t.k }"
          @tap="pickType(t.k)"
        >
          <text>{{ t.name }}</text>
        </view>
      </view>
      <view class="f-row">
        <text class="f-label">编码</text>
        <input v-if="editMode" class="f-inp" v-model="form.code" placeholder="如 ST001" placeholder-class="f-ph" />
        <text v-else class="f-val" :class="{ 'f-val--ph': !form.code }">{{ form.code || '如 ST001' }}</text>
      </view>
      <view class="f-row">
        <text class="f-label">名称</text>
        <input v-if="editMode" class="f-inp" v-model="form.name" placeholder="请输入名称" placeholder-class="f-ph" />
        <text v-else class="f-val" :class="{ 'f-val--ph': !form.name }">{{ form.name || '请输入名称' }}</text>
      </view>
    </view>

    <!-- 地址与负责人 -->
    <view class="pd-group">
      <view class="pd-gtitle"><view class="gt-bar"></view><text>地址与负责人</text></view>
      <view class="f-row f-row--col">
        <text class="f-label f-label--wide">详细地址</text>
        <input v-if="editMode" class="f-inp f-inp--left" v-model="form.address" placeholder="省市区 + 街道门牌" placeholder-class="f-ph" />
        <text v-else class="f-val f-val--left" :class="{ 'f-val--ph': !form.address }">{{ form.address || '省市区 + 街道门牌' }}</text>
      </view>
      <view class="f-row">
        <text class="f-label">负责人</text>
        <input v-if="editMode" class="f-inp" v-model="form.contactName" placeholder="姓名" placeholder-class="f-ph" />
        <text v-else class="f-val" :class="{ 'f-val--ph': !form.contactName }">{{ form.contactName || '姓名' }}</text>
      </view>
      <view class="f-row">
        <text class="f-label">联系电话</text>
        <input v-if="editMode" class="f-inp" v-model="form.phone" placeholder="手机号或固话" placeholder-class="f-ph" />
        <text v-else class="f-val" :class="{ 'f-val--ph': !form.phone }">{{ form.phone || '手机号或固话' }}</text>
      </view>
    </view>

    <!-- 状态设置（对齐原稿：默认/启用两个开关 + 提示） -->
    <view class="pd-group">
      <view class="pd-gtitle"><view class="gt-bar"></view><text>状态设置</text></view>
      <view class="f-row f-row--static">
        <view class="f-flex">
          <text class="f-label f-label--auto">设为默认</text>
          <text class="f-hint">开单时默认选中该{{ isWarehouse ? '仓库' : '门店' }}，仅可设一个</text>
        </view>
        <switch :checked="!!form.isDefault" :disabled="!editMode" color="#2563eb" @change="onDefaultChange" />
      </view>
      <view class="f-row f-row--static">
        <view class="f-flex">
          <text class="f-label f-label--auto">启用</text>
          <text class="f-hint">停用后开单、调拨选不到，历史单据不受影响</text>
        </view>
        <switch :checked="form.status === 1" :disabled="!editMode" color="#2563eb" @change="onStatusChange" />
      </view>
    </view>

    <view class="safe-bottom"></view>

    <!-- 底部操作栏（对齐原稿：只读=删除/修改；编辑=取消/保存） -->
    <view class="act-bar">
      <block v-if="editMode">
        <view class="ab-btn ab-btn--ghost" @tap="cancelEdit"><text>取消</text></view>
        <view class="ab-btn ab-btn--primary" @tap="onSave"><text>保存</text></view>
      </block>
      <block v-else>
        <view class="ab-btn ab-btn--ghost" @tap="onDelete"><text>删除</text></view>
        <view class="ab-btn ab-btn--primary" @tap="startEdit"><text>修改</text></view>
      </block>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack() { uni.navigateBack() }

import { COLOR_PRIMARY } from '@/constants/colors'
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { storesApi, type StoreForm } from '@/api/modules/stores'

const isEdit = ref(false)
const storeId = ref(0)
const editMode = ref(false)
const dirty = ref(false)
const snap = ref<StoreForm | null>(null)

const typeOptions = [
  { k: 'STORE', name: '门店' },
  { k: 'WAREHOUSE', name: '仓库' },
] as const

const form = reactive<StoreForm & { storeType?: 'STORE' | 'WAREHOUSE' }>({
  name: '',
  code: '',
  phone: '',
  contactName: '',
  address: '',
  status: 1,
  storeType: 'STORE',
  isDefault: false,
})

const isWarehouse = computed(() => form.storeType === 'WAREHOUSE')
const pageTitle = computed(() => {
  if (!isEdit.value) return `新增${isWarehouse.value ? '仓库' : '门店'}`
  return `${isWarehouse.value ? '仓库' : '门店'}详情`
})

watch(form, () => { if (editMode.value) dirty.value = true }, { deep: true })

function pickType(k: 'STORE' | 'WAREHOUSE') {
  if (!editMode.value) {
    uni.showToast({ title: '当前为只读状态，请点「修改」', icon: 'none' })
    return
  }
  form.storeType = k
}

function onDefaultChange(e: any) {
  form.isDefault = !!e.detail.value
}
function onStatusChange(e: any) {
  form.status = e.detail.value ? 1 : 0
}

async function loadStore(id: number) {
  try {
    const store = await storesApi.detail(id)
    isEdit.value = true
    storeId.value = id
    Object.assign(form, {
      name: store.name,
      code: store.code ?? '',
      phone: store.phone ?? '',
      contactName: store.contactName ?? '',
      address: store.address ?? '',
      status: store.status ?? 1,
      storeType: (String(store.type).toUpperCase() === 'WAREHOUSE' ? 'WAREHOUSE' : 'STORE') as 'STORE' | 'WAREHOUSE',
      isDefault: !!store.isDefault,
    })
    nextTick(() => { dirty.value = false })
  } catch (err) {
    console.error('加载门店失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function startEdit() {
  snap.value = { ...form }
  editMode.value = true
  dirty.value = false
}

function cancelEdit() {
  if (snap.value) Object.assign(form, snap.value)
  editMode.value = false
  dirty.value = false
}

function onDelete() {
  // 后端无门店删除接口（历史单据引用），对齐原稿的诚实提示
  uni.showToast({ title: '暂不支持删除门店', icon: 'none' })
}

function validate(): boolean {
  if (!form.name || !form.name.trim()) {
    uni.showToast({ title: '请填写名称', icon: 'none' })
    return false
  }
  return true
}

async function onSave() {
  if (!validate()) return
  const data: StoreForm = { ...form }
  if (data.longitude != null) data.longitude = Number(data.longitude)
  if (data.latitude != null) data.latitude = Number(data.latitude)
  try {
    if (isEdit.value) {
      await storesApi.update(storeId.value, data)
    } else {
      await storesApi.create(data)
      isEdit.value = true
    }
    editMode.value = false
    dirty.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    if (isEdit.value) await loadStore(storeId.value)
  } catch (err) {
    console.error('保存失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

onLoad((options: any) => {
  if (options.id) {
    loadStore(Number(options.id))
  } else {
    // 新增默认类型跟随列表页入口参数（?type=WAREHOUSE）
    if (options.type === 'WAREHOUSE') form.storeType = 'WAREHOUSE'
    editMode.value = true
    dirty.value = false
  }
})
</script>

<style lang="scss" scoped>
.store-edit-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}
.hd-status {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: $uni-border-radius-pill;
}
.hd-status--saved { color: $uni-color-success; background: $uni-color-success-soft; }
.hd-status--draft { color: $uni-color-warning; background: $uni-color-warning-soft; }

.pd-group {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  margin: 24rpx 20rpx 0;
  overflow: hidden;
}
.ov-head { display: flex; gap: 24rpx; padding: 28rpx 32rpx; align-items: center; }
.ov-ico {
  width: 104rpx;
  height: 104rpx;
  border-radius: $uni-border-radius-base;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ov-ico--store { background: $zx-badge-warning-strong; }
.ov-ico--wh { background: $zx-warehouse; }
.ov-ico-text { font-size: 40rpx; font-weight: 700; color: $uni-text-color-inverse; }
.ov-info { flex: 1; min-width: 0; }
.ov-name { font-size: 34rpx; font-weight: 700; color: $uni-text-color; margin-bottom: 8rpx; }
.ov-meta { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.ov-code { font-size: 24rpx; color: $uni-gray-400; }
.ov-tag { font-size: 21rpx; padding: 4rpx 14rpx; border-radius: $uni-border-radius-pill; }
.ov-tag--def { background: $uni-color-primary-soft; color: $uni-color-primary; }
.ov-tag--off { background: $uni-gray-100; color: $uni-gray-400; }

.pd-gtitle {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 32rpx 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-gray-600;
}
.gt-bar { width: 6rpx; height: 24rpx; border-radius: 4rpx; background: $uni-color-primary; }

.chips-row { display: flex; flex-wrap: wrap; gap: 14rpx; padding: 22rpx 32rpx; border-bottom: 1rpx solid $uni-border-color-light; }
.chips-lb { font-size: 24rpx; color: $uni-gray-400; align-self: center; margin-right: 4rpx; }
.chip {
  padding: 12rpx 26rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color-page;
  font-size: 25rpx;
  font-weight: 600;
  color: $uni-gray-500;
}
.chip--on { background: $uni-color-primary; color: $uni-text-color-inverse; }

.f-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.f-row:last-child { border-bottom: none; }
.f-row--col { flex-direction: column; align-items: stretch; gap: 12rpx; }
.f-row--static { align-items: center; }
.f-label { width: 176rpx; font-size: 27rpx; color: $uni-gray-500; flex-shrink: 0; }
.f-label--wide { width: auto; }
.f-label--auto { width: auto; flex: 1; font-weight: 600; color: $uni-text-color; margin-bottom: 4rpx; }
.f-flex { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.f-val { flex: 1; min-width: 0; font-size: 27rpx; color: $uni-text-color; text-align: right; word-break: break-all; }
.f-val--left { text-align: left; }
.f-val--ph { color: $uni-gray-300; }
.f-inp {
  flex: 1;
  min-width: 0;
  height: 60rpx;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  padding: 0 20rpx;
}
.f-inp--left { text-align: left; }
.f-ph { color: $uni-gray-300; }
.f-hint { font-size: 22rpx; color: $uni-gray-400; line-height: 1.5; }

.safe-bottom { height: 40rpx; }

.act-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  z-index: 50;
}
.ab-btn {
  flex: 1;
  height: 80rpx;
  border-radius: $uni-border-radius-base;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
}
.ab-btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.ab-btn--ghost { background: $uni-bg-color-page; color: $uni-gray-600; flex: 0 0 auto; padding: 0 32rpx; }
</style>
