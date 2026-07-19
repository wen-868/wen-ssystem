<template>
  <view class="store-edit-page">
    <view class="page-header">
      <text class="header-title">{{ isEdit ? '编辑门店' : '新建门店' }}</text>
    </view>

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">门店名称</text>
        <input class="form-input" type="text" v-model="form.name" placeholder="请输入门店名称" />
      </view>
      <view class="form-item">
        <text class="form-label">门店编码</text>
        <input class="form-input" type="text" v-model="form.code" placeholder="请输入门店编码（选填）" />
      </view>
      <view class="form-item">
        <text class="form-label">联系电话</text>
        <input class="form-input" type="number" v-model="form.phone" placeholder="请输入联系电话" />
      </view>
      <view class="form-item">
        <text class="form-label">联系人</text>
        <input class="form-input" type="text" v-model="form.contactName" placeholder="请输入联系人" />
      </view>
      <view class="form-item">
        <text class="form-label">营业时间</text>
        <input class="form-input" type="text" v-model="form.businessHours" placeholder="如：08:00-22:00" />
      </view>
      <view class="form-item form-item--textarea">
        <text class="form-label">门店地址</text>
        <textarea class="form-textarea" v-model="form.address" placeholder="请输入门店地址" />
      </view>
      <view class="form-item">
        <text class="form-label">经度</text>
        <input class="form-input" type="digit" v-model="form.longitude" placeholder="经度（选填）" />
      </view>
      <view class="form-item">
        <text class="form-label">纬度</text>
        <input class="form-input" type="digit" v-model="form.latitude" placeholder="纬度（选填）" />
      </view>
      <view class="form-item form-item--switch">
        <text class="form-label">营业状态</text>
        <switch :checked="form.status === 1" @change="onStatusChange" color="#1677FF" />
        <text class="switch-text">{{ form.status === 1 ? '营业中' : '已停业' }}</text>
      </view>
    </view>

    <view class="bottom-bar">
      <button class="btn btn--primary btn--block" @tap="onSave">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { storesApi, type StoreForm } from '@/api/modules/stores'

const isEdit = ref(false)
const storeId = ref(0)

const form = reactive<StoreForm>({
  name: '',
  code: '',
  phone: '',
  contactName: '',
  address: '',
  businessHours: '',
  longitude: undefined,
  latitude: undefined,
  status: 1,
})

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
      businessHours: store.businessHours ?? '',
      longitude: store.longitude,
      latitude: store.latitude,
      status: store.status ?? 1,
    })
  } catch (err) {
    console.error('加载门店失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function validate(): boolean {
  if (!form.name || !form.name.trim()) {
    uni.showToast({ title: '请输入门店名称', icon: 'none' })
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
    loadStore(Number(options.id))
  }
})
</script>

<style scoped>
.store-edit-page { min-height: 100vh; background: #f0f5ff; padding-bottom: 140rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.form-section { background: #fff; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 8rpx 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.form-item { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.form-item:last-child { border-bottom: none; }
.form-item--textarea { flex-direction: column; align-items: stretch; }
.form-item--switch { gap: 16rpx; }
.form-label { font-size: 28rpx; color: #333; width: 160rpx; flex-shrink: 0; }
.form-item--textarea .form-label { margin-bottom: 16rpx; width: auto; }
.form-input { flex: 1; height: 60rpx; font-size: 28rpx; color: #333; }
.form-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #333; }
.switch-text { font-size: 26rpx; color: #999; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: #1677FF; color: #fff; }
.btn--block { width: 100%; }
</style>
